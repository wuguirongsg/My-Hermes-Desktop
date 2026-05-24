import { useEffect, useMemo, useRef, useState, KeyboardEvent, ClipboardEvent, DragEvent, useCallback } from "react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { Message } from "../types";
import Icon from "./Icon";
import GuideBot from "./chat/GuideBot";
import MessageBubble from "./chat/MessageBubble";
import GoalBar from "./chat/GoalBar";
import PersonalityPicker from "./chat/PersonalityPicker";
import SlashCommandMenu, { SLASH_COMMANDS, SlashCommand } from "./chat/SlashCommandMenu";
import RefPickerPanel from "./chat/RefPickerPanel";
import { RefItem } from "./chat/AtMentionMenu";

interface AttachedImage {
  dataUrl: string;
  filename?: string;
}

interface AttachedFile {
  name: string;
  path: string;
}

interface Props {
  messages: Message[];
  streaming: boolean;
  onSend: (
    text: string,
    options?: { image?: string; imageFilename?: string; skills?: string[] }
  ) => void;
  onQueue: (text: string) => void;
  onCancelQueue: (index: number) => void;
  onClearQueue: () => void;
  queue: string[];
  onRetryLastMessage: () => void;
  onStop?: () => void;
  error: string | null;
  hasSession: boolean;
  contextPct?: number;
  onCompress?: () => void;
  onRunBackground?: (text: string) => void;
  bgRunningCount?: number;
  onPtyWrite?: (data: string) => void;
  pendingInputAppend?: { id: number; text: string } | null;
  onGoToDashboard?: () => void;
  workingDir?: string | null;
  showTools?: boolean;
  memoryLoaded?: boolean | null;
  currentModel?: string | null;
}

const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp"];

const ATTACHMENT_EXTENSIONS = ["pdf", "docx", "doc", "xlsx", "xls", "pptx", "ppt", "txt", "md", "csv", "png", "jpg", "jpeg", "gif", "webp", "bmp"];

