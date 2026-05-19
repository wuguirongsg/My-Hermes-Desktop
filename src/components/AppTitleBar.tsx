import { useEffect, useRef, useState } from "react";
import { getWindowMenu, type AppMenuAction, type AppMenuSection } from "../appMenu";
import type { PlatformKind } from "../utils/platform";
import Icon from "./Icon";

interface Props {
  platform: PlatformKind;
  currentPath: string;
  onAction: (action: AppMenuAction) => void;
}

function pageLabel(path: string) {
  switch (path) {
    case "/memory":
      return "Memory";
    case "/dashboard":
      return "Dashboard";
    case "/settings":
      return "Settings";
    case "/onboarding":
      return "Setup";
    default:
      return "Chat";
  }
}

async function withCurrentWindow(action: "minimize" | "toggleMaximize" | "close" | "startDragging") {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const appWindow = getCurrentWindow();
    if (action === "minimize") await appWindow.minimize();
    if (action === "toggleMaximize") await appWindow.toggleMaximize();
    if (action === "close") await appWindow.close();
    if (action === "startDragging") await appWindow.startDragging();
  } catch (error) {
    console.warn(`Window control failed: ${action}`, error);
  }
}

export default function AppTitleBar({ platform, currentPath, onAction }: Props) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menu = getWindowMenu(platform);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const showWindowControls = platform !== "macos";

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const runAction = (action: AppMenuAction) => {
    setOpenMenu(null);
    onAction(action);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as Element;
    if (target.closest("button, input, a, [role='button']")) return;
    void withCurrentWindow("startDragging");
  };

  return (
    <div ref={rootRef} className={`app-titlebar app-titlebar-${platform}`} onMouseDown={handleMouseDown}>
      <div className="app-titlebar-left">
        <div className="app-titlebar-brand" title="Hermes Desktop">
          <span className="brand-mark app-titlebar-mark" aria-hidden="true">
            <Icon name="spark" size={13} />
          </span>
          <span>Hermes</span>
        </div>

        {menu.length > 0 && (
          <nav className="app-titlebar-menu" aria-label="Application menu">
            {menu.map((section: AppMenuSection) => (
              <div key={section.label} className="app-titlebar-menu-root">
                <button
                  className={`app-titlebar-menu-btn${openMenu === section.label ? " active" : ""}`}
                  onClick={() => setOpenMenu((value) => (value === section.label ? null : section.label))}
                >
                  {section.label}
                </button>
                {openMenu === section.label && (
                  <div className="app-titlebar-menu-popover">
                    {section.items.map((item) => (
                      <button
                        key={`${section.label}-${item.label}`}
                        className="app-titlebar-menu-item"
                        disabled={!item.action}
                        onClick={() => item.action && runAction(item.action)}
                      >
                        <span>{item.label}</span>
                        {item.shortcut && <kbd>{item.shortcut}</kbd>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        )}
      </div>

      <div className="app-titlebar-center">
        <span className="app-titlebar-context">hermes-desktop</span>
        <span className="app-titlebar-dot" />
        <span className="app-titlebar-context muted">{pageLabel(currentPath)}</span>
      </div>

      <div className="app-titlebar-actions">
        <button className="app-titlebar-icon-btn" title="新建会话" onClick={() => runAction("new-session")}>
          <Icon name="edit" size={13} />
        </button>
        <button className="app-titlebar-icon-btn" title="快照时间线" onClick={() => runAction("toggle-snapshot")}>
          <Icon name="timer" size={13} />
        </button>
        <button className="app-titlebar-icon-btn" title="Terminal" onClick={() => runAction("toggle-terminal")}>
          <Icon name="terminal" size={13} />
        </button>
      </div>

      {showWindowControls && (
        <div className="app-window-controls">
          <button aria-label="Minimize" onClick={() => void withCurrentWindow("minimize")}>-</button>
          <button aria-label="Maximize" onClick={() => void withCurrentWindow("toggleMaximize")}>□</button>
          <button aria-label="Close" className="close" onClick={() => void withCurrentWindow("close")}>×</button>
        </div>
      )}
    </div>
  );
}
