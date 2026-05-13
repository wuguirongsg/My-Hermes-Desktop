import { useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import Icon from "./Icon";

interface Props {
  sessionId: string | null;
  onClose: () => void;
}

export default function TerminalPanel({ sessionId, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sizeRef = useRef<{ rows: number; cols: number } | null>(null);
  const ptyId = useRef(`pty-${Date.now()}`);
  const unlistenRef = useRef<(() => void) | null>(null);

  const doClose = useCallback(() => {
    invoke("pty_close", { ptyId: ptyId.current }).catch(() => {});
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    let openFrame: number | null = null;
    let resizeFrame: number | null = null;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 13,
      lineHeight: 1.3,
      theme: {
        background: "#0d1117",
        foreground: "#e6edf3",
        cursor: "#58a6ff",
        selectionBackground: "#264f78",
        black: "#0d1117", red: "#ff7b72", green: "#3fb950",
        yellow: "#d29922", blue: "#58a6ff", magenta: "#bc8cff",
        cyan: "#39c5cf", white: "#e6edf3",
        brightBlack: "#6e7681", brightRed: "#ffa198", brightGreen: "#56d364",
        brightYellow: "#e3b341", brightBlue: "#79c0ff", brightMagenta: "#d2a8ff",
        brightCyan: "#56d4dd", brightWhite: "#f0f6fc",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    listen<string>(`pty:${ptyId.current}`, (event) => {
      term.write(event.payload);
    }).then((u) => {
      if (disposed) {
        u();
      } else {
        unlistenRef.current = u;
      }
    });

    term.onData((data) => {
      invoke("pty_write", { ptyId: ptyId.current, data }).catch(() => {});
    });

    openFrame = window.requestAnimationFrame(() => {
      fitAddon.fit();
      const { rows, cols } = term;
      sizeRef.current = { rows, cols };
      invoke("pty_open", { ptyId: ptyId.current, sessionId, rows, cols })
        .catch((e) => term.writeln(`\r\n\x1b[31mFailed to open terminal: ${e}\x1b[0m`));
    });

    const ro = new ResizeObserver(() => {
      if (resizeFrame !== null) {
        window.cancelAnimationFrame(resizeFrame);
      }
      resizeFrame = window.requestAnimationFrame(() => {
        fitAddon.fit();
        const { rows, cols } = term;
        const prev = sizeRef.current;
        if (prev?.rows === rows && prev?.cols === cols) return;
        sizeRef.current = { rows, cols };
        invoke("pty_resize", { ptyId: ptyId.current, rows, cols }).catch(() => {});
      });
    });
    ro.observe(containerRef.current);

    return () => {
      disposed = true;
      if (openFrame !== null) window.cancelAnimationFrame(openFrame);
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
      ro.disconnect();
      unlistenRef.current?.();
      unlistenRef.current = null;
      invoke("pty_close", { ptyId: ptyId.current }).catch(() => {});
      term.dispose();
    };
  }, [sessionId]);

  return (
    <div className="terminal-panel">
      <div className="terminal-panel-header">
        <span className="terminal-panel-title">
          <Icon name="terminal" size={14} />
          Hermes TUI
        </span>
        <span className="terminal-panel-hint">交互式 TUI，会接入当前会话</span>
        <button className="terminal-panel-close" onClick={doClose} title="关闭终端">
          <Icon name="close" size={14} />
        </button>
      </div>
      <div ref={containerRef} className="terminal-panel-body" />
    </div>
  );
}
