import { useState, useEffect, useRef, useMemo } from "react";
import { Session } from "../types";
import Icon from "./Icon";

interface SessionTag {
  text: string;
  color: string;
}

// Natural, earthy palette aligned with the brand (terracotta primary + teal/amber accents).
const TAG_COLORS = [
  "#cc785c", // terracotta (brand)
  "#d99a5b", // amber
  "#c9a94a", // gold
  "#94a35a", // olive
  "#6faa84", // sage
  "#5db8a6", // teal
  "#6f93b8", // dusty blue
  "#a484ad", // lavender
  "#a98a72", // taupe
];

const TAGS_KEY = "hermes_session_tags";
const UNTAGGED = "__untagged__";

function loadTags(): Record<string, SessionTag> {
  try {
    return JSON.parse(localStorage.getItem(TAGS_KEY) || "{}");
  } catch {
    return {};
  }
}

interface Props {
  sessions: Session[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  badges: Record<string, "running" | "queued" | "done">;
}

const DAY = 86_400_000;

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return "刚刚";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`;
    if (diff < DAY) return `${Math.floor(diff / 3_600_000)}小时前`;
    if (diff < 3 * DAY) return `${Math.floor(diff / DAY)}天前`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return "";
  }
}

const badgeMeta: Record<Props["badges"][string], { icon: "spark" | "timer" | "check"; label: string }> = {
  running: { icon: "spark", label: "执行中" },
  queued: { icon: "timer", label: "排队中" },
  done: { icon: "check", label: "执行完成" },
};

export default function Sidebar({ sessions, activeId, onSelect, onNew, onDelete, onRefresh, badges }: Props) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  const [tags, setTags] = useState<Record<string, SessionTag>>(loadTags);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftColor, setDraftColor] = useState(TAG_COLORS[0]);

  const [filter, setFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement | null>(null);

  const persistTags = (next: Record<string, SessionTag>) => {
    setTags(next);
    localStorage.setItem(TAGS_KEY, JSON.stringify(next));
  };

  const requestDelete = (id: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPendingId(id);
    timerRef.current = setTimeout(() => setPendingId(null), 3000);
  };

  const confirmDelete = (id: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPendingId(null);
    onDelete(id);
  };

  const cancelDelete = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPendingId(null);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Close filter menu on outside click
  useEffect(() => {
    if (!filterOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [filterOpen]);

  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    onRefresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  const openTagEditor = (s: Session) => {
    const existing = tags[s.id];
    setDraftText(existing?.text ?? "");
    setDraftColor(existing?.color ?? TAG_COLORS[0]);
    setEditingTagId(s.id);
  };

  const saveTag = (id: string) => {
    const text = draftText.trim().slice(0, 5);
    if (!text) {
      clearTag(id);
      return;
    }
    persistTags({ ...tags, [id]: { text, color: draftColor } });
    setEditingTagId(null);
  };

  const clearTag = (id: string) => {
    const next = { ...tags };
    delete next[id];
    persistTags(next);
    setEditingTagId(null);
  };

  // Distinct tags currently in use, for the filter menu.
  const tagList = useMemo(() => {
    const seen = new Map<string, SessionTag>();
    for (const s of sessions) {
      const t = tags[s.id];
      if (t) {
        const key = `${t.color}|${t.text}`;
        if (!seen.has(key)) seen.set(key, t);
      }
    }
    return Array.from(seen.entries()).map(([key, t]) => ({ key, ...t }));
  }, [sessions, tags]);

  const visible = useMemo(() => {
    if (filter === null) return sessions;
    if (filter === UNTAGGED) return sessions.filter((s) => !tags[s.id]);
    return sessions.filter((s) => {
      const t = tags[s.id];
      return t && `${t.color}|${t.text}` === filter;
    });
  }, [sessions, tags, filter]);

  const groups = useMemo(() => {
    const now = Date.now();
    const recent: Session[] = [];
    const days3: Session[] = [];
    const older: Session[] = [];
    for (const s of visible) {
      const diff = now - new Date(s.updated_at).getTime();
      if (diff < DAY) recent.push(s);
      else if (diff < 3 * DAY) days3.push(s);
      else older.push(s);
    }
    return [
      { label: "24 小时内", items: recent },
      { label: "最近 3 天", items: days3 },
      { label: "更早", items: older },
    ].filter((g) => g.items.length > 0);
  }, [visible]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const filterLabel = (() => {
    if (filter === null) return "全部";
    if (filter === UNTAGGED) return "未标记";
    const found = tagList.find((t) => t.key === filter);
    return found ? found.text : "全部";
  })();

  const renderItem = (s: Session) => {
    const badge = badges[s.id];
    const meta = badge ? badgeMeta[badge] : null;
    const tag = tags[s.id];
    const full = s.title || "Untitled";
    const displayTitle = full.length > 15 ? full.slice(0, 15) + "…" : full;

    return (
      <div
        key={s.id}
        className={`session-item ${activeId === s.id ? "active" : ""}`}
        style={tag ? { borderLeftColor: activeId === s.id ? undefined : tag.color } : undefined}
        onClick={() => {
          if (pendingId === s.id) cancelDelete();
          else if (editingTagId === s.id) return;
          else onSelect(s.id);
        }}
      >
        <div className="session-item-title-row">
          <div className="session-item-title" title={full}>{displayTitle}</div>
          {tag ? (
            <button
              className="session-tag-chip"
              style={{ color: tag.color, background: `${tag.color}1f`, borderColor: `${tag.color}59` }}
              onClick={(e) => { stop(e); openTagEditor(s); }}
              title="编辑标签"
            >
              {tag.text}
            </button>
          ) : (
            <button
              className="session-tag-add"
              onClick={(e) => { stop(e); openTagEditor(s); }}
              title="添加标签"
            >
              +
            </button>
          )}
          {meta && (
            <div
              className={`session-badge session-badge--${badge}`}
              title={meta.label}
              aria-label={meta.label}
            >
              {badge === "running" && <span className="session-badge-dot" />}
              <Icon name={meta.icon} size={11} />
            </div>
          )}
        </div>

        {s.last_message && (
          <div className="session-item-subtitle" title={s.last_message}>{s.last_message}</div>
        )}

        <div className="session-item-meta">
          <span className="session-meta-chip" title="更新时间">
            <Icon name="timer" size={11} />
            {formatDate(s.updated_at)}
          </span>
          {s.message_count !== undefined && (
            <span className="session-meta-chip" title="消息数">
              <Icon name="message" size={11} />
              {s.message_count}
            </span>
          )}
        </div>

        {editingTagId === s.id && (
          <div className="tag-editor" onClick={stop}>
            <div className="tag-swatches">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  className={`tag-swatch ${draftColor === c ? "sel" : ""}`}
                  style={{ background: c }}
                  onClick={() => setDraftColor(c)}
                  aria-label={c}
                />
              ))}
            </div>
            <div className="tag-editor-row">
              <input
                className="tag-input"
                maxLength={5}
                autoFocus
                value={draftText}
                placeholder="标签名（≤5字）"
                onChange={(e) => setDraftText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTag(s.id);
                  if (e.key === "Escape") setEditingTagId(null);
                }}
              />
              <button className="tag-save" onClick={() => saveTag(s.id)} title="保存">
                <Icon name="check" size={12} />
              </button>
              <button
                className={tag ? "tag-clear" : "tag-cancel"}
                onClick={() => (tag ? clearTag(s.id) : setEditingTagId(null))}
                title={tag ? "清除标签" : "取消"}
              >
                <Icon name="close" size={12} />
              </button>
            </div>
          </div>
        )}

        {pendingId === s.id ? (
          <div className="session-delete-confirm" onClick={stop}>
            <span className="session-delete-label">删除?</span>
            <button className="session-delete-yes" onClick={() => confirmDelete(s.id)} title="确认删除">
              <Icon name="check" size={11} />
            </button>
            <button className="session-delete-no" onClick={cancelDelete} title="取消">
              <Icon name="close" size={11} />
            </button>
          </div>
        ) : (
          <button
            className="session-delete"
            onClick={(e) => { e.stopPropagation(); requestDelete(s.id); }}
            title="删除会话"
          >
            <Icon name="close" size={12} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title ui-font">Sessions</span>
        <div className="sidebar-actions">
          <div className="session-filter" ref={filterRef}>
            <button
              className={`btn-sidebar-icon ${filter !== null ? "active" : ""}`}
              onClick={() => setFilterOpen((v) => !v)}
              title="按标签筛选"
            >
              <Icon name="flag" size={13} />
              {filter !== null && <span className="session-filter-label">{filterLabel}</span>}
              <Icon name="chevronRight" size={11} className="session-filter-caret" />
            </button>
            {filterOpen && (
              <div className="session-filter-menu">
                <button
                  className={`session-filter-item ${filter === null ? "sel" : ""}`}
                  onClick={() => { setFilter(null); setFilterOpen(false); }}
                >
                  全部
                </button>
                <button
                  className={`session-filter-item ${filter === UNTAGGED ? "sel" : ""}`}
                  onClick={() => { setFilter(UNTAGGED); setFilterOpen(false); }}
                >
                  未标记
                </button>
                {tagList.length > 0 && <div className="session-filter-sep" />}
                {tagList.map((t) => (
                  <button
                    key={t.key}
                    className={`session-filter-item ${filter === t.key ? "sel" : ""}`}
                    onClick={() => { setFilter(t.key); setFilterOpen(false); }}
                  >
                    <span className="session-filter-dot" style={{ background: t.color }} />
                    {t.text}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className={`btn-sidebar-icon ${refreshing ? "spinning" : ""}`}
            onClick={handleRefresh}
            title="刷新会话列表"
          >
            <Icon name="refresh" size={14} />
          </button>
          <button className="btn-new-session" onClick={onNew} title="New Session">+</button>
        </div>
      </div>

      <div className="session-list">
        {sessions.length === 0 && (
          <div style={{ padding: "16px 12px", color: "var(--muted)", fontSize: 11 }}>
            No sessions yet.<br />Start a conversation!
          </div>
        )}

        {sessions.length > 0 && visible.length === 0 && (
          <div style={{ padding: "16px 12px", color: "var(--muted)", fontSize: 11 }}>
            没有匹配该标签的会话。
          </div>
        )}

        {groups.map((g) => (
          <div key={g.label} className="session-group">
            <div className="session-group-header">{g.label}</div>
            {g.items.map(renderItem)}
          </div>
        ))}
      </div>

      <div style={{
        padding: "8px 12px",
        borderTop: "1px solid var(--hairline)",
        fontSize: 10,
        color: "var(--muted)",
        fontFamily: "'Inter', sans-serif",
      }}>
        {sessions.length} session{sessions.length !== 1 ? "s" : ""}{" · "}~/.hermes/
      </div>
    </div>
  );
}
