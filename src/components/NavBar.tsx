import { useNavigate, useLocation } from "react-router-dom";
import { useTheme, type Theme } from "../hooks/useTheme";

const NAV_ITEMS = [
  { path: "/", icon: "💬", label: "对话" },
  { path: "/memory", icon: "🧠", label: "记忆" },
  { path: "/dashboard", icon: "⚙", label: "管理" },
];

const THEME_META: Record<Theme, { icon: string; title: string }> = {
  claude: { icon: "◎", title: "切换到 Apple 风格" },
  apple:  { icon: "⌘", title: "切换到 Claude 风格" },
};

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggle } = useTheme();

  return (
    <nav className="navbar">
      {NAV_ITEMS.map(({ path, icon, label }) => (
        <button
          key={path}
          className={`navbar-item${location.pathname === path ? " active" : ""}`}
          onClick={() => navigate(path)}
          title={label}
        >
          <span className="navbar-icon">{icon}</span>
          <span className="navbar-label ui-font">{label}</span>
        </button>
      ))}

      <div className="navbar-spacer" />

      <button
        className="navbar-theme-btn"
        onClick={toggle}
        title={THEME_META[theme].title}
      >
        {THEME_META[theme].icon}
        <span className="theme-dot" />
      </button>
    </nav>
  );
}
