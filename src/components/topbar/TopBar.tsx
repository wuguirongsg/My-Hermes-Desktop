import { HermesStatus } from "../../types";
import Icon from "../Icon";
import ContextBar from "./ContextBar";
import ModelPicker from "./ModelPicker";

interface Props {
  streaming: boolean;
  status: HermesStatus | null;
  hermesVersion: string;
  toolCallCount: number;
  onOpenTerminal: () => void;
  onSendMessage: (text: string) => void;
  onNewSession: () => void;
}

export default function TopBar({ streaming, status, hermesVersion, toolCallCount, onOpenTerminal, onSendMessage, onNewSession }: Props) {
  const handleCompress = (focus: string) => {
    const cmd = focus ? `/compress ${focus}` : "/compress";
    onSendMessage(cmd);
  };

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
