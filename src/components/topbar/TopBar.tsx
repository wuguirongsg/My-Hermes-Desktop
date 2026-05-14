import { useEffect, useRef, useState } from "react";
import { HermesStatus } from "../../types";
import Icon from "../Icon";
import ContextBar from "./ContextBar";
import ModelPicker from "./ModelPicker";

interface Props {
  streaming: boolean;
  status: HermesStatus | null;
  hermesVersion: string;
  toolCallCount: number;
  sessionTitle: string | null;
  onOpenTerminal: () => void;
  onOpenSnapshot: () => void;
  onSendMessage: (text: string) => void;
  onNewSession: () => void;
  onRenameSession: (title: string) => Promise<boolean>;
}

export default function TopBar({
  streaming,
  status,
  hermesVersion,
  toolCallCount,
  sessionTitle,
  onOpenTerminal,
  onOpenSnapshot,
  onSendMessage,
  onNewSession,
  onRenameSession,
}: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const cancelTitleEditRef = useRef(false);
  const displayTitle = sessionTitle?.trim() || "New session";
  const canEditTitle = Boolean(sessionTitle);

  const handleCompress = (focus: string) => {
    const cmd = focus ? `/compress ${focus}` : "/compress";
    onSendMessage(cmd);
  };

  const startTitleEdit = () => {
    if (!canEditTitle) return;
    cancelTitleEditRef.current = false;
    setDraftTitle(displayTitle);
    setEditingTitle(true);
  };

  const finishTitleEdit = async () => {
    if (!editingTitle) return;
    if (cancelTitleEditRef.current) {
      cancelTitleEditRef.current = false;
      setEditingTitle(false);
      return;
    }

    const nextTitle = draftTitle.trim();
    setEditingTitle(false);
    if (!nextTitle || nextTitle === displayTitle) return;

    setSavingTitle(true);
    await onRenameSession(nextTitle);
    setSavingTitle(false);
  };

  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editingTitle]);

  return (
    <div className="topbar">
      {/* Logo */}
      <div className="topbar-logo">
        <span className="brand-mark" aria-hidden="true">
          <Icon name="spark" size={15} />
        </span>
        <span className="topbar-logo-name">Hermes</span>
        <span className="topbar-logo-sub">Desktop</span>
      </div>

      <div className="topbar-divider" />

      {/* Current session title */}
      <div className={`topbar-session-title ${savingTitle ? "saving" : ""}`}>
        {editingTitle ? (
          <input
            ref={titleInputRef}
            className="topbar-session-title-input"
            value={draftTitle}
            maxLength={120}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={() => { void finishTitleEdit(); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancelTitleEditRef.current = true;
                setEditingTitle(false);
              }
            }}
            aria-label="Edit current session title"
          />
        ) : (
          <>
            <span className={canEditTitle ? "topbar-session-title-text" : "topbar-session-title-text muted"}>
              {displayTitle}
            </span>
            {canEditTitle && (
              <button
                className="topbar-title-edit-btn"
                onClick={startTitleEdit}
                title="编辑当前会话标题"
              >
                <Icon name="edit" size={12} />
              </button>
            )}
          </>
        )}
      </div>

      <div className="topbar-divider" />

      {/* Agent state */}
      <div className="status-pill">
        <div
          className={`hermes-indicator ${streaming ? "streaming" : "idle"}`}
          title={streaming ? "Agent is running..." : "Ready"}
        />
        <span className="label">{streaming ? "Running" : "Ready"}</span>
      </div>

      <div className="topbar-divider" />

      {/* Model picker */}
      <ModelPicker currentModel={status?.model} onNewSession={onNewSession} />

      <div className="topbar-divider" />

      {/* Tool call steps */}
      <div className="status-pill">
        <span className="label">Steps</span>
        <span className="value">{toolCallCount > 0 ? toolCallCount : "—"}</span>
      </div>

      {/* Cost */}
      {status?.cost && (
        <>
          <div className="topbar-divider" />
          <div className="status-pill">
            <span className="label">Cost</span>
            <span className="amber">{status.cost}</span>
          </div>
        </>
      )}

      {/* Duration */}
      {status?.duration && (
        <>
          <div className="topbar-divider" />
          <div className="status-pill">
            <Icon name="timer" size={13} className="status-icon" />
            <span className="value">{status.duration}</span>
          </div>
        </>
      )}

      <div className="topbar-divider" />

      {/* Context progress bar + compress trigger (feat-003/004) */}
      <ContextBar status={status} onCompress={handleCompress} />

      <div className="topbar-spacer" />

      {/* Snapshot button */}
      <button
        className="topbar-terminal-btn"
        onClick={onOpenSnapshot}
        title="快照时间线"
      >
        <Icon name="timer" size={14} />
        快照
      </button>

      {/* Terminal button */}
      <button
        className="topbar-terminal-btn"
        onClick={onOpenTerminal}
        title="打开 Hermes 交互终端（支持 slash 命令）"
      >
        <Icon name="terminal" size={14} />
        Terminal
      </button>

      {/* Hermes version */}
      {hermesVersion && (
        <div className="status-pill">
          <span className="label" style={{ fontSize: 10 }}>
            {hermesVersion.split("\n")[0].slice(0, 28)}
          </span>
        </div>
      )}
    </div>
  );
}
