import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message, ToolCallBlock } from "../../types";

// ─── Think Block ──────────────────────────────────────────────────────────────

function ThinkBlock({ content }: { content: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="think-block fade-in">
      <div className="think-header" onClick={() => setOpen((o) => !o)}>
        <span style={{ fontSize: 12 }}>🧠</span>
        <span className="think-label ui-font">Thinking</span>
        {content && (
          <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 4 }}>
            {content.split(/\s+/).length} words
          </span>
        )}
        <span className={`think-chevron ${open ? "open" : ""}`}>▶</span>
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
        <span className="tool-icon">⚙</span>
        <span className="tool-name ui-font">{block.name}</span>
        {!block.outputDone && !open && (
          <span style={{ fontSize: 10, color: "var(--muted)" }} className="loading-dots" />
        )}
        {block.outputDone && (
          <span className="tool-badge">done</span>
        )}
        <span className={`tool-chevron ${open ? "open" : ""}`}>▶</span>
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

function TextBlock({ content, streaming }: { content: string; streaming: boolean }) {
  return (
    <div className="md-content selectable">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      {streaming && <span className="cursor-blink" />}
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

  return (
    <div className="message-group fade-in">
      <div className="message-header">
        <span className="message-role assistant ui-font">⚡ Hermes</span>
        <span className="message-time">{formatTime(message.timestamp)}</span>
        {message.status === "error" && (
          <span style={{ fontSize: 10, color: "var(--error)" }}>error</span>
        )}
      </div>
      <div className="message-bubble assistant">
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
      </div>
    </div>
  );
}