const DAILY_PROMPTS = [
  // 行动型 — 文件与整理
  "帮我整理下载文件夹，按文件类型归类到子文件夹",
  "扫描桌面，找出超过 30 天没修改的文件并列出清单",
  "帮我把文件夹里的图片批量重命名为日期格式",
  "分析当前项目目录，找出重复或冗余的文件",
  "搜索当前目录下所有 TODO 注释并汇总列出",
  // 行动型 — 写作与文档
  "写一份会议纪要模板，含时间/参与者/决议/待办事项",
  "帮我把以下内容整理成 PPT 大纲，按章节分层列出：\n\n",
  "把这段内容整理成结构清晰的 Markdown 文档：\n\n",
  "帮我起草一封专业商务邮件，收件人是：",
  "把我说的内容整理成一份简洁的工作汇报：\n\n",
  // 行动型 — 日程与任务
  "创建一个本周工作计划模板并保存到桌面",
  "创建一个今天日期的每日任务清单文件",
  "设置一个 30 分钟后的提醒，提醒内容是：",
  "帮我列出今天最重要的 3 件事，按优先级排序",
  // 查询型 — 实时信息
  "今天深圳的天气怎么样？适合出门吗？",
  "今天有哪些值得关注的国内外新闻？",
  "今天全球主要股市的表现如何？",
  "今天人民币兑美元的汇率是多少？",
  "最近有什么重要的科技或 AI 新进展？",
  "今天体育圈有什么大事发生？",
  // 查询型 — 知识与娱乐
  "今天历史上发生了哪些大事？",
  "给我一个有趣的冷知识",
  "用简单的话解释一个有趣的科学概念",
  "最近有哪些值得读的新书推荐？",
  "推荐一部最近口碑好的电影或剧集",
  "给我写一首关于今天的短诗",
  // 查询型 — 健康生活
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
  onStop,
  error,
  hasSession,
  contextPct,
  onCompress,
  onRunBackground,
  bgRunningCount = 0,
  onPtyWrite,
  pendingInputAppend,
  onGoToDashboard,
  workingDir,
  showTools = true,
  memoryLoaded = null,
  currentModel = null,
}: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  // 识别 hermes 错误类型，返回结构化描述；无法识别则返回 null
  function parseErrorCard(msg: string | null): { title: string; desc: string; dashboard?: string } | null {
    if (!msg) return null;
    const m = msg.toLowerCase();
    if (m.includes("401") || m.includes("unauthorized") || m.includes("invalid api key") || m.includes("authentication"))
      return { title: "API Key 无效或未配置", desc: "请前往 Dashboard 检查或重新填写 API Key。", dashboard: "dashboard" };
    if (m.includes("429") || m.includes("rate limit") || m.includes("too many requests"))
      return { title: "请求频率超限", desc: "API 调用次数已达上限，请稍后重试或升级套餐。", dashboard: "dashboard" };
    if (m.includes("model not found") || m.includes("invalid model") || m.includes("does not exist"))
      return { title: "模型不存在", desc: "当前选择的模型无法访问，请在 Dashboard 更换模型配置。", dashboard: "dashboard" };
    if (m.includes("mcp") || m.includes("tool error") || m.includes("tool call"))
      return { title: "MCP 工具调用失败", desc: "本次调用的 MCP 工具发生错误，可在 Dashboard 检查 MCP 配置。", dashboard: "dashboard" };
    return null;
  }
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // isTyping: user is actively typing in the textarea
  const [isTyping, setIsTyping] = useState(false);

  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashIdx, setSlashIdx] = useState(0);

  const [atOpen, setAtOpen] = useState(false);
  const [atQuery, setAtQuery] = useState("");
  const [selectedRefs, setSelectedRefs] = useState<RefItem[]>([]);
  const atTriggerPosRef = useRef<number>(0);

  const [isRecording, setIsRecording] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const toggleRecording = useCallback(() => {
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      alert("当前环境不支持语音识别。请在系统设置 → 隐私与安全性 → 麦克风 中为本应用授权后重启。");
      return;
    }
    const recognition = new SR();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => { setIsRecording(false); recognitionRef.current = null; };
    recognition.onerror = () => { setIsRecording(false); recognitionRef.current = null; };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const transcript: string = e.results[0][0].transcript;
      const ta = textareaRef.current;
      if (!ta) return;
      ta.value = ta.value + transcript;
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
      ta.focus();
      setIsTyping(ta.value.length > 0);
    };
    recognitionRef.current = recognition;
    recognition.start();
  }, [isRecording]);

  const handleAtSelect = useCallback((item: RefItem) => {
    setAtOpen(false);
    // Remove the @query trigger text from the textarea
    const ta = textareaRef.current;
    if (ta) {
      const val = ta.value;
      const triggerEnd = atTriggerPosRef.current + 1 + atQuery.length;
      ta.value = val.slice(0, atTriggerPosRef.current) + val.slice(triggerEnd);
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
      setIsTyping(ta.value.length > 0);
    }
    textareaRef.current?.focus();
    setSelectedRefs((prev) => {
      if (prev.some((r) => r.type === item.type && r.name === item.name)) return prev;
      return [...prev, item];
    });
  }, [atQuery]);

  const openAtMenu = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart ?? ta.value.length;
    const val = ta.value;
    ta.value = val.slice(0, pos) + "@" + val.slice(pos);
    ta.focus();
    const newPos = pos + 1;
    ta.setSelectionRange(newPos, newPos);
    atTriggerPosRef.current = pos;
    setAtOpen(true);
    setAtQuery("");
    setIsTyping(ta.value.length > 0);
  }, []);

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

  const handleAttachClick = async () => {
    const selected = await openFileDialog({
      multiple: true,
      filters: [{ name: "Files", extensions: ATTACHMENT_EXTENSIONS }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    for (const p of paths) {
      const name = p.split("/").pop() ?? p;
      setAttachedFiles((prev) => {
        if (prev.some((f) => f.path === p)) return prev;
        return [...prev, { name, path: p }];
      });
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

  // Sticky scroll: instantly follow output if user was already at the bottom.
  // Tracks position before the messages state change via onScroll.
  useEffect(() => {
    if (wasAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [messages]);

  const handleMessagesScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  // Auto-focus input on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!pendingInputAppend) return;
    const ta = textareaRef.current;
    if (!ta) return;
    const current = ta.value;
    const separator = current.trim().length > 0 ? "\n\n" : "";
    const next = `${current}${separator}${pendingInputAppend.text}`;
    ta.value = next;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    ta.focus();
    ta.setSelectionRange(next.length, next.length);
    setIsTyping(next.length > 0);
  }, [pendingInputAppend]);

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
    if (atOpen && e.key === "Escape") {
      e.preventDefault();
      setAtOpen(false);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const submit = () => {
    const rawText = textareaRef.current?.value.trim() ?? "";
    if (!rawText && !attachedImage && selectedRefs.length === 0 && attachedFiles.length === 0) return;

    const fileRefs = selectedRefs.filter((r) => r.type === "file");
    const skillRefs = selectedRefs.filter((r) => r.type === "skill");
    const skillNames = skillRefs.map((r) => r.name);

    const fileAppend = fileRefs
      .map((r) => ` @${r.path}`)
      .join("");
    const uploadAppend = attachedFiles
      .map((f) => ` @${f.path}`)
      .join("");
    const payload = rawText + fileAppend + uploadAppend;

    const extraOpts = skillNames.length > 0 ? { skills: skillNames } : {};

    if (streaming) {
      onQueue(payload);
    } else if (attachedImage) {
      onSend(payload, { image: attachedImage.dataUrl, imageFilename: attachedImage.filename, ...extraOpts });
    } else {
      onSend(payload, Object.keys(extraOpts).length > 0 ? extraOpts : undefined);
    }
    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.style.height = "auto";
    }
    setIsTyping(false);
    setAttachedImage(null);
    setAttachedFiles([]);
    setSelectedRefs([]);
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

  // Auto-resize textarea + track isTyping + slash/@ menu detection
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
    const cursorPos = ta.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      atTriggerPosRef.current = cursorPos - atMatch[0].length;
      setAtOpen(true);
      setAtQuery(atMatch[1]);
      } else {
      setAtOpen(false);
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

  const memoryText = memoryLoaded === true ? "个人记忆已加载" : memoryLoaded === false ? "个人记忆未配置" : null;

  // Pre-compute assistantIndex per message for Grounding popover
  const assistantIndexMap = new Map<string, number>();
  let aCount = 0;
  for (const m of messages) {
    if (m.role === "assistant") {
      aCount += 1;
      assistantIndexMap.set(m.id, aCount);
    }
  }

  return (
    <div className="main-area">
      <GoalBar streaming={streaming} onSend={onSend} />
      {/* Context info bar */}
      <div className="context-info-bar ui-font">
        {messages.length === 0
          ? <>新会话{memoryText && <> · <span className={memoryLoaded ? "ctx-memory-ok" : "ctx-memory-none"}>{memoryText}</span></>}</>
          : <>已加载：会话历史 {messages.length} 条{memoryText && <> · <span className={memoryLoaded ? "ctx-memory-ok" : "ctx-memory-none"}>{memoryText}</span></>}</>
        }
      </div>
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
                    <Icon name="message" size={12} className="daily-prompt-icon" />
                    <span>{q}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="chat-messages" ref={scrollContainerRef} onScroll={handleMessagesScroll}>
          {messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isLastAssistant={msg.id === lastAssistantId}
              streaming={streaming}
              showTools={showTools}
              onRetry={onRetryLastMessage}
              model={currentModel}
              memoryLoaded={memoryLoaded}
              assistantIndex={assistantIndexMap.get(msg.id)}
              messageIndex={idx + 1}
            />
          ))}
          {error && (() => {
            const card = parseErrorCard(error);
            return card ? (
              <div className="error-card fade-in">
                <div className="error-card-header">
                  <Icon name="alert" size={14} />
                  <span>{card.title}</span>
                </div>
                <div className="error-card-desc">{card.desc}</div>
                {card.dashboard && onGoToDashboard && (
                  <button className="error-card-btn" onClick={onGoToDashboard}>
                    前往 Dashboard →
                  </button>
                )}
              </div>
            ) : (
              <div className="error-banner fade-in">
                <Icon name="alert" size={15} />
                <span>{error}</span>
              </div>
            );
          })()}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Error (when no messages) */}
      {error && messages.length === 0 && (() => {
        const card = parseErrorCard(error);
        return card ? (
          <div className="error-card" style={{ margin: "8px 16px" }}>
            <div className="error-card-header">
              <Icon name="alert" size={14} />
              <span>{card.title}</span>
            </div>
            <div className="error-card-desc">{card.desc}</div>
            {card.dashboard && onGoToDashboard && (
              <button className="error-card-btn" onClick={onGoToDashboard}>
                前往 Dashboard →
              </button>
            )}
          </div>
        ) : (
          <div className="error-banner" style={{ margin: "8px 16px" }}>
            <Icon name="alert" size={15} />
            <span>{error}</span>
          </div>
        );
      })()}

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

        {selectedRefs.length > 0 && (
          <div className="image-attachment-row">
            {selectedRefs.map((ref) => (
              <div key={`${ref.type}-${ref.name}`} className="ref-chip ui-font">
                <span className="ref-chip-icon">{ref.type === "file" ? "📄" : "⚙"}</span>
                <span className="ref-chip-name">{ref.name}</span>
                <button
                  type="button"
                  className="image-attachment-remove ref-chip-remove"
                  onClick={() =>
                    setSelectedRefs((prev) =>
                      prev.filter((r) => !(r.type === ref.type && r.name === ref.name))
                    )
                  }
                  title="移除"
                >
                  <Icon name="close" size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {attachedFiles.length > 0 && (
          <div className="image-attachment-row">
            {attachedFiles.map((f) => (
              <div key={f.path} className="ref-chip ui-font">
                <span className="ref-chip-icon">📎</span>
                <span className="ref-chip-name">{f.name}</span>
                <button
                  type="button"
                  className="image-attachment-remove ref-chip-remove"
                  onClick={() => setAttachedFiles((prev) => prev.filter((x) => x.path !== f.path))}
                  title="移除"
                >
                  <Icon name="close" size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

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
          {atOpen && (
            <RefPickerPanel
              workingDir={workingDir ?? null}
              onSelect={handleAtSelect}
              onClose={() => { setAtOpen(false); textareaRef.current?.focus(); }}
              onAsk={(text) => { setAtOpen(false); onSend(text); }}
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
            <button
              type="button"
              className="bg-run-btn ui-font"
              onClick={handleAttachClick}
              title="添加附件（图片/PDF/Word/Excel/PPT/文本）"
            >
              <Icon name="paperclip" size={13} />
              附件
            </button>
            <button
              type="button"
              className="bg-run-btn ui-font"
              onClick={openAtMenu}
              title="引用文件或技能（也可直接输入 @）"
            >
              @
            </button>
            <PersonalityPicker onSend={onSend} />
            {streaming && onStop && (
              <button
                type="button"
                className="bg-run-btn stop-btn ui-font"
                onClick={onStop}
                title="中断当前 Agent 执行"
              >
                <Icon name="close" size={12} />
                停止
              </button>
            )}
            <button
              type="button"
              className={`bg-run-btn ui-font${isRecording ? " mic-recording" : ""}`}
              onClick={toggleRecording}
              title={isRecording ? "点击停止录音" : "语音输入"}
            >
              <Icon name="mic" size={13} />
              {isRecording ? "录音中" : "语音"}
            </button>
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
