import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { HashRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import NavBar from "./components/NavBar";
import ChatPage from "./pages/ChatPage";
import MemoryPage from "./pages/MemoryPage";
import DashboardPage from "./pages/DashboardPage";
import OnboardingPage, { type HermesSetupStatus } from "./pages/OnboardingPage";
import SettingsPage from "./pages/SettingsPage";
import KeyboardShortcutsPanel from "./components/KeyboardShortcutsPanel";
import { useTheme } from "./hooks/useTheme";

const isMac = navigator.platform.toLowerCase().includes("mac");

function setupErrorMessage(error: unknown) {
  const message = String(error);
  if (message.includes("invoke") || message.includes("__TAURI")) {
    return "未检测到 Hermes CLI，请完成安装后重新检测。";
  }
  return message;
}

// ChatPage holds long-lived per-session state (running chats, queues, the
// hermes:chunk listener). Unmounting it on route change would orphan running
// hermes processes — their output chunks would arrive but no one would
// consume them. Keep ChatPage permanently mounted; toggle visibility via CSS.
function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  useTheme();
  const isChat = location.pathname === "/";
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [setup, setSetup] = useState<HermesSetupStatus | null>(null);
  const [ready, setReady] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const checkSetup = useCallback(async () => {
    setCheckingSetup(true);
    try {
      const nextSetup = await invoke<HermesSetupStatus>("check_hermes_setup");
      setSetup(nextSetup);
      if (nextSetup.installed) {
        window.localStorage.setItem("hermes.onboarding.complete", "true");
        setReady(true);
      } else {
        setReady(false);
      }
    } catch (e) {
      setSetup({
        installed: false,
        version: "",
        hermes_home: "",
        config_exists: false,
        api_key_configured: false,
        configured_providers: [],
        error: setupErrorMessage(e),
      });
      setReady(false);
    } finally {
      setCheckingSetup(false);
    }
  }, []);

  useEffect(() => {
    checkSetup();
  }, [checkSetup]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      if (modKey && e.key === "/") {
        e.preventDefault();
        setShowShortcuts((v) => !v);
      }
      if (modKey && e.key === "n") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("new-session-hotkey"));
      }
      if (modKey && e.key === "w") {
        e.preventDefault();
        setShowShortcuts(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (checkingSetup && !setup && !ready) {
    return (
      <div className="setup-loading">
        <span className="loading-dots" style={{ fontSize: 20 }} />
        <div className="dashboard-loading-text ui-font">正在检测 Hermes CLI…</div>
      </div>
    );
  }

  if (!ready) {
    return <OnboardingPage setup={setup} checking={checkingSetup} onRetry={checkSetup} />;
  }

  return (
    <div className="app-shell">
      <NavBar />
      {showShortcuts && <KeyboardShortcutsPanel onClose={() => setShowShortcuts(false)} />}
      <div className="page-area">
        <div className="chat-page-host" style={{ display: isChat ? "block" : "none" }}>
          <ChatPage apiKeyConfigured={setup?.api_key_configured ?? true} />
        </div>
        {!isChat && (
          <Routes>
            <Route path="/memory" element={<MemoryPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route
              path="/onboarding"
              element={
                <OnboardingPage
                  setup={setup}
                  checking={checkingSetup}
                  onRetry={checkSetup}
                  onContinue={() => navigate("/")}
                />
              }
            />
          </Routes>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  );
}
