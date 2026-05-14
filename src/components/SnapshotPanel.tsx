import { useState } from "react";
import Icon from "./Icon";

interface SnapshotFile {
  path: string;
  added: number;
  removed: number;
}

interface Snapshot {
  id: string;
  label: string;
  createdAt: string;
  files: SnapshotFile[];
  expanded: boolean;
}

interface Props {
  onSend: (text: string) => void;
  onClose: () => void;
}

let snapshotCounter = 0;

function makeId() {
  return `snap-${Date.now()}-${++snapshotCounter}`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

export default function SnapshotPanel({ onSend, onClose }: Props) {
  const [tab, setTab] = useState<"snapshot" | "background">("snapshot");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rollbackFiles, setRollbackFiles] = useState<SnapshotFile[] | null>(null);

  const handleSave = () => {
    const id = makeId();
    const now = new Date().toISOString();
    const newSnap: Snapshot = {
      id,
      label: `快照 ${snapshots.length + 1}`,
      createdAt: now,
      files: [],
      expanded: false,
    };
    setSnapshots((prev) => [newSnap, ...prev]);
    onSend("/snapshot create");
  };

  const toggleExpand = (id: string) => {
    setSnapshots((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, expanded: !s.expanded } : s
      )
    );
  };

  const handleRestore = (id: string) => {
    if (confirmId === id) {
      setConfirmId(null);
      onSend(`/snapshot restore ${id}`);
    } else {
      setConfirmId(id);
    }
  };

  const handleRollback = () => {
    // Optimistic: show placeholder changed files
    const placeholder: SnapshotFile[] = [
      { path: "src/components/ChatView.tsx", added: 0, removed: 12 },
      { path: "src/index.css", added: 0, removed: 45 },
    ];
    setRollbackFiles(placeholder);
    onSend("/rollback");
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
          <div className="snapshot-toolbar">
            <button className="snapshot-save-btn ui-font" onClick={handleSave}>
              <Icon name="package" size={13} />
              保存快照
            </button>
            {snapshots.length > 0 && (
              <button className="snapshot-rollback-btn ui-font" onClick={handleRollback}>
                回滚
              </button>
            )}
          </div>

          {/* Rollback result */}
          {rollbackFiles && (
            <div className="snapshot-rollback-result">
              <div className="snapshot-rollback-title ui-font">
                <Icon name="refresh" size={12} />
                回滚变更文件
              </div>
              {rollbackFiles.map((f) => (
                <div key={f.path} className="snapshot-file-row">
                  <span className="snapshot-file-path">{f.path}</span>
                  <span className="snapshot-file-stat removed">−{f.removed}</span>
                </div>
              ))}
              <button
                className="snapshot-dismiss-btn ui-font"
                onClick={() => setRollbackFiles(null)}
              >
                关闭
              </button>
            </div>
          )}

          {/* Snapshot list */}
          {snapshots.length === 0 ? (
            <div className="snapshot-empty ui-font">
              暂无快照，点击上方按钮保存当前状态
            </div>
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
                    <span className="snapshot-item-label ui-font">{snap.label}</span>
                    <span className="snapshot-item-time ui-font">
                      {formatDate(snap.createdAt)} {formatTime(snap.createdAt)}
                    </span>
                  </div>

                  {snap.expanded && (
                    <div className="snapshot-item-body">
                      {snap.files.length === 0 ? (
                        <div className="snapshot-files-empty ui-font">
                          无文件变更记录
                        </div>
                      ) : (
                        snap.files.map((f) => (
                          <div key={f.path} className="snapshot-file-row">
                            <span className="snapshot-file-path">{f.path}</span>
                            {f.added > 0 && (
                              <span className="snapshot-file-stat added">+{f.added}</span>
                            )}
                            {f.removed > 0 && (
                              <span className="snapshot-file-stat removed">−{f.removed}</span>
                            )}
                          </div>
                        ))
                      )}
                      <div className="snapshot-item-actions">
                        {confirmId === snap.id ? (
                          <>
                            <span className="snapshot-confirm-label ui-font">确认恢复？</span>
                            <button
                              className="snapshot-action-btn snapshot-action-confirm ui-font"
                              onClick={() => handleRestore(snap.id)}
                            >
                              确认
                            </button>
                            <button
                              className="snapshot-action-btn ui-font"
                              onClick={() => setConfirmId(null)}
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <button
                            className="snapshot-action-btn ui-font"
                            onClick={() => handleRestore(snap.id)}
                          >
                            恢复此快照
                          </button>
                        )}
                      </div>
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
          <div className="snapshot-empty ui-font">
            后台任务功能即将推出
          </div>
        </div>
      )}
    </div>
  );
}
