import { useEffect, useRef, useState } from "react";
import { HermesStatus } from "../../types";
import Icon from "../Icon";
import ContextBar from "./ContextBar";
import ModelPicker from "./ModelPicker";
import ReasoningPicker from "./ReasoningPicker";

interface Props {
  streaming: boolean;
  status: HermesStatus | null;
  hermesVersion: string;
  tokenDisplay: { input: string; output: string } | null;
  showTools: boolean;
  onToggleTools: () => void;
  compareView: boolean;
  onToggleCompareView: () => void;
  showThink: boolean;
  onToggleThink: () => void;
  sessionTitle: string | null;
  onOpenTerminal: () => void;
  onOpenSnapshot: () => void;
  onSendMessage: (text: string) => void;
  onNewSession: () => void;
  onRenameSession: (title: string) => Promise<boolean>;
  goalActive?: boolean;
}

export default function TopBar({
  streaming,
  status,
  hermesVersion,
  tokenDisplay,
  showTools,
  onToggleTools,
  compareView,
  onToggleCompareView,
  showThink,
  onToggleThink,
  sessionTitle,
  onOpenTerminal,
  onOpenSnapshot,
  onSendMessage,
  onNewSession,
  onRenameSession,
  goalActive = false,
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

      {/* Token usage */}
      {tokenDisplay && (
        <div className="status-pill" title="输入 / 输出 Token 估算">
          <span className="label">Token</span>
          <span className="value">{tokenDisplay.input}</span>
          <span className="token-sep">/</span>
          <span className="value muted">{tokenDisplay.output}</span>
        </div>
      )}

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

      <div className="topbar-divider" />

      <ReasoningPicker onNewSession={onNewSession} />

      <div className="topbar-spacer" />

      {/* Goal button — only shown when no active goal */}
      {!goalActive && (
        <button
          className="topbar-terminal-btn"
          onClick={() => window.dispatchEvent(new Event("open-goal-input"))}
          title="设置持久目标"
        >
          <Icon name="flag" size={14} />
          目标
        </button>
      )}

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

      {/* Think blocks toggle */}
      <button
        className={`app-titlebar-icon-btn topbar-tools-toggle${showThink ? " active" : ""}`}
        onClick={onToggleThink}
        title={showThink ? "隐藏思考过程" : "显示思考过程"}
        aria-pressed={showThink}
      >
        <Icon name="brain" size={13} />
      </button>

      {/* Tool calls toggle — subtle icon only */}
      <button
        className={`app-titlebar-icon-btn topbar-tools-toggle${showTools ? " active" : ""}`}
        onClick={onToggleTools}
        title={showTools ? "隐藏工具调用" : "显示工具调用"}
        aria-pressed={showTools}
      >
        <Icon name="tool" size={13} />
      </button>

      {/* Conversation compare view toggle */}
      <button
        className={`app-titlebar-icon-btn topbar-tools-toggle${compareView ? " active" : ""}`}
        onClick={onToggleCompareView}
        title={compareView ? "切回普通对话视图" : "切换为左右对比视图"}
        aria-pressed={compareView}
      >
        <Icon name="columns" size={13} />
      </button>
    </div>
  );
}
