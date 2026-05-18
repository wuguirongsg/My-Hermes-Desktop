import { useEffect, useMemo, useRef, useState, KeyboardEvent, ClipboardEvent, DragEvent } from "react";
import { Message } from "../types";
import Icon from "./Icon";
import GuideBot from "./chat/GuideBot";
import MessageBubble from "./chat/MessageBubble";
import GoalBar from "./chat/GoalBar";
import PersonalityPicker from "./chat/PersonalityPicker";
import SlashCommandMenu, { SLASH_COMMANDS, SlashCommand } from "./chat/SlashCommandMenu";

interface AttachedImage {
  dataUrl: string;
  filename?: string;
}

interface Props {
  messages: Message[];
  streaming: boolean;
  onSend: (
    text: string,
    options?: { image?: string; imageFilename?: string }
  ) => void;
  onQueue: (text: string) => void;
  onCancelQueue: (index: number) => void;
  onClearQueue: () => void;
  queue: string[];
  onRetryLastMessage: () => void;
  error: string | null;
  hasSession: boolean;
  contextPct?: number;
  onCompress?: () => void;
  onRunBackground?: (text: string) => void;
  bgRunningCount?: number;
  onPtyWrite?: (data: string) => void;
}

const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp"];

const DAILY_PROMPTS = [
  "今天深圳的天气怎么样？适合出门吗？",
  "最近一周上海的天气预报是什么？",
  "今天北京的空气质量如何？",
  "今天有哪些值得关注的国内外新闻？",
  "最近有什么重要的科技或 AI 新进展？",
  "今天体育圈有什么大事发生？",
  "最近国际上有哪些重要的外交动态？",
  "今天全球主要股市的表现如何？",
  "今天人民币兑美元的汇率是多少？",
  "最近黄金和原油价格走势如何？",
  "比特币今天的价格是多少？",
  "今天历史上发生了哪些大事？",
  "给我一个有趣的冷知识",
  "用简单的话解释一个有趣的科学概念",
  "最近有哪些值得读的新书推荐？",
  "给我推荐一个提高效率的小技巧",
  "推荐一部最近口碑好的电影或剧集",
  "推荐一首适合现在心情的歌",
  "给我写一首关于今天的短诗",
  "推荐一个值得关注的播客或 YouTube 频道",
  "今天适合做什么类型的运动？",
  "给我一个快速健康的午餐食谱建议",
  "分享一个改善睡眠质量的小建议",
  "给我一个今天可以做到的微小习惯改变",
];

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
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
  onRunBackground,
  bgRunningCount = 0,
  onPtyWrite,
}: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // isTyping: user is actively typing in the textarea
  const [isTyping, setIsTyping] = useState(false);

  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashIdx, setSlashIdx] = useState(0);

  const attachImageFile = async (file: File) => {
    if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) return false;
    try {
      const dataUrl = await readFileAsDataURL(file);
      setAttachedImage({ dataUrl, filename: file.name || undefined });
      return true;
    } catch {
      return false;
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          attachImageFile(file);
          return;
        }
      }
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (Array.from(e.dataTransfer.types).includes("Files")) {
      e.preventDefault();
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (e.currentTarget === e.target) setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) attachImageFile(file);
  };

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

  const filteredSlashCmds = slashOpen
    ? SLASH_COMMANDS.filter((cmd) =>
        slashQuery === "" ||
        cmd.command.slice(1).startsWith(slashQuery.toLowerCase()) ||
        cmd.description.toLowerCase().includes(slashQuery.toLowerCase())
      )
    : [];

  const handleSlashSelect = (cmd: SlashCommand) => {
    setSlashOpen(false);
    if (cmd.directSend) {
      onSend(cmd.command);
      if (textareaRef.current) {
        textareaRef.current.value = "";
        textareaRef.current.style.height = "auto";
      }
      setIsTyping(false);
    } else {
      const fill = `${cmd.command} `;
      if (textareaRef.current) {
        textareaRef.current.value = fill;
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(fill.length, fill.length);
      }
      setIsTyping(true);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashOpen && filteredSlashCmds.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIdx((i) => (i + 1) % filteredSlashCmds.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIdx((i) => (i - 1 + filteredSlashCmds.length) % filteredSlashCmds.length);
        return;
      }
      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSlashSelect(filteredSlashCmds[slashIdx]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashOpen(false);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const submit = () => {
    const text = textareaRef.current?.value.trim();
    if (!text && !attachedImage) return;
    const payload = text ?? "";
    if (streaming) {
      // Queued sends do not yet carry images (image lives on the next live turn).
      onQueue(payload);
    } else if (attachedImage) {
      onSend(payload, { image: attachedImage.dataUrl, imageFilename: attachedImage.filename });
    } else {
      onSend(payload);
    }
    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.style.height = "auto";
    }
    setIsTyping(false);
    setAttachedImage(null);
  };

  const submitBackground = () => {
    const text = textareaRef.current?.value.trim();
    if (!text || !onRunBackground) return;
    onRunBackground(text);
    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.style.height = "auto";
    }
    setIsTyping(false);
  };

  const submitToTui = () => {
    const text = textareaRef.current?.value.trim();
    if (!text || !onPtyWrite) return;
    onPtyWrite(text + "\r");
    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.style.height = "auto";
    }
    setIsTyping(false);
  };

  // Auto-resize textarea + track isTyping + slash menu detection
  const handleInput = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    setIsTyping(ta.value.length > 0);
    const val = ta.value;
    if (val.startsWith("/") && !val.includes(" ")) {
      setSlashOpen(true);
      setSlashQuery(val.slice(1));
      setSlashIdx(0);
    } else {
      setSlashOpen(false);
    }
  };

  const focusInput = () => {
    textareaRef.current?.focus();
  };

  const fillInput = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.value = text;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    ta.focus();
    ta.setSelectionRange(text.length, text.length);
    setIsTyping(text.length > 0);
  };

  const dailyPrompts = useMemo(
    () => [...DAILY_PROMPTS].sort(() => Math.random() - 0.5).slice(0, 4),
    []
  );

  const STARTER_PROMPTS = [
    {
      icon: "terminal" as const,
      title: "写一个脚本",
      text: "帮我写一个 shell 脚本：",
    },
    {
      icon: "alert" as const,
      title: "解释报错",
      text: "解释这段报错信息，告诉我原因和解决方法：\n\n",
    },
    {
      icon: "code" as const,
      title: "分析代码",
      text: "分析当前项目的代码结构，给我一个简洁的概览，说明各主要模块的职责",
    },
  ];

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
            <div className="starter-prompts">
              {STARTER_PROMPTS.map((p) => (
                <button
                  key={p.title}
                  className="starter-prompt-card ui-font"
                  onClick={() => fillInput(p.text)}
                >
                  <Icon name={p.icon} size={15} className="starter-prompt-icon" />
                  <span>{p.title}</span>
                </button>
              ))}
            </div>
            <div className="daily-prompts-section">
              <span className="daily-prompts-label ui-font">今日一问</span>
              <div className="daily-prompts-grid">
                {dailyPrompts.map((q) => (
                  <button
                    key={q}
                    className="daily-prompt-card ui-font"
                    onClick={() => fillInput(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
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
      <div
        className={`chat-input-area${isDragging ? " is-dragging" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="image-drop-overlay">
            <Icon name="spark" size={20} />
            <span>松开以附加图片</span>
          </div>
        )}
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

        {attachedImage && (
          <div className="image-attachment-row">
            <div className="image-attachment">
              <img src={attachedImage.dataUrl} alt={attachedImage.filename ?? "attached"} />
              <button
                type="button"
                className="image-attachment-remove"
                onClick={() => setAttachedImage(null)}
                title="移除图片"
              >
                <Icon name="close" size={12} />
              </button>
            </div>
            <span className="image-attachment-name">
              {attachedImage.filename ?? "粘贴的图片"}
            </span>
          </div>
        )}

        <div className="input-row-wrapper">
          {slashOpen && filteredSlashCmds.length > 0 && (
            <SlashCommandMenu
              items={filteredSlashCmds}
              selectedIndex={slashIdx}
              onSelect={handleSlashSelect}
            />
          )}
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
            onPaste={handlePaste}
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
          </div>{/* input-row */}
        </div>{/* input-row-wrapper */}

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
          <div className="input-shortcuts">
            <PersonalityPicker onSend={onSend} />
            {onRunBackground && (
              <button
                type="button"
                className="bg-run-btn ui-font"
                onClick={submitBackground}
                disabled={!isTyping}
                title="把当前输入作为独立任务在后台运行（不影响当前会话）"
              >
                <Icon name="bot" size={13} />
                后台运行
                {bgRunningCount > 0 && (
                  <span className="bg-run-badge">{bgRunningCount}</span>
                )}
              </button>
            )}
            {onPtyWrite && (
              <button
                type="button"
                className="bg-run-btn ui-font"
                onClick={submitToTui}
                disabled={!isTyping}
                title="把当前输入发送到 TUI 终端（测试 PTY 控制）"
              >
                <Icon name="terminal" size={13} />
                发送到 TUI
              </button>
            )}
          </div>
          <div className="input-key-hints">
            <span>
              <kbd>Enter</kbd> to {streaming ? "queue" : "send"}
            </span>
            <span>
              <kbd>Shift+Enter</kbd> for newline
            </span>
          </div>
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
