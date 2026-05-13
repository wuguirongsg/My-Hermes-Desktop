import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import Icon from "../components/Icon";

const DASHBOARD_URL = "http://127.0.0.1:9119";
const INSTALL_CMD = "curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash";

type Status = "idle" | "starting" | "ready" | "error" | "missing";

export default function DashboardPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);

  const start = useCallback(async () => {
    setStatus("starting");
    setErrorMsg("");
    try {
      const result = await invoke<string>("dashboard_start");
      if (result === "ready") {
        setStatus("ready");
      } else {
        setStatus("error");
        setErrorMsg(result);
      }
    } catch (e: unknown) {
      const msg = String(e);
      if (msg.includes("start_failed") || msg.includes("No such file")) {
        setStatus("missing");
      } else if (msg.includes("timeout")) {
        setStatus("error");
        setErrorMsg("Dashboard 启动超时，请检查 hermes-agent 是否正确安装");
      } else {
        setStatus("error");
        setErrorMsg(msg);
      }
    }
  }, []);

  // Auto-start when page mounts
  useEffect(() => { start(); }, [start]);

  const copyCmd = () => {
    navigator.clipboard?.writeText(INSTALL_CMD).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  // ── Loading ──
  if (status === "idle" || status === "starting") {
    return (
      <div className="dashboard-loading">
        <span className="loading-dots" style={{ fontSize: 20 }} />
        <div className="dashboard-loading-text ui-font">正在启动 Dashboard…</div>
      </div>
    );
  }

  // ── Missing dependency ──
  if (status === "missing") {
    return (
      <div className="dashboard-guide">
        <div className="dashboard-guide-icon">
          <Icon name="package" size={34} />
        </div>
        <div className="dashboard-guide-title ui-font">需要安装 Dashboard 依赖</div>
        <div className="dashboard-guide-desc">
          运行以下命令安装，完成后点击"重试"。
        </div>
        <div className="dashboard-guide-cmd">
          <code>{INSTALL_CMD}</code>
          <button className="guide-copy-btn ui-font" onClick={copyCmd}>
            {copied && <Icon name="check" size={12} />}
            {copied ? "已复制" : "复制"}
          </button>
        </div>
        <button className="guide-retry-btn ui-font" onClick={start}>重试</button>
      </div>
    );
  }

  // ── Error ──
  if (status === "error") {
    return (
      <div className="dashboard-guide">
        <div className="dashboard-guide-icon error">
          <Icon name="alert" size={34} />
        </div>
        <div className="dashboard-guide-title ui-font">Dashboard 启动失败</div>
        <div className="dashboard-guide-desc" style={{ color: "var(--error)" }}>
          {errorMsg}
        </div>
        <button className="guide-retry-btn ui-font" onClick={start}>重试</button>
      </div>
    );
  }

  // ── Ready: show iframe ──
  return (
    <iframe
      className="dashboard-iframe"
      src={DASHBOARD_URL}
      title="Hermes Dashboard"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  );
}
