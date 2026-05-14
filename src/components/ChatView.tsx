import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { Message } from "../types";
import Icon from "./Icon";
import GuideBot from "./chat/GuideBot";
import MessageBubble from "./chat/MessageBubble";
import GoalBar from "./chat/GoalBar";

interface Props {
  messages: Message[];
  streaming: boolean;
  onSend: (text: string) => void;
  onQueue: (text: string) => void;
  onCancelQueue: (index: number) => void;
  onClearQueue: () => void;
  queue: string[];
  onRetryLastMessage: () => void;
  error: string | null;
  hasSession: boolean;
  contextPct?: number;
  onCompress?: () => void;
}

export default function ChatView({
  messages,
  streaming,
  onSend,
  onQueue,
  onCancelQueue,
  onClearQueue,
  queue,
  onRetryLastMessage,
  error,
  hasSession,
  contextPct,
  onCompress,
}: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // isTyping: user is actively typing in the textarea
  const [isTyping, setIsTyping] = useState(false);

  // justFinished: briefly true when streaming transitions from true → false
  const [justFinished, setJustFinished] = useState(false);
  const prevStreaming = useRef(streaming);

  useEffect(() => {
    if (!streaming && prevStreaming.current) {
      setJustFinished(true);
    }
    prevStreaming.current = streaming;
  }, [streaming]);

  // longTask: heuristic — more than 6 user messages in this session
  const longTask = messages.filter((m) => m.role === "user").length >= 6;

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
    if (!text) return;
    if (streaming) {
      onQueue(text);
    } else {
      onSend(text);
    }
    if (textareaRef.current) textareaRef.current.value = "";
    setIsTyping(false);
  };

  // Auto-resize textarea + track isTyping
  const handleInput = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    setIsTyping(ta.value.length > 0);
  };

  const focusInput = () => {
    textareaRef.current?.focus();
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
      <GoalBar streaming={streaming} onSend={onSend} />
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
        <GuideBot
          messages={messages}
          streaming={streaming}
          queue={queue}
          error={error}
          hasSession={hasSession}
          isTyping={isTyping}
          justFinished={justFinished}
          contextPct={contextPct}
          longTask={longTask}
          onFocusInput={focusInput}
          onRetryLastMessage={onRetryLastMessage}
          onCompress={onCompress}
        />

        <div className="input-row">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder={
              streaming
                ? queue.length > 0
                  ? `Queue message ${queue.length + 1}... (Enter to queue)`
                  : "Queue a message for next turn... (Enter to queue)"
                : "Message Hermes... (Enter to send, Shift+Enter for newline)"
            }
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            rows={1}
          />
          <button
            className="btn-send ui-font"
            onClick={submit}
          >
            {streaming ? (
              <>
                排队 ⏸
              </>
            ) : (
              <>
                Send
                <Icon name="send" size={14} />
              </>
            )}
          </button>
        </div>

        {queue.length > 0 && (
          <div className="queue-list">
            <div className="queue-header">
              <span className="queue-label">排队中（{queue.length} 条）：</span>
              <button className="queue-clear" onClick={onClearQueue} title="全部取消">
                全部取消
              </button>
            </div>
            {queue.map((text, index) => (
              <div key={index} className="queue-item">
                <span className="queue-index">{index + 1}.</span>
                <span className="queue-text">{text}</span>
                <button
                  className="queue-cancel"
                  onClick={() => onCancelQueue(index)}
                  title="移除此条"
                >
                  <Icon name="close" size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="input-hints ui-font">
          <span>
            <kbd>Enter</kbd> to {streaming ? "queue" : "send"}
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
