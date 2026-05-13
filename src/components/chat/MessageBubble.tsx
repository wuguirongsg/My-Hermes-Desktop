import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { open as openUrl } from "@tauri-apps/plugin-shell";
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

function TerminalOutput({ content, error }: { content: string; error: boolean }) {
  return (
    <div className={`stream-terminal selectable ${error ? "error" : ""}`}>
      <div className="stream-terminal-header ui-font">
        <span className="stream-terminal-dot" />
        <span>{error ? "Hermes exited with an error" : "Hermes is responding"}</span>
      </div>
      <pre className="stream-terminal-body">
        {content || "Starting Hermes..."}
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
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function MessageBubble({ message, isLastAssistant, streaming }: Props) {
  const isUser = message.role === "user";
  const isStreaming = streaming && isLastAssistant && message.status === "streaming";

  if (isUser) {
    const text = message.blocks
      .filter((b) => b.type === "text")
      .map((b) => b.content)
      .join("\n");
    return (
      <div className="message-group" style={{ alignItems: "flex-end" }}>
        <div className="message-header" style={{ justifyContent: "flex-end" }}>
          <span className="message-time">{formatTime(message.timestamp)}</span>
          <span className="message-role user ui-font">You</span>
        </div>
        <div className="message-bubble user selectable">
          <div style={{ whiteSpace: "pre-wrap" }}>{text}</div>
        </div>
      </div>
    );
  }

  const hasContent = message.blocks.length > 0;
  const showTerminal =
    !isUser &&
    ((isStreaming && message.rawOutput !== undefined) || message.status === "error");

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

            {message.blocks.map((block, i) => {
              const isLastBlock = i === message.blocks.length - 1;

              if (block.type === "think") {
                return <ThinkBlock key={i} content={block.content} />;
              }
              if (block.type === "tool") {
                return <ToolBlock key={i} block={block} />;
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
