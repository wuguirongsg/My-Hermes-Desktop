import { useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import Icon from "./Icon";
import { useTerminalBg, xtermBackground } from "../hooks/useTerminalBg";

interface Props {
  sessionId: string | null;
  onClose: () => void;
}

export default function TerminalModal({ sessionId, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyId = useRef(`pty-${Date.now()}`);
  const unlistenRef = useRef<(() => void) | null>(null);
  const { terminalBg } = useTerminalBg();
  const terminalBgRef = useRef(terminalBg);
  terminalBgRef.current = terminalBg;

  const handleClose = useCallback(() => {
    invoke("pty_close", { ptyId: ptyId.current }).catch(() => {});
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      allowTransparency: true,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: 13,
      lineHeight: 1.0,
      theme: {
        background: xtermBackground(terminalBgRef.current),
        foreground: "#e6edf3",
        cursor: "#58a6ff",
        selectionBackground: "#264f78",
        black: "#0d1117",
        red: "#ff7b72",
        green: "#3fb950",
        yellow: "#d29922",
        blue: "#58a6ff",
        magenta: "#bc8cff",
        cyan: "#39c5cf",
        white: "#e6edf3",
        brightBlack: "#6e7681",
        brightRed: "#ffa198",
        brightGreen: "#56d364",
        brightYellow: "#e3b341",
        brightBlue: "#79c0ff",
        brightMagenta: "#d2a8ff",
        brightCyan: "#56d4dd",
        brightWhite: "#f0f6fc",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(containerRef.current);
    fitAddon.fit();
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const { rows, cols } = term;

    // Open PTY on backend
    invoke("pty_open", {
      ptyId: ptyId.current,
      sessionId,
      rows,
      cols,
    }).catch((e) => term.writeln(`\r\n\x1b[31mFailed to open terminal: ${e}\x1b[0m`));

    // Stream PTY output → xterm.js
    listen<string>(`pty:${ptyId.current}`, (event) => {
      term.write(event.payload);
    }).then((unlisten) => {
      unlistenRef.current = unlisten;
    });

    // Keyboard input → PTY
    term.onData((data) => {
      invoke("pty_write", { ptyId: ptyId.current, data }).catch(() => {});
    });

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      const { rows, cols } = term;
      invoke("pty_resize", { ptyId: ptyId.current, rows, cols }).catch(() => {});
    });
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      unlistenRef.current?.();
      invoke("pty_close", { ptyId: ptyId.current }).catch(() => {});
      term.dispose();
    };
  }, [sessionId]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = { ...term.options.theme, background: xtermBackground(terminalBg) };
  }, [terminalBg]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  return (
    <div className="terminal-overlay" onClick={handleClose}>
      <div
        className="terminal-modal"
        data-terminal-bg={terminalBg}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="terminal-modal-header">
          <span className="terminal-modal-title">
            <Icon name="terminal" size={14} />
            Hermes TUI
          </span>
          <span className="terminal-modal-hint">ESC 或点击外部关闭</span>
          <button className="terminal-modal-close" onClick={handleClose} title="关闭终端">
            <Icon name="close" size={14} />
          </button>
        </div>
        <div ref={containerRef} className="terminal-modal-body" />
      </div>
    </div>
  );
}
