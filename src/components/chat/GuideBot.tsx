import { useState, useEffect } from "react";
import type { Message } from "../../types";

export type GuideBotAppearance = "classic" | "voxel" | "anime" | "cyber" | "pod";

export const GUIDE_BOT_APPEARANCES: Array<{
  id: GuideBotAppearance;
  name: string;
  description: string;
}> = [
  { id: "classic", name: "经典屏幕", description: "当前默认，轻量、克制、贴近输入区" },
  { id: "voxel", name: "体素方块", description: "方块外壳，玩具感更强，屏幕保持高清" },
  { id: "anime", name: "二次元伙伴", description: "漫画游戏风，更亲和、表情更明显" },
  { id: "cyber", name: "赛博装甲", description: "更激进的未来科技感，霓虹轮廓" },
  { id: "pod", name: "心跳胶囊", description: "圆屏 pod 形态，安静、专业、医疗仪表感" },
];

const GUIDE_BOT_APPEARANCE_KEY = "hermes.guideBot.appearance";
const GUIDE_BOT_APPEARANCE_EVENT = "hermes-guide-bot-appearance";
const GUIDE_BOT_APPEARANCE_IDS = GUIDE_BOT_APPEARANCES.map((item) => item.id);

function readGuideBotAppearance(): GuideBotAppearance {
  try {
    const saved = window.localStorage.getItem(GUIDE_BOT_APPEARANCE_KEY) as GuideBotAppearance | null;
    return saved && GUIDE_BOT_APPEARANCE_IDS.includes(saved) ? saved : "classic";
  } catch {
    return "classic";
  }
}

export function useGuideBotAppearance() {
  const [appearance, setAppearanceState] = useState<GuideBotAppearance>(readGuideBotAppearance);

  useEffect(() => {
    const handleChange = () => setAppearanceState(readGuideBotAppearance());
    window.addEventListener(GUIDE_BOT_APPEARANCE_EVENT, handleChange);
    window.addEventListener("storage", handleChange);
    return () => {
      window.removeEventListener(GUIDE_BOT_APPEARANCE_EVENT, handleChange);
      window.removeEventListener("storage", handleChange);
    };
  }, []);

  const setAppearance = (next: GuideBotAppearance) => {
    try {
      window.localStorage.setItem(GUIDE_BOT_APPEARANCE_KEY, next);
    } catch {}
    setAppearanceState(next);
    window.dispatchEvent(new CustomEvent(GUIDE_BOT_APPEARANCE_EVENT));
  };

  return { appearance, setAppearance };
}

type GuideMood =
  | "blink"
  | "sleep"
  | "heartbeat"
  | "ok"
  | "pulse"
  | "error"
  | "typing"
  | "alert"
  | "success";

interface GuideAction {
  label: string;
  onClick: () => void;
}

interface Props {
  messages: Message[];
  streaming: boolean;
  queue: string[];
  error: string | null;
  hasSession: boolean;
  contextPct?: number;
  longTask?: boolean;
  isTyping?: boolean;
  justFinished?: boolean;
  onFocusInput: () => void;
  onRetryLastMessage: () => void;
  onCompress?: () => void;
  onSetGoal?: () => void;
}

export function GuideBotAvatar({
  mood,
  appearance = "classic",
}: {
  mood: GuideMood;
  appearance?: GuideBotAppearance;
}) {
  return (
    <div
      className={`guide-bot-avatar guide-bot-avatar-${appearance} guide-bot-${mood}`}
      aria-hidden="true"
    >
      <div className="guide-bot-antenna" />
      <div className="guide-bot-head">
        <div className="guide-bot-screen">
          <div className="guide-bot-pixel-grid" />
          <div className="guide-face guide-face-eyes">
            <span className="guide-eye guide-eye-left" />
            <span className="guide-eye guide-eye-right" />
            <span className="guide-mouth" />
          </div>
          <div className="guide-face guide-face-sleep">
            <span>Z</span>
            <span>Z</span>
            <span>Z</span>
          </div>
          <div className="guide-face guide-face-heartbeat">
            <svg viewBox="0 0 42 18" role="presentation">
              <path d="M2 10h8l4-6 5 12 5-9 4 3h12" />
            </svg>
          </div>
          <div className="guide-face guide-face-ok">OK</div>
          <div className="guide-face guide-face-pulse">
            <span />
            <span />
            <span />
          </div>
          <div className="guide-face guide-face-error">!</div>
          <div className="guide-face guide-face-typing">
            <span className="guide-typing-eye guide-typing-eye-left" />
            <span className="guide-typing-eye guide-typing-eye-right" />
            <span className="guide-typing-mouth" />
          </div>
          <div className="guide-face guide-face-alert">
            <span className="guide-alert-eye guide-alert-eye-left" />
            <span className="guide-alert-eye guide-alert-eye-right" />
            <span className="guide-alert-mouth" />
          </div>
          <div className="guide-face guide-face-success">✓</div>
        </div>
      </div>
      <div className="guide-bot-base" />
    </div>
  );
}

