import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import {
  GUIDE_BOT_APPEARANCES,
  GuideBotAvatar,
  type GuideBotAppearance,
  useGuideBotAppearance,
} from "../components/chat/GuideBot";
import { THEMES, useTheme, type Theme } from "../hooks/useTheme";

const THEME_LABELS: Record<Theme, { name: string; description: string }> = {
  claude: { name: "Claude Noir", description: "温暖纸面、柔和边界" },
  apple: { name: "Apple", description: "系统感、轻背景、蓝色强调" },
  warp: { name: "Warp", description: "暖深色、终端气质" },
};

const APPEARANCE_MOOD: Record<GuideBotAppearance, Parameters<typeof GuideBotAvatar>[0]["mood"]> = {
  classic: "blink",
  voxel: "ok",
  anime: "typing",
  cyber: "alert",
  pod: "heartbeat",
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { appearance, setAppearance } = useGuideBotAppearance();

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
              <p className="settings-section-desc">选择 Hermes Desktop 的整体视觉语言。</p>
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
    </div>
  );
}
