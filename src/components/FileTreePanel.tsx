import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

import ts from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import js from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import jsx from "react-syntax-highlighter/dist/esm/languages/prism/jsx";
import rust from "react-syntax-highlighter/dist/esm/languages/prism/rust";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml";
import toml from "react-syntax-highlighter/dist/esm/languages/prism/toml";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import css from "react-syntax-highlighter/dist/esm/languages/prism/css";

SyntaxHighlighter.registerLanguage("typescript", ts);
SyntaxHighlighter.registerLanguage("tsx", tsx);
SyntaxHighlighter.registerLanguage("javascript", js);
SyntaxHighlighter.registerLanguage("jsx", jsx);
SyntaxHighlighter.registerLanguage("rust", rust);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("yaml", yaml);
SyntaxHighlighter.registerLanguage("toml", toml);
SyntaxHighlighter.registerLanguage("markdown", markdown);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("css", css);

// ── Types ─────────────────────────────────────────────────────────────────────

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
}

interface TreeNode extends FileEntry {
  children?: TreeNode[];
  expanded?: boolean;
}

interface Props {
  initialPath: string;
  onClose: () => void;
}

// ── Language / text detection ─────────────────────────────────────────────────

const EXT_LANG: Record<string, string> = {
  ts: "typescript", tsx: "tsx",
  js: "javascript", jsx: "jsx",
  rs: "rust",
  py: "python",
  json: "json",
  yaml: "yaml", yml: "yaml",
  toml: "toml",
  md: "markdown", mdx: "markdown",
  sh: "bash", zsh: "bash", bash: "bash",
  css: "css", scss: "css",
};

const TEXT_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "rs", "py", "json", "yaml", "yml",
  "toml", "md", "mdx", "sh", "zsh", "bash", "css", "scss",
  "html", "htm", "xml", "txt", "env", "lock", "sql", "graphql", "gql",
  "gitignore", "gitattributes", "editorconfig", "prettierrc", "eslintrc",
]);

