import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import Icon from "../Icon";
import { RefItem } from "./AtMentionMenu";

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
}

interface SkillInfo {
  name: string;
  category: string;
  description: string;
}

interface Props {
  workingDir: string | null;
  onSelect: (item: RefItem) => void;
  onClose: () => void;
}

export default function RefPickerPanel({ workingDir, onSelect, onClose }: Props) {
  const [tab, setTab] = useState<"file" | "skill">("file");
  const [search, setSearch] = useState("");
  const [currentPath, setCurrentPath] = useState(workingDir ?? "");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [skillsLoaded, setSkillsLoaded] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-focus search on mount
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Load files when currentPath changes
  useEffect(() => {
    if (!currentPath) return;
    invoke<FileEntry[]>("list_dir", { path: currentPath })
      .then(setFiles)
      .catch(() => setFiles([]));
  }, [currentPath]);

  // Lazy-load skills when skill tab is first opened
  useEffect(() => {
    if (tab === "skill" && !skillsLoaded) {
      invoke<SkillInfo[]>("list_skills")
        .then((list) => {
          setSkills(list);
          setSkillsLoaded(true);
        })
        .catch(() => setSkillsLoaded(true));
    }
  }, [tab, skillsLoaded]);

  // Reset focus index on search/tab/path change
  useEffect(() => {
    setFocusedIndex(0);
  }, [search, tab, currentPath, categoryFilter]);

  const q = search.toLowerCase();

  // ─── File items ───────────────────────────────────────────────────────────────
  const filteredFiles = files.filter(
    (f) => !q || f.name.toLowerCase().includes(q)
  );
  const dirs = filteredFiles.filter((f) => f.is_dir);
  const fileItems = filteredFiles.filter((f) => !f.is_dir);

  // ─── Skill items ──────────────────────────────────────────────────────────────
  const categories = Array.from(new Set(skills.map((s) => s.category).filter(Boolean))).sort();
  const filteredSkills = skills.filter(
    (s) =>
      (!categoryFilter || s.category === categoryFilter) &&
      (!q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.category.toLowerCase().includes(q))
  );

  // ─── Navigation ──────────────────────────────────────────────────────────────
  const parentPath = (() => {
    if (!currentPath) return null;
    const idx = currentPath.replace(/\/$/, "").lastIndexOf("/");
    return idx > 0 ? currentPath.slice(0, idx) : null;
  })();

  const handleFileClick = async (entry: FileEntry) => {
    if (entry.is_dir) {
      setCurrentPath(entry.path);
      setSearch("");
    } else {
      try {
        const content = await invoke<string>("read_text_file", { path: entry.path });
        onSelect({ type: "file", name: entry.name, path: entry.path, content });
      } catch {
        onSelect({ type: "file", name: entry.name, path: entry.path, content: "(无法读取)" });
      }
    }
  };

  const handleDirSelect = async (entry: FileEntry) => {
    try {
      const children = await invoke<FileEntry[]>("list_dir", { path: entry.path });
      const lines = [`目录: ${entry.path}`, "文件列表："];
      for (const c of children) {
        lines.push(`  ${c.is_dir ? "📁 " + c.name + "/" : "📄 " + c.name}`);
      }
      onSelect({ type: "file", name: entry.name + "/", path: entry.path, content: lines.join("\n") });
    } catch {
      onSelect({ type: "file", name: entry.name + "/", path: entry.path, content: `目录: ${entry.path}` });
    }
  };

  const handleSkillClick = (skill: SkillInfo) => {
    onSelect({ type: "skill", name: skill.name, category: skill.category });
  };

  // ─── Keyboard navigation ─────────────────────────────────────────────────────
  const allFileSelectables = [...dirs, ...fileItems];
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (tab === "file") {
      const items = allFileSelectables;
      const hasParent = !!parentPath;
      const total = (hasParent ? 1 : 0) + items.length;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, total - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        let adj = focusedIndex;
        if (hasParent) {
          if (adj === 0) { setCurrentPath(parentPath!); setSearch(""); return; }
          adj -= 1;
        }
        const entry = items[adj];
        if (entry) handleFileClick(entry);
      }
    } else {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, filteredSkills.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const skill = filteredSkills[focusedIndex];
        if (skill) handleSkillClick(skill);
      }
    }
  };

  // Scroll focused item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${focusedIndex}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [focusedIndex]);

  const pathSegments = currentPath.replace(/\/$/, "").split("/").filter(Boolean);

  return (
    <div className="ref-picker-panel">
      {/* Tabs */}
      <div className="ref-picker-tabs">
        <button
          className={`ref-picker-tab${tab === "file" ? " active" : ""}`}
          onClick={() => setTab("file")}
          type="button"
        >
          文件
        </button>
        <button
          className={`ref-picker-tab${tab === "skill" ? " active" : ""}`}
          onClick={() => setTab("skill")}
          type="button"
        >
          技能
        </button>
        <div className="ref-picker-search-wrap">
          <Icon name="search" size={12} className="ref-picker-search-icon" />
          <input
            ref={searchRef}
            className="ref-picker-search"
            placeholder={tab === "file" ? "搜索文件..." : "搜索技能..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <button className="ref-picker-close" onClick={onClose} type="button">
          <Icon name="close" size={12} />
        </button>
      </div>

      {/* File Tab */}
      {tab === "file" && (
        <>
          {/* Breadcrumb */}
          <div className="ref-picker-breadcrumb ui-font">
            {pathSegments.map((seg, i) => {
              const segPath = "/" + pathSegments.slice(0, i + 1).join("/");
              return (
                <span key={segPath}>
                  {i > 0 && <span className="ref-picker-sep">/</span>}
                  <button
                    className="ref-picker-crumb"
                    onClick={() => { setCurrentPath(segPath); setSearch(""); }}
                    type="button"
                  >
                    {seg}
                  </button>
                </span>
              );
            })}
          </div>

          {/* File list */}
          <div className="ref-picker-list" ref={listRef}>
            {parentPath && (
              <button
                className={`ref-picker-row ref-picker-dir${focusedIndex === 0 ? " focused" : ""}`}
                data-idx={0}
                onClick={() => { setCurrentPath(parentPath); setSearch(""); }}
                type="button"
              >
                <span className="ref-picker-row-icon">←</span>
                <span className="ref-picker-row-name">..</span>
              </button>
            )}
            {dirs.map((d, i) => {
              const idx = (parentPath ? 1 : 0) + i;
              return (
                <div
                  key={d.path}
                  className={`ref-picker-row ref-picker-dir${focusedIndex === idx ? " focused" : ""}`}
                  data-idx={idx}
                >
                  <button
                    className="ref-picker-dir-nav"
                    onClick={() => { setCurrentPath(d.path); setSearch(""); }}
                    type="button"
                    title="进入目录"
                  >
                    <span className="ref-picker-row-icon">📁</span>
                    <span className="ref-picker-row-name">{d.name}</span>
                    <span className="ref-picker-row-arrow">›</span>
                  </button>
                  <button
                    className="ref-picker-dir-ref"
                    onClick={() => handleDirSelect(d)}
                    type="button"
                    title="引用此目录"
                  >
                    引用
                  </button>
                </div>
              );
            })}
            {fileItems.map((f, i) => {
              const idx = (parentPath ? 1 : 0) + dirs.length + i;
              return (
                <button
                  key={f.path}
                  className={`ref-picker-row ref-picker-file${focusedIndex === idx ? " focused" : ""}`}
                  data-idx={idx}
                  onClick={() => handleFileClick(f)}
                  type="button"
                >
                  <span className="ref-picker-row-icon">📄</span>
                  <span className="ref-picker-row-name">{f.name}</span>
                  <span className="ref-picker-row-size">{formatSize(f.size)}</span>
                </button>
              );
            })}
            {filteredFiles.length === 0 && (
              <div className="ref-picker-empty ui-font">无匹配文件</div>
            )}
          </div>
        </>
      )}

      {/* Skill Tab */}
      {tab === "skill" && (
        <>
          {/* Category filter chips */}
          <div className="ref-picker-cats">
            <button
              className={`ref-picker-cat${!categoryFilter ? " active" : ""}`}
              onClick={() => setCategoryFilter(null)}
              type="button"
            >
              全部 ({skills.length})
            </button>
            {categories.map((cat) => {
              const count = skills.filter((s) => s.category === cat).length;
              return (
                <button
                  key={cat}
                  className={`ref-picker-cat${categoryFilter === cat ? " active" : ""}`}
                  onClick={() => setCategoryFilter(cat === categoryFilter ? null : cat)}
                  type="button"
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>

          {/* Skill list */}
          <div className="ref-picker-list" ref={listRef}>
            {!skillsLoaded && (
              <div className="ref-picker-empty ui-font">加载技能列表...</div>
            )}
            {skillsLoaded && filteredSkills.map((skill, i) => (
              <button
                key={skill.name}
                className={`ref-picker-skill-row${focusedIndex === i ? " focused" : ""}`}
                data-idx={i}
                onClick={() => handleSkillClick(skill)}
                type="button"
              >
                <div className="ref-picker-skill-top">
                  <span className="ref-picker-skill-name">{skill.name}</span>
                  {skill.category && (
                    <span className="ref-picker-skill-cat">{skill.category}</span>
                  )}
                </div>
                {skill.description && (
                  <div className="ref-picker-skill-desc">{skill.description}</div>
                )}
              </button>
            ))}
            {skillsLoaded && filteredSkills.length === 0 && (
              <div className="ref-picker-empty ui-font">无匹配技能</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / 1024 / 1024).toFixed(1)}M`;
}