function getGuideState({
  messages,
  streaming,
  queue,
  error,
  hasSession,
  contextPct,
  longTask,
  isTyping,
  showSuccess,
  onFocusInput,
  onRetryLastMessage,
  onCompress,
  onSetGoal,
}: Props & { showSuccess: boolean }): {
  mood: GuideMood;
  text: string;
  actions: GuideAction[];
} {
  // 1. error
  if (error) {
    const canRetry = messages.some((message) => message.role === "assistant");
    return {
      mood: "error",
      text: "这轮执行遇到问题，可以先看一下错误信息。",
      actions: [
        canRetry
          ? { label: "重试", onClick: onRetryLastMessage }
          : { label: "继续输入", onClick: onFocusInput },
      ],
    };
  }

  // 2. alert — idle but with actionable suggestion
  if (!streaming && contextPct !== undefined && contextPct >= 0.7) {
    return {
      mood: "alert",
      text: `上下文使用率 ${Math.round(contextPct * 100)}%，可以先压缩一下。`,
      actions: [{ label: "压缩", onClick: onCompress ?? onFocusInput }],
    };
  }

  if (!streaming && longTask) {
    return {
      mood: "alert",
      text: "这次任务有点长，要不要设为持续目标？",
      actions: [{ label: "设置目标", onClick: onSetGoal ?? onFocusInput }],
    };
  }

  // 3. ok — streaming with queue
  if (streaming && queue.length > 0) {
    return {
      mood: "ok",
      text: `已排队 ${queue.length} 条消息，当前轮结束后会继续发送。`,
      actions: [{ label: "继续输入", onClick: onFocusInput }],
    };
  }

  // 4. heartbeat — streaming
  if (streaming) {
    return {
      mood: "heartbeat",
      text: "Hermes 正在处理，你可以继续输入，我会帮你排到下一轮。",
      actions: [{ label: "继续输入", onClick: onFocusInput }],
    };
  }

  // 5. success — just finished streaming
  if (showSuccess) {
    return {
      mood: "success",
      text: "收到结果。",
      actions: [],
    };
  }

  // 6. typing — user is typing
  if (isTyping) {
    return {
      mood: "typing",
      text: "在听，写完按回车发送。",
      actions: [],
    };
  }

  // 7. blink/pulse — empty session
  if (messages.length === 0) {
    return {
      mood: hasSession ? "pulse" : "blink",
      text: hasSession
        ? "这个会话还很安静。写一句自然语言就能继续。"
        : "写一句自然语言就能开始，我会在这里提示下一步。",
      actions: [{ label: "开始输入", onClick: onFocusInput }],
    };
  }

  // 8. sleep — quiet idle
  return {
    mood: "sleep",
    text: "我先待命。需要排队、压缩或重试时会提醒你。",
    actions: [],
  };
}

export default function GuideBot(props: Props) {
  const [showSuccess, setShowSuccess] = useState(false);
  const { appearance } = useGuideBotAppearance();

  useEffect(() => {
    if (props.justFinished && !showSuccess) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [props.justFinished]);

  const state = getGuideState({ ...props, showSuccess });

  return (
    <div className={`guide-bot guide-bot-${state.mood}`} aria-live="polite">
      <GuideBotAvatar mood={state.mood} appearance={appearance} />

      <div className="guide-bot-bubble">
        <span className="guide-bot-text">{state.text}</span>
        {state.actions.length > 0 && (
          <span className="guide-bot-actions">
            {state.actions.map((action) => (
              <button
                key={action.label}
                type="button"
                className="guide-bot-action"
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
