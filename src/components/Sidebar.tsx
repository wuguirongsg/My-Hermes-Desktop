import { Session } from "../types";
import Icon from "./Icon";

interface Props {
  sessions: Session[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
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

export default function Sidebar({ sessions, activeId, onSelect, onNew, onDelete }: Props) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title ui-font">Sessions</span>
        <button
          className="btn-new-session"
          onClick={onNew}
          title="New Session"
        >
          +
        </button>
      </div>

      <div className="session-list">
        {sessions.length === 0 && (
          <div style={{ padding: "16px 12px", color: "var(--muted)", fontSize: 11 }}>
            No sessions yet.
            <br />
            Start a conversation!
          </div>
        )}

        {sessions.map((s) => (
          <div
            key={s.id}
            className={`session-item ${activeId === s.id ? "active" : ""}`}
            onClick={() => onSelect(s.id)}
          >
            <div className="session-item-title">{s.title || "Untitled"}</div>
            <div className="session-item-meta">
              <span>{formatDate(s.updated_at)}</span>
              {s.message_count !== undefined && (
                <span>{s.message_count} msgs</span>
              )}
              {s.cost !== undefined && s.cost > 0 && (
                <span>${s.cost.toFixed(3)}</span>
              )}
            </div>
            <button
              className="session-delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(s.id);
              }}
              title="Delete session"
            >
              <Icon name="close" size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "8px 12px",
          borderTop: "1px solid var(--hairline)",
          fontSize: 10,
          color: "var(--muted)",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {sessions.length} session{sessions.length !== 1 ? "s" : ""}
        {" · "}~/.hermes/
      </div>
    </div>
  );
}
