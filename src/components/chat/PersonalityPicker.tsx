import { useState, useEffect, useRef } from "react";
import Icon, { type IconName } from "../Icon";

interface Personality {
  id: string;
  name: string;
  icon: IconName;
  description: string;
}

const PERSONALITIES: Personality[] = [
  { id: "helpful",  name: "助手",   icon: "bot",        description: "均衡、专业，默认人格" },
  { id: "concise",  name: "简洁",   icon: "scissors",   description: "极简回复，少废话" },
  { id: "mentor",   name: "导师",   icon: "graduation", description: "耐心引导，提问式启发" },
  { id: "engineer", name: "工程师", icon: "code",       description: "直击代码与实现细节" },
  { id: "scholar",  name: "学者",   icon: "book",       description: "严谨、引经据典" },
  { id: "creative", name: "创意",   icon: "palette",    description: "天马行空、富有想象力" },
  { id: "skeptic",  name: "质疑者", icon: "search",     description: "挑战假设、找漏洞" },
  { id: "pirate",   name: "海盗",   icon: "flag",       description: "海盗腔调，趣味放松" },
];

const STORAGE_KEY = "hermes-personality";
const DEFAULT_ID = "helpful";

interface Props {
  onSend: (text: string) => void;
}

function loadPersonality(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_ID;
  } catch {
    return DEFAULT_ID;
  }
}

export default function PersonalityPicker({ onSend }: Props) {
  const [current, setCurrent] = useState<string>(loadPersonality);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, current);
    } catch {
      /* ignore */
    }
  }, [current]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const currentPersona = PERSONALITIES.find((p) => p.id === current) ?? PERSONALITIES[0];
  const isDefault = current === DEFAULT_ID;

  const select = (id: string) => {
    setCurrent(id);
    setOpen(false);
    onSend(`/personality ${id}`);
  };

  const reset = () => {
    setCurrent(DEFAULT_ID);
    onSend(`/personality ${DEFAULT_ID}`);
  };

  return (
    <div className="personality-picker" ref={ref}>
      <button
        className="personality-trigger"
        onClick={() => setOpen((o) => !o)}
        title={`当前人格：${currentPersona.name}`}
        aria-label="切换人格"
      >
        <span className="personality-trigger-icon">
          <Icon name={currentPersona.icon} size={18} />
        </span>
      </button>

      {open && (
        <div className="personality-popover">
          <div className="personality-popover-header ui-font">选择人格</div>
          <div className="personality-grid">
            {PERSONALITIES.map((p) => (
              <button
                key={p.id}
                className={`personality-card personality-card-${p.id}${p.id === current ? " active" : ""}`}
                onClick={() => select(p.id)}
              >
                <span className="personality-card-icon" aria-hidden="true">
                  <Icon name={p.icon} size={18} />
                </span>
                <span className="personality-card-copy">
                  <span className="personality-card-name ui-font">{p.name}</span>
                  <span className="personality-card-desc">{p.description}</span>
                </span>
                {p.id === current && <Icon name="check" size={14} className="personality-card-check" />}
              </button>
            ))}
          </div>
          <div className="personality-popover-hint">
            当前 <span>{currentPersona.name}</span>
          </div>
        </div>
      )}

      {!isDefault && (
        <div className="personality-current-tag ui-font">
          <Icon name={currentPersona.icon} size={12} />
          <span className="personality-current-name">{currentPersona.name}</span>
          <button
            className="personality-current-clear"
            onClick={reset}
            title="重置为默认"
          >
            <Icon name="close" size={11} />
          </button>
        </div>
      )}
    </div>
  );
}
