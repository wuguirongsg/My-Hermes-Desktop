import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Icon from "../components/Icon";

export interface HermesSetupStatus {
  installed: boolean;
  version: string;
  hermes_home: string;
  config_exists: boolean;
  api_key_configured: boolean;
  configured_providers: string[];
  error: string;
}

const INSTALL_CMD = "curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash";
const SETUP_CMD = "hermes setup";

async function writeClipboardText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back below for WebViews or browser contexts without clipboard grants.
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "true");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textArea);
  }
}

interface Props {
  setup: HermesSetupStatus | null;
  checking: boolean;
  onRetry: () => void;
  onContinue?: () => void;
}

export default function OnboardingPage({ setup, checking, onRetry, onContinue }: Props) {
  const [copiedCommand, setCopiedCommand] = useState<"install" | "setup" | null>(null);
  const [terminalError, setTerminalError] = useState("");

  const copyCommand = async (kind: "install" | "setup", command: string) => {
    setTerminalError("");
    const ok = await writeClipboardText(command);
    if (ok) {
      setCopiedCommand(kind);
      window.setTimeout(() => setCopiedCommand(null), 1800);
    } else {
      setTerminalError("复制失败，请手动选择安装命令复制。");
    }
  };

  const openTerminal = async (command: "open_install_terminal" | "open_setup_terminal") => {
    setTerminalError("");
    try {
      await invoke(command);
    } catch (e) {
      setTerminalError(String(e));
    }
  };

  const providerText = setup?.configured_providers.length
    ? setup.configured_providers.join(" / ")
    : "尚未检测到";

  return (
    <div className="onboarding-page">
      <section className="onboarding-hero">
        <div className="onboarding-mark">
          <Icon name="spark" size={30} />
        </div>
        <div className="onboarding-copy">
          <p className="onboarding-kicker ui-font">Hermes Desktop</p>
          <h1 className="onboarding-title">开始使用 Hermes</h1>
          <p className="onboarding-subtitle">
            桌面端会先确认 Hermes CLI 可用。按官方步骤完成安装和配置后，就可以直接进入对话。
          </p>
        </div>
      </section>

      <section className="onboarding-steps" aria-label="首次使用引导">
        <article className="onboarding-step active">
          <div className="onboarding-step-index">1</div>
          <div className="onboarding-step-body">
            <h2>安装 Hermes CLI</h2>
            <p>运行安装命令。完成后回到这里重新检测。</p>
            <div className="onboarding-command">
              <code>{INSTALL_CMD}</code>
              <button className="guide-copy-btn ui-font" onClick={() => copyCommand("install", INSTALL_CMD)}>
                {copiedCommand === "install" && <Icon name="check" size={12} />}
                {copiedCommand === "install" ? "已复制" : "复制"}
              </button>
            </div>
            <button className="onboarding-secondary-btn ui-font" onClick={() => openTerminal("open_install_terminal")}>
              <Icon name="terminal" size={14} />
              在终端中打开
            </button>
            {terminalError && <p className="onboarding-error">{terminalError}</p>}
          </div>
        </article>

        <article className="onboarding-step">
          <div className="onboarding-step-index">2</div>
          <div className="onboarding-step-body">
            <h2>配置 Hermes</h2>
            <p>
              安装完成后运行官方配置向导，选择 provider、模型和 API Key。
            </p>
            <div className="onboarding-command">
              <code>{SETUP_CMD}</code>
              <button className="guide-copy-btn ui-font" onClick={() => copyCommand("setup", SETUP_CMD)}>
                {copiedCommand === "setup" && <Icon name="check" size={12} />}
                {copiedCommand === "setup" ? "已复制" : "复制"}
              </button>
            </div>
            <button className="onboarding-secondary-btn ui-font" onClick={() => openTerminal("open_setup_terminal")}>
              <Icon name="terminal" size={14} />
              打开配置向导
            </button>
            <div className="onboarding-status-row">
              <span>当前检测</span>
              <strong>{providerText}</strong>
            </div>
          </div>
        </article>

        <article className="onboarding-step">
          <div className="onboarding-step-index">3</div>
          <div className="onboarding-step-body">
            <h2>进入对话</h2>
            <p>检测到 Hermes 后会自动进入主界面。之后启动应用时会直接打开对话。</p>
            <div className={`onboarding-check ${setup?.installed ? "ok" : ""}`}>
              {setup?.installed ? <Icon name="check" size={14} /> : <Icon name="alert" size={14} />}
              <span>{setup?.installed ? `已安装 ${setup.version}` : setup?.error || "等待检测"}</span>
            </div>
          </div>
        </article>
      </section>

      <div className="onboarding-actions">
        <button
          className="guide-retry-btn ui-font"
          onClick={setup?.installed && onContinue ? onContinue : onRetry}
          disabled={checking}
        >
          {checking ? "检测中..." : setup?.installed && onContinue ? "进入对话" : "我已完成，重新检测"}
        </button>
      </div>
    </div>
  );
}
