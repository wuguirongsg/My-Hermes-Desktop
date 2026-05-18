use crate::AppState;
use std::net::TcpStream;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};
use tauri::State;

const DASHBOARD_PORT: u16 = 9119;
const READY_TIMEOUT_SECS: u64 = 12;

/// Start hermes dashboard if not already running. Returns "ready" or an error string.
#[tauri::command]
pub async fn dashboard_start(state: State<'_, AppState>) -> Result<String, String> {
    // Already running?
    {
        let mut child_lock = state.dashboard_child.lock().unwrap();
        if let Some(ref mut child) = *child_lock {
            // Check if still alive
            if child.try_wait().map_or(true, |s| s.is_none()) {
                return Ok("ready".to_string());
            }
            // Process died — remove and restart
            *child_lock = None;
        }
    }

    // Spawn hermes dashboard --no-open --port 9119
    let child = Command::new(super::sessions::hermes_binary())
        .args(["dashboard", "--no-open", "--port", &DASHBOARD_PORT.to_string()])
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("start_failed:{e}"))?;

    state.dashboard_child.lock().unwrap().replace(child);

    // Poll for readiness (TCP connect to 127.0.0.1:9119)
    let addr = format!("127.0.0.1:{DASHBOARD_PORT}");
    let deadline = Instant::now() + Duration::from_secs(READY_TIMEOUT_SECS);
    loop {
        if TcpStream::connect_timeout(
            &addr.parse().map_err(|e| format!("addr_parse:{e}"))?,
            Duration::from_millis(200),
        )
        .is_ok()
        {
            return Ok("ready".to_string());
        }
        if Instant::now() >= deadline {
            return Err("timeout".to_string());
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
