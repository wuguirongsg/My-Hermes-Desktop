import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Session, Message, StreamChunk, HermesStatus } from "../types";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/topbar/TopBar";
import ChatView from "../components/ChatView";
import TerminalPanel from "../components/TerminalPanel";
import { getLastUserText } from "../utils/messageActions";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function parseHistoryMessages(raw: unknown): Message[] {
  let items: unknown[];
  if (Array.isArray(raw)) {
    items = raw;
  } else if (raw && typeof raw === "object" && "messages" in raw) {
    const m = (raw as Record<string, unknown>).messages;
    items = Array.isArray(m) ? m : [];
  } else {
    return [];
  }

  const messages: Message[] = [];
  for (const item of items as Record<string, unknown>[]) {
    const role = item.role as string;
    if (role !== "user" && role !== "assistant") continue;

    let text = "";
    const content = item.content;
    if (typeof content === "string") {
      text = content.trim();
    } else if (Array.isArray(content)) {
      text = (content as Record<string, unknown>[])
        .filter((b) => b.type === "text")
        .map((b) => String(b.text ?? ""))
        .join("\n")
        .trim();
    }
    if (!text) continue;

    const timestamp =
      item.timestamp ??
      item.created_at ??
      item.createdAt ??
      item.time ??
      item.updated_at;

    messages.push({
      id: uid(),
      role: role as "user" | "assistant",
      blocks: [{ type: "text", content: text }],
      timestamp: typeof timestamp === "string" ? timestamp : "",
      status: "done",
    });
  }
  return messages;
}

