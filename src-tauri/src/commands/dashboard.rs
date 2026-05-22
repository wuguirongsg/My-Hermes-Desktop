use crate::AppState;
use std::io::Read;
use std::net::TcpStream;
use std::process::Stdio;
use std::time::{Duration, Instant};
use tauri::{Manager, State};

const DASHBOARD_PORT: u16 = 9119;
const READY_TIMEOUT_SECS: u64 = 12;

fn dashboard_port_ready() -> Result<bool, String> {
    let addr = format!("127.0.0.1:{DASHBOARD_PORT}");
    Ok(TcpStream::connect_timeout(
        &addr.parse().map_err(|e| format!("addr_parse:{e}"))?,
        Duration::from_millis(200),
    )
    .is_ok())
}

fn normalize_dashboard_error(stderr: &str) -> String {
    let message = stderr.trim();
    if message.contains("Web UI frontend not built and npm is not available")
        || message.contains("--skip-build was passed but no web dist found")
    {
        return format!(
            "dashboard_dependency_missing:WSL 中的 Hermes Dashboard 前端未构建，且 npm 不可用。请在 WSL 终端执行：cd ~/.hermes/hermes-agent/web && npm install && npm run build。原始错误：{message}"
        );
    }

    if message.is_empty() {
        "dashboard_failed:Dashboard process exited before it was ready".to_string()
    } else {
        format!("dashboard_failed:{message}")
    }
}

fn read_stderr_thread(handle: Option<std::thread::JoinHandle<String>>) -> String {
    handle.and_then(|h| h.join().ok()).unwrap_or_default()
}

fn dashboard_args() -> Vec<String> {
    vec![
        "dashboard".into(),
        "--no-open".into(),
        "--skip-build".into(),
        "--port".into(),
        DASHBOARD_PORT.to_string(),
    ]
}

/// Start hermes dashboard if not already running. Returns "ready" or an error string.
#[tauri::command]
pub async fn dashboard_start(state: State<'_, AppState>) -> Result<String, String> {
    {
        let mut child_lock = state.dashboard_child.lock().unwrap();
        if let Some(ref mut child) = *child_lock {
            if child.try_wait().map_or(true, |s| s.is_none()) {
                if dashboard_port_ready()? {
                    return Ok("ready".to_string());
                }
                child.kill().ok();
            }
            *child_lock = None;
        }
    }

    let mut child = super::sessions::hermes_command()
        .args(dashboard_args())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("start_failed:{e}"))?;

    let stderr_handle = child.stderr.take().map(|mut stderr| {
        std::thread::spawn(move || {
            let mut text = String::new();
            stderr.read_to_string(&mut text).ok();
            text
        })
    });

    let deadline = Instant::now() + Duration::from_secs(READY_TIMEOUT_SECS);
    loop {
        if dashboard_port_ready()? {
            state.dashboard_child.lock().unwrap().replace(child);
            return Ok("ready".to_string());
        }

        if let Some(status) = child.try_wait().map_err(|e| format!("wait_failed:{e}"))? {
            let stderr = read_stderr_thread(stderr_handle);
            let message = if stderr.trim().is_empty() {
                format!("dashboard exited with status {status}")
            } else {
                stderr
            };
            return Err(normalize_dashboard_error(&message));
        }

        if Instant::now() >= deadline {
            child.kill().ok();
            let stderr = read_stderr_thread(stderr_handle);
            if stderr.trim().is_empty() {
                return Err("timeout".to_string());
            }
            return Err(format!("timeout:{}", normalize_dashboard_error(&stderr)));
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
}

/// Kill the dashboard process (called on app exit).
#[tauri::command]
pub fn dashboard_stop(state: State<'_, AppState>) -> Result<(), String> {
    if let Some(mut child) = state.dashboard_child.lock().unwrap().take() {
        child.kill().ok();
    }
    Ok(())
}

/// Query current dashboard status without starting.
#[tauri::command]
pub fn dashboard_status(state: State<'_, AppState>) -> String {
    let mut lock = state.dashboard_child.lock().unwrap();
    match lock.as_mut() {
        None => "stopped".to_string(),
        Some(child) => match child.try_wait() {
            Ok(Some(_)) => {
                *lock = None;
                "stopped".to_string()
            }
            Ok(None) => "running".to_string(),
            Err(_) => "unknown".to_string(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dashboard_error_explains_missing_web_build_tools() {
        let msg = normalize_dashboard_error("Web UI frontend not built and npm is not available.");

        assert!(msg.contains("dashboard_dependency_missing:"));
        assert!(msg.contains("WSL"));
        assert!(msg.contains("npm"));
        assert!(msg.contains("cd ~/.hermes/hermes-agent/web"));
    }

    #[test]
    fn dashboard_error_keeps_unknown_stderr() {
        let msg = normalize_dashboard_error("some other failure");

        assert_eq!(msg, "dashboard_failed:some other failure");
    }

    #[test]
    fn dashboard_args_skip_build_for_desktop_embedding() {
        assert!(dashboard_args().iter().any(|arg| arg == "--skip-build"));
    }
}

// ─── Dashboard theme installer ───────────────────────────────────────────────

/// Install bundled dashboard themes and the desktop-theme-sync plugin into
/// ~/.hermes/ so the embedded dashboard can load them as user themes.
#[tauri::command]
pub async fn install_dashboard_themes(app_handle: tauri::AppHandle) -> Result<bool, String> {
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("resource_dir:{e}"))?;
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let hermes_home = home.join(".hermes");

    // Source paths inside the app bundle
    let themes_src = resource_dir.join("dashboard-themes");
    let plugin_src = resource_dir.join("dashboard-plugins/desktop-theme-sync/dashboard");

    // Destination paths in the user's home
    let themes_dst = hermes_home.join("dashboard-themes");
    let plugin_dst = hermes_home.join("plugins/desktop-theme-sync/dashboard");

    std::fs::create_dir_all(&themes_dst).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&plugin_dst).map_err(|e| e.to_string())?;

    let theme_files = ["claude.yaml", "apple.yaml", "warp.yaml"];
    for file in &theme_files {
        let src = themes_src.join(file);
        let dst = themes_dst.join(file);
        if src.exists() {
            std::fs::copy(&src, &dst).map_err(|e| e.to_string())?;
        }
    }

    let plugin_files = ["manifest.json", "index.js"];
    for file in &plugin_files {
        let src = plugin_src.join(file);
        let dst = plugin_dst.join(file);
        if src.exists() {
            std::fs::copy(&src, &dst).map_err(|e| e.to_string())?;
        }
    }

    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dashboard_error_explains_missing_web_build_tools() {
        let msg = normalize_dashboard_error("Web UI frontend not built and npm is not available.");

        assert!(msg.contains("dashboard_dependency_missing:"));
        assert!(msg.contains("WSL"));
        assert!(msg.contains("npm"));
        assert!(msg.contains("cd ~/.hermes/hermes-agent/web"));
    }

    #[test]
    fn dashboard_error_keeps_unknown_stderr() {
        let msg = normalize_dashboard_error("some other failure");

        assert_eq!(msg, "dashboard_failed:some other failure");
    }

    #[test]
    fn dashboard_args_skip_build_for_desktop_embedding() {
        assert!(dashboard_args().iter().any(|arg| arg == "--skip-build"));
    }
}
