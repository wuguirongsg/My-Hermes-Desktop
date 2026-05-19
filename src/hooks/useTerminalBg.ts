import { useState, useEffect } from "react";

export type TerminalBg = "dark" | "glass" | "ocean" | "sunset" | "forest";

export const TERMINAL_BGS: TerminalBg[] = ["dark", "glass", "ocean", "sunset", "forest"];

const STORAGE_KEY = "hermes-terminal-bg";

export function xtermBackground(bg: TerminalBg): string {
  if (bg === "dark") return "#0d1117";
  // glass：半透明暗膜叠在渐变底色上，透出底色产生深度感
  if (bg === "glass") return "rgba(13, 17, 23, 0.52)";
  // 其他渐变模式：全透明，渐变直接透出
  return "rgba(0, 0, 0, 0)";
}

export function useTerminalBg() {
  const [terminalBg, setTerminalBg] = useState<TerminalBg>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as TerminalBg;
      return TERMINAL_BGS.includes(saved) ? saved : "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, terminalBg);
    } catch {}
  }, [terminalBg]);

  return { terminalBg, setTerminalBg };
}
