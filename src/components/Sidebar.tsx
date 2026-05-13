import { useState, useEffect, useRef } from "react";
import { Session } from "../types";
import Icon from "./Icon";

interface Props {
  sessions: Session[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => Promise<boolean>;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
    return `${Math.floor(diff / 86400_000)}d ago`;
  } catch {
    return "";
  }
}

export default function Sidebar({ sessions, activeId, onSelect, onNew, onDelete, onRename }: Props) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cancelEditRef = useRef(false);

  const requestDelete = (id: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPendingId(id);
    timerRef.current = setTimeout(() => setPendingId(null), 3000);
  };

  const confirmDelete = (id: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPendingId(null);
    onDelete(id);
  };

  const cancelDelete = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPendingId(null);
  };

  const startEdit = (session: Session) => {
    cancelDelete();
    cancelEditRef.current = false;
    setEditingId(session.id);
    setEditValue(session.title || "Untitled");
  };

  const finishEdit = async () => {
    const id = editingId;
    if (!id) return;
    if (cancelEditRef.current) {
      cancelEditRef.current = false;
      setEditingId(null);
      return;
    }

    const session = sessions.find((s) => s.id === id);
    const nextTitle = editValue.trim();
    const currentTitle = (session?.title || "Untitled").trim();
    setEditingId(null);

    if (!nextTitle || nextTitle === currentTitle) return;

    setSavingId(id);
    await onRename(id, nextTitle);
    setSavingId((current) => (current === id ? null : current));
  };

  useEffect(() => {
    if (editingId) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingId]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title ui-font">Sessions</span>
        <button className="btn-new-session" onClick={onNew} title="New Session">+</button>
      </div>

      <div className="session-list">
        {sessions.length === 0 && (
          <div style={{ padding: "16px 12px", color: "var(--muted)", fontSize: 11 }}>
            No sessions yet.<br />Start a conversation!
          </div>
        )}

        {sessions.map((s) => (
          <div
            key={s.id}
            className={`session-item ${activeId === s.id ? "active" : ""} ${savingId === s.id ? "saving" : ""}`}
            onClick={() => {
              if (editingId === s.id) return;
              if (pendingId === s.id) cancelDelete();
              else onSelect(s.id);
            }}
          >
            {editingId === s.id ? (
              <input
                ref={inputRef}
                className="session-title-input"
                value={editValue}
                maxLength={120}
                onChange={(e) => setEditValue(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onBlur={() => { void finishEdit(); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelEditRef.current = true;
                    setEditingId(null);
                  }
                }}
                aria-label="Edit session title"
              />
            ) : (
              <div
                className="session-item-title"
                onClick={(e) => {
                  e.stopPropagation();
                  startEdit(s);
                }}
                title="编辑会话标题"
              >
                {s.title || "Untitled"}
              </div>
            )}
            <div className="session-item-meta">
              <span>{formatDate(s.updated_at)}</span>
              {s.message_count !== undefined && <span>{s.message_count} msgs</span>}
              {s.cost !== undefined && s.cost > 0 && <span>${s.cost.toFixed(3)}</span>}
            </div>

            {pendingId === s.id ? (
              <div className="session-delete-confirm" onClick={(e) => e.stopPropagation()}>
                <span className="session-delete-label">删除?</span>
                <button
                  className="session-delete-yes"
                  onClick={() => confirmDelete(s.id)}
                  title="确认删除"
                >
                  <Icon name="check" size={11} />
                </button>
                <button
                  className="session-delete-no"
                  onClick={cancelDelete}
                  title="取消"
                >
                  <Icon name="close" size={11} />
                </button>
              </div>
            ) : (
              <button
                className="session-delete"
                onClick={(e) => { e.stopPropagation(); requestDelete(s.id); }}
                title="删除会话"
              >
                <Icon name="close" size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{
        padding: "8px 12px",
        borderTop: "1px solid var(--hairline)",
        fontSize: 10,
        color: "var(--muted)",
        fontFamily: "'Inter', sans-serif",
      }}>
        {sessions.length} session{sessions.length !== 1 ? "s" : ""}{" · "}~/.hermes/
      </div>
    </div>
  );
}
