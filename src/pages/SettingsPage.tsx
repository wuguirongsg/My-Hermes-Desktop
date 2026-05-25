import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import Icon from "../components/Icon";
import {
  GUIDE_BOT_APPEARANCES,
  GuideBotAvatar,
  type GuideBotAppearance,
  useGuideBotAppearance,
} from "../components/chat/GuideBot";
import { THEMES, useTheme, type Theme } from "../hooks/useTheme";
import { TERMINAL_BGS, useTerminalBg, type TerminalBg } from "../hooks/useTerminalBg";
import { FONT_SIZES, FONT_SIZE_LABELS, useFontSize, type FontSize } from "../hooks/useFontSize";

const THEME_LABELS: Record<Theme, { name: string; description: string }> = {
  claude: { name: "Claude Noir", description: "温暖纸面、柔和边界" },
  apple: { name: "Apple", description: "系统感、轻背景、蓝色强调" },
  warp: { name: "Warp", description: "暖深色、终端气质" },
};

const TERMINAL_BG_LABELS: Record<TerminalBg, { name: string; description: string }> = {
  dark:    { name: "暗夜",   description: "经典深色，对比度最佳" },
  glass:   { name: "毛玻璃", description: "半透明霜化效果" },
  ocean:   { name: "深海",   description: "蓝紫渐变星云感" },
  sunset:  { name: "暮色",   description: "深红紫幽暗渐变" },
  forest:  { name: "暗林",   description: "深邃祖母绿渐变" },
};

const FONT_SIZE_ROW_LABELS: Record<string, string> = {
  ui: "界面",
  terminal: "终端",
  fileTree: "文件管理器",
};

const APPEARANCE_MOOD: Record<GuideBotAppearance, Parameters<typeof GuideBotAvatar>[0]["mood"]> = {
  classic: "blink",
  voxel: "ok",
  anime: "typing",
  cyber: "alert",
  pod: "heartbeat",
};

// ─── Dashboard Theme Installer sub-component ─────────────────────────────────

interface InstallResult {
  themes_installed: string[];
  plugin_files_installed: string[];
  themes_dir: string;
  plugin_dir: string;
  skipped: string[];
}

interface InstallStatus {
  themes: string[];
  plugin_files: string[];
  themes_dir: string;
  plugin_dir: string;
  installed: boolean;
}

