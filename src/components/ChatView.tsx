import { useEffect, useRef, KeyboardEvent } from "react";
import { Message } from "../types";
import Icon from "./Icon";
import MessageBubble from "./chat/MessageBubble";

interface Props {
  messages: Message[];
  streaming: boolean;
  onSend: (text: string) => void;
  onRetryLastMessage: () => void;
  error: string | null;
  hasSession: boolean;
}

export default function ChatView({
  messages,
  streaming,
  onSend,
  onRetryLastMessage,
  error,
  hasSession,
}: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-focus input on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const submit = () => {
    const text = textareaRef.current?.value.trim();
    if (!text || streaming) return;
    onSend(text);
    if (textareaRef.current) textareaRef.current.value = "";
  };

  // Auto-resize textarea
  const handleInput = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  };

  const lastAssistantIdx = [...messages]
    .reverse()
    .findIndex((m) => m.role === "assistant");
  const lastAssistantId =
    lastAssistantIdx >= 0
      ? messages[messages.length - 1 - lastAssistantIdx].id
      : null;

  return (
    <div className="main-area">
      {/* Messages */}
      {messages.length === 0 ? (
        <div className="chat-messages">
          <div className="chat-empty">
            <div className="chat-empty-icon">
              <Icon name="spark" size={34} />
            </div>
            <div className="chat-empty-title ui-font">
              {hasSession ? "Session loaded" : "Start a conversation"}
            </div>
            <div className="chat-empty-hint">
              Hermes is a self-improving agent — it learns from your interactions
              and creates skills from patterns it observes.
              <br />
              <br />
              Type a message below to begin.
            </div>
          </div>
        </div>
      ) : (
        <div className="chat-messages">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isLastAssistant={msg.id === lastAssistantId}
              streaming={streaming}
              onRetry={onRetryLastMessage}
            />
          ))}
          {error && (
            <div className="error-banner fade-in">
              <Icon name="alert" size={15} />
              <span>{error}</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Error (when no messages) */}
      {error && messages.length === 0 && (
        <div className="error-banner" style={{ margin: "8px 16px" }}>
          <Icon name="alert" size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Input */}
      <div className="chat-input-area">
        <div className="input-row">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder={
              streaming
                ? "Hermes is thinking..."
                : "Message Hermes... (Enter to send, Shift+Enter for newline)"
            }
            disabled={streaming}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            rows={1}
          />
          <button
            className="btn-send ui-font"
            onClick={submit}
            disabled={streaming}
          >
            {streaming ? (
              <>
                <span className="loading-dots" style={{ color: "var(--primary)" }} />
              </>
            ) : (
              <>
                Send
                <Icon name="send" size={14} />
              </>
            )}
          </button>
        </div>
        <div className="input-hints ui-font">
          <span>
            <kbd>Enter</kbd> to send
          </span>
          <span>
            <kbd>Shift+Enter</kbd> for newline
          </span>
          {streaming && (
            <span className="agent-running">
              <span className="agent-running-dot" />
              Agent running...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
