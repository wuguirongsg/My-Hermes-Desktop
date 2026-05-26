import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";
import { Message, ToolCallBlock } from "../../types";
import Icon from "../Icon";

// ─── Think Block ──────────────────────────────────────────────────────────────

function ThinkBlock({ content }: { content: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="think-block fade-in">
      <div className="think-header" onClick={() => setOpen((o) => !o)}>
        <Icon name="brain" size={13} className="think-icon" />
        <span className="think-label ui-font">Thinking</span>
        {content && (
          <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 4 }}>
            {content.split(/\s+/).length} words
          </span>
        )}
        <Icon name="chevronRight" size={13} className={`think-chevron ${open ? "open" : ""}`} />
      </div>
      {open && (
        <div className="think-body selectable">
          {content || <span className="loading-dots" />}
        </div>
      )}
    </div>
  );
}

// ─── Tool Call Block ──────────────────────────────────────────────────────────

function ToolBlock({ block }: { block: ToolCallBlock }) {
  const [open, setOpen] = useState(false);

  const prettyJson = (s: string) => {
    try {
      return JSON.stringify(JSON.parse(s), null, 2);
    } catch {
      return s;
    }
  };

  return (
    <div className="tool-block fade-in">
      <div className="tool-header" onClick={() => setOpen((o) => !o)}>
        <Icon name="tool" size={13} className="tool-icon" />
        <span className="tool-name ui-font">{block.name}</span>
        {!block.outputDone && !open && (
          <span style={{ fontSize: 10, color: "var(--muted)" }} className="loading-dots" />
        )}
        {block.outputDone && (
          <span className="tool-badge">done</span>
        )}
        <Icon name="chevronRight" size={13} className={`tool-chevron ${open ? "open" : ""}`} />
      </div>
      {open && (
        <div className="tool-body">
          {block.input && (
            <div className="tool-section input selectable">
              <div className="tool-section-label">Input</div>
              <pre style={{ margin: 0, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                {prettyJson(block.input)}
              </pre>
            </div>
          )}
          {block.output && (
            <div className="tool-section output selectable">
              <div className="tool-section-label">Output</div>
              <pre style={{ margin: 0, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                {block.output}
              </pre>
            </div>
          )}
          {!block.input && !block.output && (
            <div className="tool-section input" style={{ color: "var(--muted)", fontStyle: "italic" }}>
              Executing<span className="loading-dots" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Text Block ───────────────────────────────────────────────────────────────

const mdComponents = {
  a: ({ href, children }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        if (href) openUrl(href);
      }}
    >
      {children}
    </a>
  ),
};

function TextBlock({ content, streaming }: { content: string; streaming: boolean }) {
  return (
    <div className="md-content selectable">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{content}</ReactMarkdown>
      {streaming && <span className="cursor-blink" />}
    </div>
  );
}

type TerminalLineTone =
  | "command"
  | "success"
  | "error"
  | "warning"
  | "agent"
  | "border"
  | "muted"
  | "output";

function getTerminalLineTone(line: string): TerminalLineTone {
  const trimmed = line.trim();
  if (!trimmed) return "muted";
  if (/[$❯]\s+\S/.test(line) || /^[┊│]\s*[$❯]/.test(trimmed)) return "command";
  if (/[✔✓]\s|success|completed|done/i.test(trimmed)) return "success";
  if (/[✖✗]\s|error|failed|panic|denied/i.test(trimmed)) return "error";
  if (/[!?]\s|warning|warn|preparing|clarify/i.test(trimmed)) return "warning";
  if (/Hermes|HERMES|assistant|responding/i.test(trimmed)) return "agent";
  if (/^[╭╰╮╯┌└┐┘├┤┬┴┼─│┊\s]+$/.test(trimmed) || /^[╭╰┌└]/.test(trimmed)) return "border";
  if (/^\d+(\.\d+)?s$/.test(trimmed) || /^[:│┊]+$/.test(trimmed)) return "muted";
  return "output";
}

function renderTerminalContent(content: string, error: boolean) {
  const text = content || "Starting Hermes...";
  return text.split("\n").map((line, index, lines) => (
    <span
      key={`${index}-${line.slice(0, 16)}`}
      className={`terminal-line tone-${error ? "error" : getTerminalLineTone(line)}`}
    >
      {line || " "}
      {index < lines.length - 1 ? "\n" : ""}
    </span>
  ));
}

function TerminalOutput({ content, error }: { content: string; error: boolean }) {
  return (
    <div className={`stream-terminal selectable ${error ? "error" : ""}`}>
      <div className="stream-terminal-header ui-font">
        <span className="stream-terminal-dot" />
        <span>{error ? "Hermes exited with an error" : "Hermes is responding"}</span>
        {!error && <span className="stream-terminal-live">live</span>}
      </div>
      <pre className="stream-terminal-body">
        {renderTerminalContent(content, error)}
        {!error && <span className="cursor-blink" />}
      </pre>
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

interface Props {
  message: Message;
  isLastAssistant: boolean;
  streaming: boolean;
  showTools?: boolean;
  showThink?: boolean;
  onRetry: () => void;
  model?: string | null;
  memoryLoaded?: boolean | null;
  assistantIndex?: number;
  messageIndex?: number;
}

function GroundingPopover({
  model,
  memoryLoaded,
  assistantIndex,
  anchorRect,
  onClose,
}: {
  model?: string | null;
  memoryLoaded?: boolean | null;
  assistantIndex?: number;
  anchorRect: DOMRect;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return createPortal(
    <div
      className="grounding-popover"
      ref={ref}
      style={{ position: "fixed", top: anchorRect.bottom + 4, left: anchorRect.left }}
    >
      <div className="grounding-row">
        <span className="grounding-label">模型</span>
        <span className="grounding-value">{model ?? "未知"}</span>
      </div>
      {assistantIndex !== undefined && (
        <div className="grounding-row">
          <span className="grounding-label">消息序号</span>
          <span className="grounding-value">第 {assistantIndex} 条回复</span>
        </div>
      )}
      <div className="grounding-row">
        <span className="grounding-label">个人记忆</span>
        <span className={`grounding-value ${memoryLoaded ? "ctx-memory-ok" : "ctx-memory-none"}`}>
          {memoryLoaded === true ? "已加载" : memoryLoaded === false ? "未配置" : "未知"}
        </span>
      </div>
    </div>,
    document.body
  );
}

function formatTime(iso: string): string {
  try {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function messageToMarkdown(message: Message): string {
  const parts = message.blocks
    .filter((block) => block.type === "text")
    .map((block) => block.content.trim())
    .filter(Boolean);

  if (parts.length > 0) return parts.join("\n\n");
  return message.rawOutput?.trim() ?? "";
}

function toSpokenText(markdown: string): string {
  let text = markdown
    .replace(/```[\s\S]*?```/g, "（代码块已省略）")
    .replace(/`[^`\n]+`/g, (m) => m.slice(1, -1))
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/^[-*_]{3,}$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const words = text.split(/\s+/);
  if (words.length > 150) {
    text = words.slice(0, 150).join(" ") + "……内容已截断";
  }
  return text;
}

export default function MessageBubble({ message, isLastAssistant, streaming, showTools = true, showThink = true, onRetry, model, memoryLoaded, assistantIndex }: Props) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [groundingAnchor, setGroundingAnchor] = useState<DOMRect | null>(null);
  const groundingBtnRef = useRef<HTMLButtonElement>(null);
  const isUser = message.role === "user";

  const isStreaming = isLastAssistant && message.status === "streaming";
  const isLiveTerminal = !isUser && (isStreaming || message.status === "error");
  // A message is "invisible" when every block it contains is hidden by the
  // current showTools / showThink settings. Live terminal and error messages
  // must always show so the user sees streaming output and errors.
  const allBlocksHidden =
    message.blocks.length > 0 &&
    message.blocks.every((b) => {
      if (b.type === "tool") return !showTools;
      if (b.type === "think") return !showThink;
      return false;
    });
  if (allBlocksHidden && !isLiveTerminal) return null;
  const showCopy = !isUser && !isStreaming && message.status === "done";
  const showRetry = isLastAssistant && !streaming && message.status === "done";

  const copyMarkdown = async () => {
    const markdown = messageToMarkdown(message);
    if (!markdown) return;
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const speakMessage = async () => {
    if (speaking) {
      try { await invoke("stop_speak"); } catch { /* ignore */ }
      setSpeaking(false);
      return;
    }
    const raw = messageToMarkdown(message);
    if (!raw) return;
    const text = toSpokenText(raw);
    setSpeaking(true);
    try {
      await invoke("speak_text", { text });
    } catch (e) {
      console.error("speak_text failed:", e);
    } finally {
      window.setTimeout(() => setSpeaking(false), 1500);
    }
  };

  if (isUser) {
    const text = message.blocks
      .filter((b) => b.type === "text")
      .map((b) => b.content)
      .join("\n");
    const images = message.blocks.filter((b) => b.type === "image");
    return (
      <div className="message-group" style={{ alignItems: "flex-end" }}>
        <div className="message-header" style={{ justifyContent: "flex-end" }}>
          <span className="message-time">{formatTime(message.timestamp)}</span>
          <span className="message-role user ui-font">You</span>
        </div>
        <div className="message-bubble user selectable">
          {images.length > 0 && (
            <div className="message-images">
              {images.map((img, i) => (
                <img
                  key={i}
                  src={img.dataUrl}
                  alt={img.filename ?? `image-${i}`}
                  className="message-image"
                />
              ))}
            </div>
          )}
          {text && <div style={{ whiteSpace: "pre-wrap" }}>{text}</div>}
        </div>
      </div>
    );
  }

  const hasContent = message.blocks.length > 0;
  const showTerminal = isLiveTerminal;

  return (
    <div className="message-group fade-in">
      <div className="message-header">
        <span className="message-role assistant ui-font">
          <Icon name="spark" size={12} />
          Hermes
        </span>
        <span className="message-time">{formatTime(message.timestamp)}</span>
        {message.status === "error" && (
          <span style={{ fontSize: 10, color: "var(--error)" }}>error</span>
        )}
        {message.status === "done" && (
          <>
            <button
              ref={groundingBtnRef}
              className="grounding-btn ui-font"
              onClick={() =>
                setGroundingAnchor((prev) =>
                  prev ? null : groundingBtnRef.current!.getBoundingClientRect()
                )
              }
              title="查看上下文来源"
            >
              ⓘ
            </button>
            {groundingAnchor && (
              <GroundingPopover
                model={model}
                memoryLoaded={memoryLoaded}
                assistantIndex={assistantIndex}
                anchorRect={groundingAnchor}
                onClose={() => setGroundingAnchor(null)}
              />
            )}
          </>
        )}
        {(showCopy || showRetry) && (
          <div className="message-actions">
            {showRetry && (
              <button className="message-action-btn" onClick={onRetry} title="重试这一轮">
                <Icon name="refresh" size={12} />
                重试
              </button>
            )}
            {showCopy && (
              <button
                className={`message-action-btn${speaking ? " speaking" : ""}`}
                onClick={speakMessage}
                title={speaking ? "点击停止朗读" : "朗读回复"}
              >
                <Icon name="volume" size={12} />
                {speaking ? "停止" : "朗读"}
              </button>
            )}
            {showCopy && (
              <button className="message-action-btn" onClick={copyMarkdown} title="复制为 Markdown">
                <Icon name="copy" size={12} />
                {copied ? "已复制" : "复制"}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="message-bubble assistant">
        {showTerminal ? (
          <TerminalOutput
            content={message.rawOutput ?? ""}
            error={message.status === "error"}
          />
        ) : (
          <>
            {!hasContent && isStreaming && (
              <span style={{ color: "var(--muted)", fontStyle: "italic" }}>
                Thinking<span className="loading-dots" />
              </span>
            )}

            {!hasContent && !isStreaming && message.rawOutput && (() => {
              const NOISE = /^(Query:|Resume this session with:|Session:\s|Duration:\s|Messages:\s|Goodbye!|Welcome to Hermes|╭|╰|┊)/;
              const cleaned = message.rawOutput
                .split("\n")
                .filter((l) => !NOISE.test(l.trimStart()) && l.trim() !== "")
                .join("\n")
                .trim();
              return cleaned ? (
                <pre style={{ margin: 0, fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", color: "var(--muted)" }}>
                  {cleaned}
                </pre>
              ) : null;
            })()}

            {message.blocks.map((block, i) => {
              const isLastBlock = i === message.blocks.length - 1;

              if (block.type === "think") {
                return showThink ? <ThinkBlock key={i} content={block.content} /> : null;
              }
              if (block.type === "tool") {
                return showTools ? <ToolBlock key={i} block={block} /> : null;
              }
              if (block.type === "text") {
                return (
                  <TextBlock
                    key={i}
                    content={block.content}
                    streaming={isStreaming && isLastBlock}
                  />
                );
              }
              return null;
            })}
          </>
        )}
      </div>
    </div>
  );
}
