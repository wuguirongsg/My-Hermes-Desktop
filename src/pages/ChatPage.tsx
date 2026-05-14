import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Session, Message, StreamChunk, HermesStatus } from "../types";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/topbar/TopBar";
import ChatView from "../components/ChatView";
import TerminalPanel from "../components/TerminalPanel";
import SnapshotPanel from "../components/SnapshotPanel";
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
  // Global app state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [hermesVersion, setHermesVersion] = useState<string>("");
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [snapshotPanelOpen, setSnapshotPanelOpen] = useState(false);
  const [snapshotCreateCount, setSnapshotCreateCount] = useState(0);

  // Per-session states
  const [sessionMessages, setSessionMessages] = useState<Record<string, Message[]>>({});
  const [sessionQueues, setSessionQueues] = useState<Record<string, string[]>>({});
  const [streamingSessions, setStreamingSessions] = useState<Set<string>>(new Set());
  const [sessionStatus, setSessionStatus] = useState<Record<string, HermesStatus>>({});
  const [sessionErrors, setSessionErrors] = useState<Record<string, string | null>>({});
  const [sessionToolCallCounts, setSessionToolCallCounts] = useState<Record<string, number>>({});
  const [sessionBadges, setSessionBadges] = useState<Record<string, "running" | "queued" | "done">>({});

  // Refs
  const justFinishedRef = useRef<Record<string, boolean>>({});
  const prevStreamingRef = useRef<Set<string>>(new Set());
  const activeSessionIdRef = useRef(activeSessionId);
  const prevStreamingForQueueRef = useRef<Set<string>>(new Set());

  // Derived values for current active session
  const activeSession = activeSessionId ? sessions.find((s) => s.id === activeSessionId) : null;
  const messages = activeSessionId ? (sessionMessages[activeSessionId] ?? []) : [];
  const queue = activeSessionId ? (sessionQueues[activeSessionId] ?? []) : [];
  const streaming = activeSessionId ? streamingSessions.has(activeSessionId) : false;
  const status = activeSessionId ? (sessionStatus[activeSessionId] ?? null) : null;
  const error = activeSessionId ? (sessionErrors[activeSessionId] ?? null) : null;
  const toolCallCount = activeSessionId ? (sessionToolCallCounts[activeSessionId] ?? 0) : 0;

  activeSessionIdRef.current = activeSessionId;

  const loadSessions = useCallback(async () => {
    try {
      const s = await invoke<Session[]>("list_sessions");
      setSessions(s);
    } catch (e) {
      setSessionErrors((prev) => ({ ...prev, global: String(e) }));
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

  // Auto-refresh sessions after any streaming session finishes
  useEffect(() => {
    const prev = prevStreamingRef.current;
    const current = streamingSessions;

    prev.forEach((sessionId) => {
      if (!current.has(sessionId) && justFinishedRef.current[sessionId]) {
        justFinishedRef.current[sessionId] = false;
        loadSessions();
        const t = setTimeout(() => loadSessions(), 1500);
        return () => clearTimeout(t);
      }
    });

    prevStreamingRef.current = new Set(current);
  }, [streamingSessions, loadSessions]);

  const handleSelectSession = useCallback(async (id: string) => {
    setActiveSessionId(id);
    setSessionErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSessionBadges((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSessionToolCallCounts((prev) => ({ ...prev, [id]: 0 }));

    const session = sessions.find((s) => s.id === id);
    if (session?.model) {
      setSessionStatus((prev) => ({
        ...prev,
        [id]: { ...(prev[id] ?? ({} as HermesStatus)), model: session.model! },
      }));
    }

      if (sessionMessages[id]?.length > 0) return;

    try {
      const raw = await invoke<unknown>("get_session_history", { sessionId: id });
      setSessionMessages((prev) => ({ ...prev, [id]: parseHistoryMessages(raw) }));
    } catch (e) {
      setSessionErrors((prev) => ({ ...prev, [id]: String(e) }));
    }
  }, [sessions, sessionMessages]);

  const handleNewSession = useCallback(() => {
    setActiveSessionId(null);
    setSessionErrors((prev) => {
      const next = { ...prev };
      delete next.global;
      return next;
    });
    setSessionStatus((prev) => {
      const next = { ...prev };
      delete next[activeSessionId ?? ""];
      return next;
    });
  }, [activeSessionId]);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      try {
        await invoke("delete_session", { sessionId: id });
        if (activeSessionId === id) handleNewSession();
        setSessionMessages((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setSessionQueues((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setStreamingSessions((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setSessionStatus((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setSessionErrors((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setSessionToolCallCounts((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setSessionBadges((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        await loadSessions();
      } catch (e) {
        setSessionErrors((prev) => ({ ...prev, global: String(e) }));
      }
    },
    [activeSessionId, handleNewSession, loadSessions]
  );

  const handleRenameSession = useCallback(
    async (title: string): Promise<boolean> => {
      if (!activeSessionId) return false;
      const nextTitle = title.trim();
      if (!nextTitle) return false;

      setSessionErrors((prev) => {
        const next = { ...prev };
        delete next[activeSessionId];
        return next;
      });
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
        setSessionErrors((prev) => ({ ...prev, [activeSessionId]: String(e) }));
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

  const sendToSession = useCallback(
    async (text: string, targetSessionId: string | null, options?: { hideUserMessage?: boolean }) => {
      if (!text.trim()) return;

      const realSessionId = targetSessionId?.trim() || null;
      const sessionTag = realSessionId ?? `new_${Date.now()}`;

      if (streamingSessions.has(sessionTag)) {
        setSessionQueues((prev) => ({
          ...prev,
          [sessionTag]: [...(prev[sessionTag] ?? []), text.trim()],
        }));
        setSessionBadges((prev) => ({ ...prev, [sessionTag]: "queued" }));
        return;
      }

      if (handleSlashCommand(text)) return;

      // Track /snapshot create to keep SnapshotPanel in sync
      if (text.trim() === "/snapshot create") {
        setSnapshotCreateCount((c) => c + 1);
      }

      if (!realSessionId) {
        setActiveSessionId(sessionTag);
        // Insert a placeholder session entry so the new chat appears in the
        // sidebar immediately. It will be migrated to the real id when the
        // "new_session_id" chunk arrives, then replaced by loadSessions().
        const placeholderTitle = text.trim().slice(0, 60);
        const nowIso = new Date().toISOString();
        setSessions((prev) =>
          prev.some((s) => s.id === sessionTag)
            ? prev
            : [
                {
                  id: sessionTag,
                  title: placeholderTitle,
                  created_at: nowIso,
                  updated_at: nowIso,
                  message_count: 1,
                },
                ...prev,
              ]
        );
        setSessionBadges((prev) => ({ ...prev, [sessionTag]: "running" }));
      }

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

      setSessionMessages((prev) => ({
        ...prev,
        [sessionTag]: options?.hideUserMessage
          ? [...(prev[sessionTag] ?? []), assistantMsg]
          : [...(prev[sessionTag] ?? []), userMsg, assistantMsg],
      }));
      setStreamingSessions((prev) => new Set(prev).add(sessionTag));
      setSessionBadges((prev) => {
        const next = { ...prev };
        delete next[sessionTag];
        return next;
      });
      setSessionErrors((prev) => {
        const next = { ...prev };
        delete next[sessionTag];
        return next;
      });

      try {
        await invoke("send_message", {
          sessionId: realSessionId,
          message: text.trim(),
          sessionTag,
        });
      } catch (e) {
        const message = String(e);
        setSessionErrors((prev) => ({ ...prev, [sessionTag]: message }));
        setStreamingSessions((prev) => {
          const next = new Set(prev);
          next.delete(sessionTag);
          return next;
        });
        setSessionMessages((prev) => {
          const msgs = [...(prev[sessionTag] ?? [])];
          const lastAssistantIdx = [...msgs].reverse().findIndex((m) => m.role === "assistant");
          if (lastAssistantIdx >= 0) {
            const idx = msgs.length - 1 - lastAssistantIdx;
            msgs[idx] = {
              ...msgs[idx],
              rawOutput: msgs[idx].rawOutput ? `${msgs[idx].rawOutput}\n${message}` : message,
              status: "error",
            };
          }
          return { ...prev, [sessionTag]: msgs };
        });
      }
    },
    [streamingSessions, handleSlashCommand]
  );

  // Auto-send queued messages when a session finishes
  useEffect(() => {
    const prev = prevStreamingForQueueRef.current;
    const current = streamingSessions;

    prev.forEach((sessionId) => {
      if (!current.has(sessionId)) {
        const queue = sessionQueues[sessionId];
        if (queue && queue.length > 0) {
          const text = queue[0];
          setSessionQueues((prevQs) => ({
            ...prevQs,
            [sessionId]: prevQs[sessionId]?.slice(1) ?? [],
          }));
          setTimeout(() => {
            sendToSession(text, sessionId);
          }, 100);
        }
      }
    });

    prevStreamingForQueueRef.current = new Set(current);
  }, [streamingSessions, sessionQueues, sendToSession]);

  const handleSendMessage = useCallback(
    async (text: string, options?: { hideUserMessage?: boolean }) => {
      if (!activeSessionId && !text.trim().startsWith("/")) {
        await sendToSession(text, null, options);
        return;
      }
      await sendToSession(text, activeSessionId, options);
    },
    [activeSessionId, sendToSession]
  );

  const handleRetryLastMessage = useCallback(() => {
    if (!activeSessionId || streaming) return;
    const msgs = sessionMessages[activeSessionId] ?? [];
    const lastUserText = getLastUserText(msgs);
    if (!lastUserText) return;

    const removeLastAssistant = () =>
      setSessionMessages((prev) => {
        const sessionMsgs = [...(prev[activeSessionId] ?? [])];
        const lastAssistantIdx = [...sessionMsgs].reverse().findIndex((m) => m.role === "assistant");
        if (lastAssistantIdx < 0) return prev;
        return {
          ...prev,
          [activeSessionId]: sessionMsgs.slice(0, sessionMsgs.length - 1 - lastAssistantIdx),
        };
      });

    const resend = () => {
      removeLastAssistant();
      sendToSession(lastUserText, activeSessionId, { hideUserMessage: true });
    };
    resend();
  }, [activeSessionId, streaming, sessionMessages, sendToSession]);

  // ─── Global listener (registered once on mount) ─────────────────────────────

  useEffect(() => {
    let unlistenFn: (() => void) | null = null;
    let cancelled = false;

    const setup = async () => {
      const unlisten = await listen<StreamChunk>("hermes:chunk", (event) => {
        const chunk = event.payload;
        const sessionId = chunk.session_id;
        if (!sessionId) return;

        if (chunk.kind === "tool_name") {
          setSessionToolCallCounts((prev) => ({
            ...prev,
            [sessionId]: (prev[sessionId] ?? 0) + 1,
          }));
        }

        setSessionMessages((prev) => {
          const msgs = [...(prev[sessionId] ?? [])];
          const lastAssistantIdx = [...msgs]
            .reverse()
            .findIndex((m) => m.role === "assistant" && m.status === "streaming");
          if (lastAssistantIdx < 0) return prev;
          const idx = msgs.length - 1 - lastAssistantIdx;

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
                blocks[blocks.length - 1] = {
                  ...last,
                  content: next.replace(/\n{3,}/g, "\n\n"),
                };
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
                  content:
                    last.content + (last.content ? "\n" : "") + chunk.content,
                };
              }
              break;
            }
            case "think_end":
              break;
            case "tool_name":
              blocks.push({
                type: "tool",
                name: chunk.content || "tool",
                input: "",
                output: "",
                outputDone: false,
              });
              break;
            case "tool_input": {
              const last = blocks[blocks.length - 1];
              if (last?.type === "tool") {
                blocks[blocks.length - 1] = {
                  ...last,
                  input: last.input + (last.input ? "\n" : "") + chunk.content,
                };
              }
              break;
            }
            case "tool_output": {
              const last = blocks[blocks.length - 1];
              if (last?.type === "tool") {
                blocks[blocks.length - 1] = {
                  ...last,
                  output: last.output + (last.output ? "\n" : "") + chunk.content,
                };
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
          }

          if (chunk.kind === "error") {
            setSessionErrors((ePrev) => ({
              ...ePrev,
              [sessionId]: chunk.content,
            }));
            msg.status = "error";
            msg.rawOutput = msg.rawOutput
              ? `${msg.rawOutput}\n${chunk.content}`
              : chunk.content;
          }

          if (chunk.kind === "done") {
            if (msg.status !== "error") {
              msg.status = "done";
            }
          }

          msgs[idx] = { ...msg, blocks };
          return { ...prev, [sessionId]: msgs };
        });

        // Done cleanup runs unconditionally — must not be inside setSessionMessages
        // because an early-return (lastAssistantIdx < 0) would skip these operations,
        // leaving the session permanently stuck in "streaming" state.
        if (chunk.kind === "done") {
          justFinishedRef.current[sessionId] = true;
          setStreamingSessions((sPrev) => {
            const next = new Set(sPrev);
            next.delete(sessionId);
            return next;
          });
          setSessionBadges((bPrev) => {
            if (activeSessionIdRef.current === sessionId) return bPrev;
            return { ...bPrev, [sessionId]: "done" };
          });

          // Streaming accumulates text by line-trim + chunk-stitch, which loses
          // code-block indentation and splits markdown across blocks when tool
          // calls interleave. The hermes-saved JSON is the canonical source —
          // reload it to render with full fidelity (same path as session switch).
          // Small delay lets hermes flush its final write to disk.
          setTimeout(async () => {
            try {
              const raw = await invoke<unknown>("get_session_history", {
                sessionId,
              });
              const reloaded = parseHistoryMessages(raw);
              if (reloaded.length === 0) return;
              setSessionMessages((prev) => {
                const current = prev[sessionId] ?? [];
                // Preserve any messages already started for the next queued turn
                // (a fresh user+streaming-assistant pair appended after this done).
                // Find the earliest still-streaming assistant; everything from the
                // user before it onward belongs to the next round.
                const streamingIdx = current.findIndex(
                  (m) => m.role === "assistant" && m.status === "streaming"
                );
                if (streamingIdx < 0) {
                  return { ...prev, [sessionId]: reloaded };
                }
                const splitIdx =
                  streamingIdx > 0 && current[streamingIdx - 1].role === "user"
                    ? streamingIdx - 1
                    : streamingIdx;
                return {
                  ...prev,
                  [sessionId]: [...reloaded, ...current.slice(splitIdx)],
                };
              });
            } catch {
              // ignore — keep streamed blocks as fallback
            }
          }, 300);
        }

        if (chunk.kind === "status") {
          const parsed = parseStatusLine(chunk.content);
          if (parsed) {
            setSessionStatus((prev) => ({
              ...prev,
              [sessionId]: { ...(prev[sessionId] ?? ({} as HermesStatus)), ...parsed } as HermesStatus,
            }));
          }
        }

        if (chunk.kind === "session_stat") {
          const line = chunk.content;
          setSessionStatus((prev) => {
            const current = prev[sessionId] ?? ({} as HermesStatus);
            if (line.startsWith("Duration:")) {
              return {
                ...prev,
                [sessionId]: {
                  ...current,
                  duration: line.replace(/^Duration:\s*/, "").trim(),
                } as HermesStatus,
              };
            } else if (line.startsWith("Messages:")) {
              return {
                ...prev,
                [sessionId]: {
                  ...current,
                  msgCount: line.replace(/^Messages:\s*/, "").trim(),
                } as HermesStatus,
              };
            }
            return prev;
          });
        }

        if (chunk.kind === "new_session_id") {
          const realId = chunk.content;
          setSessionMessages((prev) => {
            const msgs = prev[sessionId];
            if (!msgs) return prev;
            const next = { ...prev };
            delete next[sessionId];
            next[realId] = msgs;
            return next;
          });
          setSessionQueues((prev) => {
            const q = prev[sessionId];
            if (!q) return prev;
            const next = { ...prev };
            delete next[sessionId];
            next[realId] = q;
            return next;
          });
          setStreamingSessions((prev) => {
            const next = new Set(prev);
            next.delete(sessionId);
            next.add(realId);
            return next;
          });
          setSessionStatus((prev) => {
            const s = prev[sessionId];
            if (!s) return prev;
            const next = { ...prev };
            delete next[sessionId];
            next[realId] = s;
            return next;
          });
          setSessionErrors((prev) => {
            const e = prev[sessionId];
            if (!e) return prev;
            const next = { ...prev };
            delete next[sessionId];
            next[realId] = e;
            return next;
          });
          setSessionToolCallCounts((prev) => {
            const c = prev[sessionId];
            if (c === undefined) return prev;
            const next = { ...prev };
            delete next[sessionId];
            next[realId] = c;
            return next;
          });
          setSessionBadges((prev) => {
            const b = prev[sessionId];
            if (!b) return prev;
            const next = { ...prev };
            delete next[sessionId];
            next[realId] = b;
            return next;
          });
          setSessions((prev) => {
            // Migrate the placeholder sidebar entry to the real id. The
            // subsequent loadSessions() call will then refresh full metadata.
            const idx = prev.findIndex((s) => s.id === sessionId);
            if (idx < 0) return prev;
            const next = [...prev];
            next[idx] = { ...next[idx], id: realId };
            return next;
          });
          setActiveSessionId((current) => (current === sessionId ? realId : current));
        }
      });

      if (cancelled) {
        unlisten();
        return;
      }
      unlistenFn = unlisten;
    };

    setup();

    return () => {
      cancelled = true;
      if (unlistenFn) unlistenFn();
    };
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="app-layout">
      <TopBar
        streaming={streaming}
        status={status}
        hermesVersion={hermesVersion}
        toolCallCount={toolCallCount}
        sessionTitle={activeSession?.title ?? null}
        onOpenTerminal={() => setTerminalOpen(true)}
        onOpenSnapshot={() => setSnapshotPanelOpen((v) => !v)}
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
        badges={sessionBadges}
      />
      <div className="content-area">
        {terminalOpen && (
          <TerminalPanel sessionId={activeSessionId} onClose={() => setTerminalOpen(false)} />
        )}
        {snapshotPanelOpen && (
          <SnapshotPanel
            onSend={handleSendMessage}
            onClose={() => setSnapshotPanelOpen(false)}
            externalCreateCount={snapshotCreateCount}
            sessionTitle={activeSession?.title ?? "未命名会话"}
          />
        )}
        <ChatView
          messages={messages}
          streaming={streaming}
          onSend={handleSendMessage}
          onQueue={(text) => {
            if (!activeSessionId) return;
            setSessionQueues((prev) => ({
              ...prev,
              [activeSessionId]: [...(prev[activeSessionId] ?? []), text],
            }));
            setSessionBadges((prev) => ({ ...prev, [activeSessionId]: "queued" }));
          }}
          onCancelQueue={(index) => {
            if (!activeSessionId) return;
            setSessionQueues((prev) => ({
              ...prev,
              [activeSessionId]: prev[activeSessionId]?.filter((_, i) => i !== index) ?? [],
            }));
            setSessionBadges((prev) => {
              const q = sessionQueues[activeSessionId] ?? [];
              if (q.length <= 1) {
                const next = { ...prev };
                delete next[activeSessionId];
                return next;
              }
              return prev;
            });
          }}
          onClearQueue={() => {
            if (!activeSessionId) return;
            setSessionQueues((prev) => {
              const next = { ...prev };
              delete next[activeSessionId];
              return next;
            });
            setSessionBadges((prev) => {
              const next = { ...prev };
              delete next[activeSessionId];
              return next;
            });
          }}
          queue={queue}
          onRetryLastMessage={handleRetryLastMessage}
          error={error}
          hasSession={activeSessionId !== null || messages.length > 0}
        />
      </div>
    </div>
  );
}