function DashboardThemeInstaller() {
  const [isInstalling, setIsInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<InstallResult | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);
  const [status, setStatus] = useState<InstallStatus | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<InstallStatus>("get_dashboard_theme_install_status");
      setStatus(result);
    } catch {
      // silently ignore — the user can still install
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleInstall = async () => {
    setIsInstalling(true);
    setInstallResult(null);
    setInstallError(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<InstallResult>("install_dashboard_themes");
      setInstallResult(result);
      await loadStatus();
    } catch (e) {
      setInstallError(String(e));
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="dashboard-theme-installer">
      <div className="settings-row">
        <div className="settings-row-label">
          <span className="ui-font">安装 Dashboard 主题包</span>
          <span className="settings-row-desc">
            一键安装 Claude / Apple / Warp 三套主题及同步插件到 ~/.hermes/
          </span>
        </div>
        <button
          type="button"
          className="settings-primary-btn ui-font"
          disabled={isInstalling}
          onClick={handleInstall}
        >
          {isInstalling ? (
            <>
              <span className="btn-spinner" />
              安装中…
            </>
          ) : status?.installed ? (
            <>
              重新安装
              <Icon name="refresh" size={15} />
            </>
          ) : (
            <>
              安装
              <Icon name="package" size={15} />
            </>
          )}
        </button>
      </div>

      {/* Install result banner */}
      {installError && (
        <div className="install-result-card install-error">
          <Icon name="alert" size={16} />
          <span>安装失败：{installError}</span>
        </div>
      )}
      {installResult && (
        <div className="install-result-card install-success">
          <div className="install-result-header">
            <Icon name="check" size={16} />
            <span>安装成功</span>
          </div>
          <div className="install-result-body">
            {installResult.themes_installed.length > 0 && (
              <div className="install-result-group">
                <span className="install-result-label">主题文件</span>
                <ul className="install-result-list">
                  {installResult.themes_installed.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <span className="install-result-path">{installResult.themes_dir}</span>
              </div>
            )}
            {installResult.plugin_files_installed.length > 0 && (
              <div className="install-result-group">
                <span className="install-result-label">插件文件</span>
                <ul className="install-result-list">
                  {installResult.plugin_files_installed.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <span className="install-result-path">{installResult.plugin_dir}</span>
              </div>
            )}
            {installResult.skipped.length > 0 && (
              <div className="install-result-group">
                <span className="install-result-label">跳过（源文件缺失）</span>
                <ul className="install-result-list">
                  {installResult.skipped.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Current installed status */}
      {status && (
        <div className="install-status-block">
          <div className="install-status-header">
            <Icon name="package" size={14} />
            <span className="ui-font">
              {status.installed ? "已安装内容" : "尚未安装"}
            </span>
          </div>
          {status.installed && (
            <div className="install-status-body">
              {status.themes.length > 0 && (
                <div className="install-status-group">
                  <span className="install-status-label">主题</span>
                  <div className="install-status-tags">
                    {status.themes.map((t) => (
                      <span key={t} className="install-status-tag">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {status.plugin_files.length > 0 && (
                <div className="install-status-group">
                  <span className="install-status-label">插件</span>
                  <div className="install-status-tags">
                    {status.plugin_files.map((f) => (
                      <span key={f} className="install-status-tag">{f}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { appearance, setAppearance } = useGuideBotAppearance();
  const { terminalBg, setTerminalBg } = useTerminalBg();
  const {
    uiFontSize, setUiFontSize,
    terminalFontSize, setTerminalFontSize,
    fileTreeFontSize, setFileTreeFontSize,
  } = useFontSize();

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <span className="settings-page-icon">
          <Icon name="settings" size={21} />
        </span>
        <div>
          <div className="settings-page-title ui-font">Settings</div>
          <div className="settings-page-subtitle">界面外观、引导和 Composer Guide</div>
        </div>
      </div>

      <div className="settings-content">
        <section className="settings-section">
          <div className="settings-section-header">
            <div>
              <h2 className="settings-section-title ui-font">外观风格</h2>
              <p className="settings-section-desc">选择 My Hermes Desktop 的整体视觉语言。</p>
            </div>
          </div>

          <div className="theme-card-grid">
            {THEMES.map((item) => (
              <button
                key={item}
                type="button"
                className={`theme-card theme-card-${item}${theme === item ? " selected" : ""}`}
                onClick={() => setTheme(item)}
              >
                <span className="theme-card-preview">
                  <span />
                  <span />
                  <span />
                </span>
                <span className="theme-card-body">
                  <span className="theme-card-name ui-font">{THEME_LABELS[item].name}</span>
                  <span className="theme-card-desc">{THEME_LABELS[item].description}</span>
                </span>
                {theme === item && <Icon name="check" size={15} />}
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-header">
            <div>
              <h2 className="settings-section-title ui-font">Dashboard 主题</h2>
              <p className="settings-section-desc">将 Dashboard 管理界面的主题与 Desktop 保持同步。</p>
            </div>
          </div>

          <DashboardThemeInstaller />
        </section>

        <section className="settings-section">
          <div className="settings-section-header">
            <div>
              <h2 className="settings-section-title ui-font">机器人形象</h2>
              <p className="settings-section-desc">选择输入区引导机器人的外观。</p>
            </div>
          </div>

          <div className="bot-appearance-grid">
            {GUIDE_BOT_APPEARANCES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`bot-appearance-card${appearance === item.id ? " selected" : ""}`}
                onClick={() => setAppearance(item.id)}
              >
                <span className="bot-appearance-preview">
                  <GuideBotAvatar mood={APPEARANCE_MOOD[item.id]} appearance={item.id} />
                </span>
                <span className="bot-appearance-copy">
                  <span className="bot-appearance-name ui-font">{item.name}</span>
                  <span className="bot-appearance-desc">{item.description}</span>
                </span>
                {appearance === item.id && <Icon name="check" size={15} />}
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-header">
            <div>
              <h2 className="settings-section-title ui-font">终端背景</h2>
              <p className="settings-section-desc">自定义 TUI 终端面板的背景风格。</p>
            </div>
          </div>

          <div className="terminal-bg-grid">
            {TERMINAL_BGS.map((bg) => (
              <button
                key={bg}
                type="button"
                className={`terminal-bg-card terminal-bg-card-${bg}${terminalBg === bg ? " selected" : ""}`}
                onClick={() => setTerminalBg(bg)}
              >
                <span className="terminal-bg-swatch" />
                <span className="terminal-bg-body">
                  <span className="terminal-bg-name ui-font">{TERMINAL_BG_LABELS[bg].name}</span>
                  <span className="terminal-bg-desc">{TERMINAL_BG_LABELS[bg].description}</span>
                </span>
                {terminalBg === bg && <Icon name="check" size={15} />}
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-header">
            <div>
              <h2 className="settings-section-title ui-font">字体大小</h2>
              <p className="settings-section-desc">调整界面、终端和文件管理器的文字大小。</p>
            </div>
          </div>

          <div className="font-size-rows">
            {(
              [
                { key: "ui",       label: FONT_SIZE_ROW_LABELS.ui,       value: uiFontSize,       set: setUiFontSize },
                { key: "terminal", label: FONT_SIZE_ROW_LABELS.terminal, value: terminalFontSize, set: setTerminalFontSize },
                { key: "fileTree", label: FONT_SIZE_ROW_LABELS.fileTree, value: fileTreeFontSize, set: setFileTreeFontSize },
              ] as { key: string; label: string; value: FontSize; set: (v: FontSize) => void }[]
            ).map(({ key, label, value, set }) => (
              <div key={key} className="font-size-row">
                <span className="font-size-row-label ui-font">{label}</span>
                <div className="font-size-chips">
                  {FONT_SIZES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`font-size-chip ui-font${value === s ? " selected" : ""}`}
                      onClick={() => set(s)}
                    >
                      {FONT_SIZE_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="settings-section settings-guide-section">
          <div>
            <h2 className="settings-section-title ui-font">使用引导</h2>
            <p className="settings-section-desc">重新查看安装、配置和进入对话流程。</p>
          </div>
          <button
            type="button"
            className="settings-primary-btn ui-font"
            onClick={() => navigate("/onboarding")}
          >
            查看引导页
            <Icon name="chevronRight" size={15} />
          </button>
        </section>
      </div>

      <footer className="settings-copyright ui-font">
        © {new Date().getFullYear()} 深圳市玄熵智能科技有限责任公司
      </footer>
    </div>
  );
}