function getExt(name: string): string {
  // handle dotfiles like .gitignore
  if (name.startsWith(".") && !name.slice(1).includes(".")) return name.slice(1);
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function isTextFile(name: string): boolean {
  return TEXT_EXTENSIONS.has(getExt(name));
}

function getLang(name: string): string {
  return EXT_LANG[getExt(name)] ?? "text";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDisplayPath(absPath: string): string {
  const parts = absPath.split("/");
  if (parts.length >= 3 && parts[1] === "Users") {
    return "~/" + parts.slice(3).join("/");
  }
  return absPath;
}

function parentPath(p: string): string {
  const parts = p.split("/").filter(Boolean);
  if (parts.length === 0) return "/";
  return "/" + parts.slice(0, -1).join("/");
}

function lastName(p: string): string {
  const parts = p.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? p;
}

async function openWithSystem(path: string) {
  try {
    await invoke("open_path", { path });
  } catch (e) {
    console.error("open_path failed:", e);
  }
}

// ── Tree state helpers ────────────────────────────────────────────────────────

function expandNode(nodes: TreeNode[], targetPath: string, children: TreeNode[]): TreeNode[] {
  return nodes.map((n) => {
    if (n.path === targetPath) return { ...n, expanded: true, children };
    if (n.children) return { ...n, children: expandNode(n.children, targetPath, children) };
    return n;
  });
}

function collapseNode(nodes: TreeNode[], targetPath: string): TreeNode[] {
  return nodes.map((n) => {
    if (n.path === targetPath) return { ...n, expanded: false, children: undefined };
    if (n.children) return { ...n, children: collapseNode(n.children, targetPath) };
    return n;
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FileTreePanel({ initialPath, onClose }: Props) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingDir, setLoadingDir] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);

  const loadDir = useCallback(async (path: string) => {
    setLoadingDir(path);
    try {
      const entries = await invoke<FileEntry[]>("list_dir", { path });
      setNodes(entries.map((e) => ({ ...e })));
      setCurrentPath(path);
      setSelectedFile(null);
      setFileContent(null);
      setPreviewError(null);
    } catch (e) {
      setPreviewError(String(e));
    } finally {
      setLoadingDir(null);
    }
  }, []);

  useEffect(() => {
    if (initialPath) {
      loadDir(initialPath);
    } else {
      invoke<string>("get_home_dir").then((home) => loadDir(home));
    }
  }, [initialPath]);

  // Toggle expand/collapse in-tree (triangle click)
  async function handleToggle(node: TreeNode) {
    if (node.expanded) {
      setNodes((prev) => collapseNode(prev, node.path));
      return;
    }
    setLoadingDir(node.path);
    try {
      const children = await invoke<FileEntry[]>("list_dir", { path: node.path });
      setNodes((prev) => expandNode(prev, node.path, children.map((e) => ({ ...e }))));
    } catch {
      // ignore
    } finally {
      setLoadingDir(null);
    }
  }

  // Navigate into directory (name click)
  function handleNavigate(node: TreeNode) {
    loadDir(node.path);
  }

  // Select file for preview (name click)
  async function handleSelectFile(node: TreeNode) {
    setSelectedFile(node.path);
    setFileContent(null);
    setPreviewError(null);

    if (!isTextFile(node.name)) {
      setPreviewError("binary");
      return;
    }
    setLoadingFile(true);
    try {
      const content = await invoke<string>("read_text_file", { path: node.path });
      setFileContent(content);
    } catch (e) {
      setPreviewError(String(e));
    } finally {
      setLoadingFile(false);
    }
  }

  const canGoUp = currentPath !== "/" && currentPath.split("/").filter(Boolean).length > 0;

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <button
          onClick={() => canGoUp && loadDir(parentPath(currentPath))}
          disabled={!canGoUp}
          title="上级目录"
          style={{ ...iconBtn, opacity: canGoUp ? 0.75 : 0.25 }}
        >
          ←
        </button>
        <span
          title={currentPath}
          style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "12px", opacity: 0.65 }}
        >
          {toDisplayPath(currentPath)}
        </span>
        <button onClick={onClose} title="关闭" style={{ ...iconBtn, opacity: 0.5 }}>✕</button>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Tree column */}
        <div style={treeColStyle}>
          {loadingDir === currentPath && nodes.length === 0 && (
            <div style={emptyHint}>加载中…</div>
          )}
          {loadingDir !== currentPath && nodes.length === 0 && (
            <div style={emptyHint}>空目录</div>
          )}
          {nodes.map((node) => (
            <TreeRow
              key={node.path}
              node={node}
              selected={selectedFile === node.path}
              loading={loadingDir === node.path}
              depth={0}
              onToggle={handleToggle}
              onNavigate={handleNavigate}
              onSelectFile={handleSelectFile}
              selectedFile={selectedFile}
              loadingDir={loadingDir}
            />
          ))}
        </div>

        <div style={{ width: "1px", background: "var(--border)", flexShrink: 0 }} />

        {/* Preview column */}
        <div style={previewColStyle}>
          {!selectedFile && <div style={emptyHint}>点击文件预览内容</div>}
          {selectedFile && loadingFile && <div style={emptyHint}>读取中…</div>}
          {selectedFile && previewError === "binary" && (
            <BinaryPrompt path={selectedFile} onOpen={openWithSystem} />
          )}
          {selectedFile && previewError && previewError !== "binary" && (
            <div style={{ ...emptyHint, flexDirection: "column", gap: "10px" }}>
              <span style={{ color: "var(--error, #e06c6c)", fontSize: "12px" }}>{previewError}</span>
              <button onClick={() => openWithSystem(selectedFile)} style={actionBtn}>
                用系统应用打开
              </button>
            </div>
          )}
          {fileContent !== null && !previewError && (
            <FilePreview
              path={selectedFile!}
              content={fileContent}
              onOpenSystem={() => openWithSystem(selectedFile!)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── TreeRow ───────────────────────────────────────────────────────────────────

function TreeRow({
  node, selected, loading, depth,
  onToggle, onNavigate, onSelectFile,
  selectedFile, loadingDir,
}: {
  node: TreeNode;
  selected: boolean;
  loading: boolean;
  depth: number;
  onToggle: (n: TreeNode) => void;
  onNavigate: (n: TreeNode) => void;
  onSelectFile: (n: TreeNode) => void;
  selectedFile: string | null;
  loadingDir: string | null;
}) {
  const isExpanded = !!node.expanded;

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          paddingLeft: `${8 + depth * 14}px`,
          paddingRight: "6px",
          borderRadius: "4px",
          background: node.is_dir && isExpanded
            ? "var(--bg-expanded, rgba(255,255,255,0.06))"
            : selected
            ? "var(--accent-bg, rgba(192,122,90,0.15))"
            : "transparent",
          marginBottom: "1px",
        }}
      >
        {/* Triangle / expand toggle (dirs only) */}
        {node.is_dir ? (
          <button
            onClick={() => onToggle(node)}
            title={isExpanded ? "折叠" : "展开"}
            style={{
              ...iconBtn,
              fontSize: "11px",
              width: "16px",
              flexShrink: 0,
              opacity: 1,
              color: isExpanded ? "var(--accent, #c07a5a)" : "var(--text-primary, #ccc)",
            }}
          >
            {loading ? "⟳" : isExpanded ? "▾" : "▸"}
          </button>
        ) : (
          <span style={{ width: "16px", flexShrink: 0 }} />
        )}

        {/* Folder / file icon */}
        <span style={{ marginRight: "5px", fontSize: "13px", flexShrink: 0, lineHeight: 1 }}>
          {node.is_dir
            ? (isExpanded ? "📂" : "📁")
            : fileIcon(node.name)}
        </span>

        {/* Name — click to navigate (dir) or select (file) */}
        <button
          onClick={() => node.is_dir ? onNavigate(node) : onSelectFile(node)}
          title={node.path}
          style={{
            flex: 1,
            background: "none",
            border: "none",
            padding: "4px 0",
            cursor: "pointer",
            color: selected
              ? "var(--text-primary, #eee)"
              : node.is_dir && isExpanded
              ? "var(--text-primary, #ddd)"
              : "var(--text-secondary, #aaa)",
            fontWeight: node.is_dir && isExpanded ? 600 : 400,
            fontSize: "12px",
            textAlign: "left",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {node.name}
        </button>
      </div>

      {/* Children (expanded) */}
      {isExpanded && node.children?.map((child) => (
        <TreeRow
          key={child.path}
          node={child}
          selected={selectedFile === child.path}
          loading={loadingDir === child.path}
          depth={depth + 1}
          onToggle={onToggle}
          onNavigate={onNavigate}
          onSelectFile={onSelectFile}
          selectedFile={selectedFile}
          loadingDir={loadingDir}
        />
      ))}
    </>
  );
}

// ── FilePreview ───────────────────────────────────────────────────────────────

function FilePreview({ path, content, onOpenSystem }: {
  path: string;
  content: string;
  onOpenSystem: () => void;
}) {
  const name = lastName(path);
  const lang = getLang(name);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "6px 10px",
        borderBottom: "1px solid var(--border)",
        fontSize: "11px",
        flexShrink: 0,
        color: "var(--text-secondary, #aaa)",
      }}>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </span>
        <span style={{
          background: "var(--bg-secondary, rgba(255,255,255,0.06))",
          borderRadius: "3px",
          padding: "1px 5px",
          opacity: 0.6,
          flexShrink: 0,
          fontFamily: "monospace",
        }}>
          {lang}
        </span>
        <button onClick={onOpenSystem} title="用系统应用打开" style={{ ...iconBtn, opacity: 0.6 }}>↗</button>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        <SyntaxHighlighter
          language={lang === "text" ? "bash" : lang}
          style={vscDarkPlus}
          showLineNumbers
          customStyle={{
            margin: 0,
            padding: "12px 8px",
            background: "transparent",
            fontSize: "11.5px",
            lineHeight: "1.6",
          }}
          lineNumberStyle={{ opacity: 0.3, userSelect: "none", minWidth: "2.5em" }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

// ── BinaryPrompt ──────────────────────────────────────────────────────────────

function BinaryPrompt({ path, onOpen }: { path: string; onOpen: (p: string) => void }) {
  const name = lastName(path);
  return (
    <div style={{ ...emptyHint, flexDirection: "column", gap: "10px" }}>
      <span style={{ fontSize: "28px", opacity: 0.4 }}>📄</span>
      <span style={{ fontSize: "12px", opacity: 0.6 }}>{name}</span>
      <span style={{ fontSize: "11px", opacity: 0.4 }}>无法预览此文件类型</span>
      <button onClick={() => onOpen(path)} style={actionBtn}>用系统应用打开</button>
    </div>
  );
}

// ── Icon helpers ──────────────────────────────────────────────────────────────

function fileIcon(name: string): string {
  const ext = getExt(name);
  const icons: Record<string, string> = {
    ts: "🔷", tsx: "🔷", js: "🟡", jsx: "🟡",
    rs: "🦀", py: "🐍",
    json: "📋", yaml: "📋", yml: "📋", toml: "📋",
    md: "📝", mdx: "📝",
    sh: "💲", zsh: "💲", bash: "💲",
    css: "🎨", scss: "🎨",
    png: "🖼", jpg: "🖼", jpeg: "🖼", gif: "🖼", svg: "🖼", webp: "🖼",
    pdf: "📕",
  };
  return icons[ext] ?? "📄";
}

// ── Styles ────────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  position: "fixed",
  top: 0, right: 0, bottom: 0,
  width: "640px",
  display: "flex",
  flexDirection: "column",
  background: "var(--bg-primary, #1e1e1e)",
  borderLeft: "1px solid var(--border)",
  zIndex: 100,
  boxShadow: "-4px 0 24px rgba(0,0,0,0.3)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 12px",
  borderBottom: "1px solid var(--border)",
  flexShrink: 0,
  color: "var(--text-secondary, #aaa)",
};

const treeColStyle: React.CSSProperties = {
  width: "220px",
  flexShrink: 0,
  overflowY: "auto",
  padding: "6px 4px",
};

const previewColStyle: React.CSSProperties = {
  flex: 1,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const emptyHint: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  color: "var(--text-secondary, #666)",
  fontSize: "12px",
};

const iconBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "inherit",
  fontSize: "14px",
  padding: "2px 4px",
  flexShrink: 0,
};

const actionBtn: React.CSSProperties = {
  background: "var(--accent, #c07a5a)",
  border: "none",
  borderRadius: "6px",
  color: "#fff",
  fontSize: "12px",
  padding: "6px 14px",
  cursor: "pointer",
};
