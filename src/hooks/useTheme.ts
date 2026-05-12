import { useState, useEffect } from "react";

export type Theme = "claude" | "apple";

const STORAGE_KEY = "hermes-theme";

function applyTheme(theme: Theme) {
  if (theme === "apple") {
    document.documentElement.setAttribute("data-theme", "apple");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as Theme) === "apple"
        ? "apple"
        : "claude";
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

  const toggle = () => setTheme((t) => (t === "claude" ? "apple" : "claude"));

  return { theme, toggle };
}
