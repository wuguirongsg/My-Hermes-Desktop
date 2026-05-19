import { useEffect } from "react";

interface Props {
  onClose: () => void;
}

const isMac = navigator.platform.toLowerCase().includes("mac");
const mod = isMac ? "⌘" : "Ctrl";
const shift = isMac ? "⇧" : "Shift";

const SHORTCUTS = [
  {
    group: "全局",
    items: [
      { keys: [mod, shift, "H"], label: "显示 / 隐藏窗口" },
      { keys: [mod, "/"], label: "快捷键速查面板" },
    ],
  },
  {
    group: "会话",
    items: [
      { keys: [mod, "N"], label: "新建会话" },
    ],
  },
  {
    group: "对话输入",
    items: [
      { keys: ["Enter"], label: "发送消息" },
      { keys: [shift, "Enter"], label: "换行" },
      { keys: ["Esc"], label: "取消 / 关闭面板" },
    ],
  },
  {
    group: "面板",
    items: [
      { keys: [mod, "W"], label: "关闭当前面板" },
      { keys: [mod, "K"], label: "打开快照面板" },
    ],
  },
];

export default function KeyboardShortcutsPanel({ onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="kbd-panel-overlay" onClick={onClose}>
      <div className="kbd-panel" onClick={(e) => e.stopPropagation()}>
        <div className="kbd-panel-header">
          <span className="kbd-panel-title">快捷键</span>
          <button className="kbd-panel-close" onClick={onClose} title="关闭">✕</button>
        </div>
        <div className="kbd-panel-body">
          {SHORTCUTS.map((section) => (
            <div key={section.group} className="kbd-section">
              <div className="kbd-section-label">{section.group}</div>
              {section.items.map((item) => (
                <div key={item.label} className="kbd-row">
                  <span className="kbd-row-label">{item.label}</span>
                  <span className="kbd-row-keys">
                    {item.keys.map((k, i) => (
                      <kbd key={i} className="kbd-key">{k}</kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
