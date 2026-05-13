import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

const ALL_MODEL_GROUPS = [
  {
    provider: "opencode-go",
    models: ["deepseek-v4-flash", "deepseek-v4", "deepseek-r1", "qwen3-235b", "qwen3-30b"],
  },
  {
    provider: "anthropic",
    models: ["claude-opus-4", "claude-sonnet-4", "claude-haiku-4-5"],
  },
  {
    provider: "openai",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o3", "o4-mini"],
  },
  {
    provider: "openrouter",
    models: [
      "google/gemini-2.5-pro",
      "deepseek/deepseek-r1",
      "meta-llama/llama-3.3-70b-instruct",
    ],
  },
  {
    provider: "gemini",
    models: ["gemini-2.5-pro", "gemini-2.0-flash", "gemini-1.5-pro"],
  },
  {
    provider: "nous",
    models: ["hermes-3-llama-3.1-70b", "hermes-3-llama-3.1-405b"],
  },
];

interface ModelConfig {
  current_provider: string;
  current_model: string;
  configured_providers: string[];
}

interface Props {
  currentModel: string | undefined;
  onSendMessage: (text: string) => void;
}

export default function ModelPicker({ currentModel, onSendMessage }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [custom, setCustom] = useState("");
  const [config, setConfig] = useState<ModelConfig | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    invoke<ModelConfig>("get_hermes_model_config")
      .then(setConfig)
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (provider: string, model: string) => {
    onSendMessage(`/model ${provider}:${model}`);
    setOpen(false);
    setSearch("");
  };

  const handleCustom = () => {
    const val = custom.trim();
    if (!val) return;
    onSendMessage(`/model ${val}`);
    setOpen(false);
    setCustom("");
  };

  // Only show groups for configured providers; fall back to all if config not loaded yet
  const visibleGroups =
    config && config.configured_providers.length > 0
      ? ALL_MODEL_GROUPS.filter((g) =>
          config.configured_providers.includes(g.provider)
        )
      : ALL_MODEL_GROUPS;

  // If current model's provider isn't represented, add it as a fallback group
  const extraGroup: { provider: string; models: string[] } | null = (() => {
    if (!config?.current_provider || !config?.current_model) return null;
    const inVisible = visibleGroups.some((g) => g.provider === config.current_provider);
    if (inVisible) return null;
    return { provider: config.current_provider, models: [config.current_model] };
  })();

  const allGroups = extraGroup ? [extraGroup, ...visibleGroups] : visibleGroups;

  const q = search.toLowerCase();
  const filtered = allGroups
    .map((g) => ({
      ...g,
      models: g.models.filter(
        (m) => !q || m.toLowerCase().includes(q) || g.provider.toLowerCase().includes(q)
      ),
    }))
    .filter((g) => g.models.length > 0);

  return (
    <div className="model-picker" ref={ref}>
      <button
        className="model-picker-btn"
        onClick={() => setOpen((o) => !o)}
        title="切换模型"
      >
        <span className="model-picker-label">{currentModel || config?.current_model || "—"}</span>
        <svg
          className="model-picker-chevron"
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
        >
          <path
            d="M2 3.5L5 6.5L8 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="model-picker-dropdown">
          <input
            className="model-picker-search"
            placeholder="搜索模型..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            autoFocus
          />

          <div className="model-picker-list">
            {filtered.length === 0 && (
              <div className="model-picker-empty">无匹配结果</div>
            )}
            {filtered.map((group) => (
              <div key={group.provider} className="model-picker-group">
                <div className="model-picker-group-label">{group.provider}</div>
                {group.models.map((model) => {
                  const isCurrent =
                    currentModel === `${group.provider}:${model}` ||
                    currentModel?.endsWith(model) ||
                    config?.current_model === model;
                  return (
                    <button
                      key={model}
                      className={`model-picker-item${isCurrent ? " active" : ""}`}
                      onClick={() => handleSelect(group.provider, model)}
                    >
                      <span className="model-picker-check">{isCurrent ? "●" : ""}</span>
                      {model}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="model-picker-custom">
            <input
              className="model-picker-search"
              placeholder="自定义: provider:model"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCustom();
                if (e.key === "Escape") setOpen(false);
              }}
            />
            <button
              className="btn-confirm ui-font"
              onClick={handleCustom}
              disabled={!custom.trim()}
              style={{ height: 28, padding: "0 12px", fontSize: 12 }}
            >
              切换
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
