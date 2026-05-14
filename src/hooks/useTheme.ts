import { useState, useEffect } from "react";

export type Theme = "claude" | "apple" | "warp";

const STORAGE_KEY = "hermes-theme";
export const THEMES: Theme[] = ["claude", "apple", "warp"];

function applyTheme(theme: Theme) {
  if (theme === "apple" || theme === "warp") {
    document.documentElement.setAttribute("data-theme", theme);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Theme;
      return THEMES.includes(saved) ? saved : "claude";
    } catch {
      return "claude";
    }
  });

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  const toggle = () =>
    setTheme((t) => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length]);

  return { theme, setTheme, toggle };
}