function parseStatusLine(line: string): Partial<HermesStatus> | null {
  const parts = line.split(/[│|]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  const modelPart = parts[0].replace(/^[⚕⚡\s]+/, "").trim();
  const tokenPart = parts.find((p) => /[\d.]+[KMB]?\/[\d.]+[KMB]?/.test(p)) || "";
  const tokenMatch = tokenPart.match(/([\d.]+[KMB]?)\/([\d.]+[KMB]?)/);
  const costPart = parts.find((p) => p.startsWith("$")) || "";
  const durationPart = parts.reverse().find((p) => /^\d+[smh]/.test(p.trim())) || "";

  return {
    model: modelPart,
    tokensUsed: tokenMatch?.[1] || "",
    tokensMax: tokenMatch?.[2] || "",
    cost: costPart,
    duration: durationPart.trim(),
    raw: line,
  };
}

// ─── ChatPage ─────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState<HermesStatus | null>(null);
  const [hermesVersion, setHermesVersion] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [toolCallCount, setToolCallCount] = useState(0);

  const unlistenRef = useRef<(() => void) | null>(null);
  const justFinishedRef = useRef(false);
  const activeSession = activeSessionId ? sessions.find((s) => s.id === activeSessionId) : null;

  const loadSessions = useCallback(async () => {
    try {
      const s = await invoke<Session[]>("list_sessions");
      setSessions(s);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const loadHermesInfo = useCallback(async () => {
    try {
      const info = await invoke<{ version: string }>("get_hermes_info");
      setHermesVersion(info.version);
    } catch {
      setHermesVersion("not found");
    }
  }, []);

  useEffect(() => {
    loadSessions();
    loadHermesInfo();
  }, []);

  useEffect(() => {
    if (!streaming && justFinishedRef.current) {
      justFinishedRef.current = false;
      loadSessions();
      const t = setTimeout(() => loadSessions(), 1500);
      return () => clearTimeout(t);
    }
  }, [streaming, loadSessions]);

  useEffect(() => {
    if (!activeSessionId) return;
    const session = sessions.find((s) => s.id === activeSessionId);
    if (session?.model) {
      setStatus((s) => ({ ...(s ?? {} as HermesStatus), model: session.model! }));
    }
  }, [sessions, activeSessionId]);

  const handleSelectSession = useCallback(async (id: string) => {
    setActiveSessionId(id);
    setMessages([]);
    setError(null);
    setToolCallCount(0);
    const session = sessions.find((s) => s.id === id);
    if (session?.model) {
      setStatus((s) => ({ ...(s ?? {} as HermesStatus), model: session.model! }));
    }
    try {
      const raw = await invoke<unknown>("get_session_history", { sessionId: id });
      setMessages(parseHistoryMessages(raw));
    } catch (e) {
      setError(String(e));
    }
  }, [sessions]);

  const handleNewSession = useCallback(() => {
    setActiveSessionId(null);
    setMessages([]);
    setError(null);
    setToolCallCount(0);
    setStatus(null);
  }, []);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      try {
        await invoke("delete_session", { sessionId: id });
        if (activeSessionId === id) handleNewSession();
        await loadSessions();
      } catch (e) {
        setError(String(e));
      }
    },
    [activeSessionId, handleNewSession, loadSessions]
  );

  const handleRenameSession = useCallback(
    async (title: string): Promise<boolean> => {
      if (!activeSessionId) return false;
      const nextTitle = title.trim();
      if (!nextTitle) return false;

      setError(null);
      setSessions((prev) =>
        prev.map((session) =>
          session.id === activeSessionId ? { ...session, title: nextTitle } : session
        )
      );

      try {
        await invoke("rename_session", { sessionId: activeSessionId, title: nextTitle });
        await loadSessions();
        return true;
      } catch (e) {
        setError(String(e));
        await loadSessions();
        return false;
      }
    },
    [activeSessionId, loadSessions]
  );

  const handleSlashCommand = useCallback((text: string): boolean => {
    const cmd = text.trim().toLowerCase();
    if (!cmd.startsWith("/")) return false;
    if (cmd.split(/\s+/)[0] === "/clear") {
      handleNewSession();
      return true;
    }
    return false;
  }, [handleNewSession]);

  const handleSendMessage = useCallback(
    async (text: string, options?: { hideUserMessage?: boolean }) => {
      if (!text.trim() || streaming) return;
      setError(null);

      if (handleSlashCommand(text)) return;

      const userMsg: Message = {
        id: uid(),
        role: "user",
        blocks: [{ type: "text", content: text.trim() }],
        timestamp: new Date().toISOString(),
        status: "done",
      };

      const assistantId = uid();
      const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        blocks: [],
        timestamp: new Date().toISOString(),
        status: "streaming",
      };

      setMessages((prev) =>
        options?.hideUserMessage ? [...prev, assistantMsg] : [...prev, userMsg, assistantMsg]
      );
      setStreaming(true);

      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }

      const unlisten = await listen<StreamChunk>("hermes:chunk", (event) => {
        const chunk = event.payload;

        if (chunk.kind === "tool_name") {
          setToolCallCount((n) => n + 1);
        }

        setMessages((prev) => {
          const msgs = [...prev];
          const idx = msgs.findIndex((m) => m.id === assistantId);
          if (idx === -1) return prev;

          const msg = { ...msgs[idx] };
          const blocks = [...msg.blocks];

          switch (chunk.kind) {
            case "raw": {
              msg.rawOutput = msg.rawOutput
                ? `${msg.rawOutput}\n${chunk.content}`
                : chunk.content;
              break;
            }
            case "text": {
              const last = blocks[blocks.length - 1];
              if (last?.type === "text") {
                const next = last.content + "\n" + chunk.content;
                // collapse 3+ consecutive newlines to 2 (avoid excess blank lines)
                blocks[blocks.length - 1] = { ...last, content: next.replace(/\n{3,}/g, "\n\n") };
              } else if (chunk.content.trim()) {
                blocks.push({ type: "text", content: chunk.content });
              }
              break;
            }
            case "think_start":
              blocks.push({ type: "think", content: "" });
              break;
            case "think": {
              const last = blocks[blocks.length - 1];
              if (last?.type === "think") {
                blocks[blocks.length - 1] = {
                  ...last,
                  content: last.content + (last.content ? "\n" : "") + chunk.content,
                };
              }
              break;
            }
            case "think_end":
              break;
            case "tool_name":
              blocks.push({ type: "tool", name: chunk.content || "tool", input: "", output: "", outputDone: false });
              break;
            case "tool_input": {
              const last = blocks[blocks.length - 1];
              if (last?.type === "tool") {
                blocks[blocks.length - 1] = { ...last, input: last.input + (last.input ? "\n" : "") + chunk.content };
              }
              break;
            }
            case "tool_output": {
              const last = blocks[blocks.length - 1];
              if (last?.type === "tool") {
                blocks[blocks.length - 1] = { ...last, output: last.output + (last.output ? "\n" : "") + chunk.content };
              }
              break;
            }
            case "tool_output_end": {
              const last = blocks[blocks.length - 1];
              if (last?.type === "tool") {
                blocks[blocks.length - 1] = { ...last, outputDone: true };
              }
              break;
            }
            case "status": {
              const parsed = parseStatusLine(chunk.content);
              if (parsed) setStatus((s) => ({ ...(s ?? {}), ...parsed } as HermesStatus));
              break;
            }
            case "session_stat": {
              const line = chunk.content;
              if (line.startsWith("Duration:")) {
                setStatus((s) => ({ ...(s ?? {}), duration: line.replace(/^Duration:\s*/, "").trim() } as HermesStatus));
              } else if (line.startsWith("Messages:")) {
                setStatus((s) => ({ ...(s ?? {}), msgCount: line.replace(/^Messages:\s*/, "").trim() } as HermesStatus));
              }
              break;
            }
            case "new_session_id":
              setActiveSessionId(chunk.content);
              break;
            case "error":
              setError(chunk.content);
              msg.status = "error";
              msg.rawOutput = msg.rawOutput
                ? `${msg.rawOutput}\n${chunk.content}`
                : chunk.content;
              break;
            case "done":
              if (msg.status !== "error") {
                msg.status = "done";
              }
              justFinishedRef.current = true;
              setStreaming(false);
              break;
          }

          msgs[idx] = { ...msg, blocks };
          return msgs;
        });
      });

      unlistenRef.current = unlisten;

      try {
        await invoke("send_message", { sessionId: activeSessionId, message: text.trim() });
      } catch (e) {
        const message = String(e);
        setError(message);
        setStreaming(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  rawOutput: m.rawOutput ? `${m.rawOutput}\n${message}` : message,
                  status: "error",
                }
              : m
          )
        );
      }
    },
    [streaming, activeSessionId, loadSessions, handleSlashCommand]
  );

  const handleRetryLastMessage = useCallback(() => {
    if (streaming) return;
    const lastUserText = getLastUserText(messages);
    if (!lastUserText) return;

    const removeLastAssistant = () => setMessages((prev) => {
      const lastAssistantIdx = [...prev].reverse().findIndex((m) => m.role === "assistant");
      if (lastAssistantIdx < 0) return prev;
      return prev.slice(0, prev.length - 1 - lastAssistantIdx);
    });

    const resend = () => {
      removeLastAssistant();
      handleSendMessage(lastUserText, { hideUserMessage: true });
    };
    resend();
  }, [streaming, messages, handleSendMessage]);

  return (
    <div className="app-layout">
      <TopBar
        streaming={streaming}
        status={status}
        hermesVersion={hermesVersion}
        toolCallCount={toolCallCount}
        sessionTitle={activeSession?.title ?? null}
        onOpenTerminal={() => setTerminalOpen(true)}
        onSendMessage={handleSendMessage}
        onNewSession={handleNewSession}
        onRenameSession={handleRenameSession}
      />
      <Sidebar
        sessions={sessions}
        activeId={activeSessionId}
        onSelect={handleSelectSession}
        onNew={handleNewSession}
        onDelete={handleDeleteSession}
      />
      <div className="content-area">
        {terminalOpen && (
          <TerminalPanel sessionId={activeSessionId} onClose={() => setTerminalOpen(false)} />
        )}
        <ChatView
          messages={messages}
          streaming={streaming}
          onSend={handleSendMessage}
          onRetryLastMessage={handleRetryLastMessage}
          error={error}
          hasSession={activeSessionId !== null || messages.length > 0}
        />
      </div>
    </div>
  );
}
