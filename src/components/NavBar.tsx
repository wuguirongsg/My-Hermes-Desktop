import { useNavigate, useLocation } from "react-router-dom";
import Icon from "./Icon";

const NAV_ITEMS = [
  { path: "/", icon: "message", label: "对话" },
  { path: "/memory", icon: "brain", label: "记忆" },
  { path: "/dashboard", icon: "dashboard", label: "管理" },
  { path: "/settings", icon: "settings", label: "设置" },
] as const;

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="navbar">
      {NAV_ITEMS.map(({ path, icon, label }) => (
        <button
          key={path}
          className={`navbar-item${location.pathname === path ? " active" : ""}`}
          onClick={() => navigate(path)}
          title={label}
        >
          <Icon name={icon} className="navbar-icon" size={17} />
          <span className="navbar-label ui-font">{label}</span>
        </button>
      ))}

      <div className="navbar-spacer" />
    </nav>
  );
}
