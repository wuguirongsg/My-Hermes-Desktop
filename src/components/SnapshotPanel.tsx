import { useState, useEffect } from "react";
import Icon from "./Icon";

interface Snapshot {
  id: string;
  label: string;
  createdAt: string;
  sessionTitle: string;
  expanded: boolean;
}

interface Props {
  onSend: (text: string) => void;
  onClose: () => void;
  sessionTitle?: string;
  externalCreateCount?: number;
}

const STORAGE_KEY = "hermes-snapshot-log";
let snapshotCounter = 0;

function makeId() {
  return `snap-${Date.now()}-${++snapshotCounter}`;
}

function loadFromStorage(): Snapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SnapshotPanel({
  onSend,
  onClose,
  sessionTitle = "未命名会话",
  externalCreateCount = 0,
}: Props) {
  const [tab, setTab] = useState<"snapshot" | "background">("snapshot");
  const [snapshots, setSnapshots] = useState<Snapshot[]>(loadFromStorage);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [prevExternal, setPrevExternal] = useState(externalCreateCount);

  // Persist to localStorage on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
  }, [snapshots]);

  // Sync entries created via chat input (/snapshot create sent directly)
  useEffect(() => {
    if (externalCreateCount > prevExternal) {
      const delta = externalCreateCount - prevExternal;
      setSnapshots((prev) => {
        let next = prev;
        for (let i = 0; i < delta; i++) {
          next = [makeEntry(next.length + 1, sessionTitle), ...next];
        }
        return next;
      });
    }
    setPrevExternal(externalCreateCount);
  }, [externalCreateCount]);

  function makeEntry(index: number, title: string): Snapshot {
    return {
      id: makeId(),
      label: `快照 ${index}`,
      createdAt: new Date().toISOString(),
      sessionTitle: title,
      expanded: false,
    };
  }

  const handleSave = () => {
    setSnapshots((prev) => [makeEntry(prev.length + 1, sessionTitle), ...prev]);
    onSend("/snapshot create");
  };

  const toggleExpand = (id: string) => {
    setSnapshots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, expanded: !s.expanded } : s))
    );
  };

  const handleRestore = (id: string) => {
    if (confirmRestoreId === id) {
      setConfirmRestoreId(null);
      onSend(`/snapshot restore ${id}`);
    } else {
      setConfirmRestoreId(id);
      setConfirmDeleteId(null);
    }
  };

  const handleDelete = (id: string) => {
    if (confirmDeleteId === id) {
      setSnapshots((prev) => prev.filter((s) => s.id !== id));
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      setConfirmRestoreId(null);
    }
  };

  const cancelConfirm = () => {
    setConfirmRestoreId(null);
    setConfirmDeleteId(null);
  };

  return (
    <div className="right-panel">
      {/* Header */}
      <div className="right-panel-header">
        <div className="right-panel-tabs">
          <button
            className={`right-panel-tab ui-font${tab === "snapshot" ? " active" : ""}`}
            onClick={() => setTab("snapshot")}
          >
            快照
          </button>
          <button
            className={`right-panel-tab ui-font${tab === "background" ? " active" : ""}`}
            onClick={() => setTab("background")}
          >
            后台任务
          </button>
        </div>
        <button className="right-panel-close" onClick={onClose}>
          <Icon name="close" size={13} />
        </button>
      </div>

      {/* Snapshot tab */}
      {tab === "snapshot" && (
        <div className="right-panel-body">
          <button className="snapshot-save-btn ui-font" onClick={handleSave}>
            <Icon name="package" size={13} />
            保存快照
          </button>

          {/* Disclaimer */}
          <div className="snapshot-notice ui-font">
            仅为本地日志记录，不校验快照文件是否仍存在
          </div>

          {/* List */}
          {snapshots.length === 0 ? (
            <div className="snapshot-empty ui-font">暂无记录</div>
          ) : (
            <div className="snapshot-list">
              {snapshots.map((snap) => (
                <div key={snap.id} className="snapshot-item">
                  <div
                    className="snapshot-item-header"
                    onClick={() => toggleExpand(snap.id)}
                  >
                    <Icon
                      name="chevronRight"
                      size={11}
                      style={{
                        transform: snap.expanded ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform 0.15s",
                        flexShrink: 0,
                        color: "var(--muted-soft)",
                      }}
                    />
                    <div className="snapshot-item-meta">
                      <span className="snapshot-item-label ui-font">{snap.label}</span>
                      <span className="snapshot-item-session ui-font">{snap.sessionTitle}</span>
                    </div>
                    <span className="snapshot-item-time ui-font">
                      {formatDateTime(snap.createdAt)}
                    </span>
                  </div>

                  {snap.expanded && (
                    <div className="snapshot-item-body">
                      {/* Confirm states */}
                      {confirmRestoreId === snap.id && (
                        <div className="snapshot-confirm-row">
                          <span className="snapshot-confirm-label ui-font">确认恢复此快照？</span>
                          <button className="snapshot-action-btn snapshot-action-confirm ui-font" onClick={() => handleRestore(snap.id)}>确认</button>
                          <button className="snapshot-action-btn ui-font" onClick={cancelConfirm}>取消</button>
                        </div>
                      )}
                      {confirmDeleteId === snap.id && (
                        <div className="snapshot-confirm-row">
                          <span className="snapshot-confirm-label ui-font">删除此记录？</span>
                          <button className="snapshot-action-btn snapshot-action-danger ui-font" onClick={() => handleDelete(snap.id)}>删除</button>
                          <button className="snapshot-action-btn ui-font" onClick={cancelConfirm}>取消</button>
                        </div>
                      )}
                      {!confirmRestoreId && !confirmDeleteId && (
                        <div className="snapshot-item-actions">
                          <button className="snapshot-action-btn ui-font" onClick={() => handleRestore(snap.id)}>
                            恢复
                          </button>
                          <button className="snapshot-action-btn ui-font" onClick={() => handleDelete(snap.id)}>
                            删除记录
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Background tab placeholder */}
      {tab === "background" && (
        <div className="right-panel-body">
          <div className="snapshot-empty ui-font">后台任务功能即将推出</div>
        </div>
      )}
    </div>
  );
}
