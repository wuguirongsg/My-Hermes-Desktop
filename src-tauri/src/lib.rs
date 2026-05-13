use serde::{Deserialize, Serialize};

mod stream;
pub mod commands;

// ─── Shared Data Types ────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Session {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    pub message_count: Option<u32>,
    pub cost: Option<f64>,
    pub model: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct StreamChunk {
    /// "text" | "think" | "think_start" | "think_end"
    /// "tool_name" | "tool_input" | "tool_output" | "tool_output_end"
    /// "status" | "session_stat" | "new_session_id" | "done" | "error"
    pub kind: String,
    pub content: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct StatusInfo {
    pub model: String,
    pub tokens_used: String,
    pub tokens_max: String,
    pub cost: String,
    pub duration: String,
}

// ─── Shared App State ─────────────────────────────────────────────────────────

pub struct AppState {
    pub pty_writers: std::sync::Mutex<
        std::collections::HashMap<String, Box<dyn std::io::Write + Send>>,
    >,
    pub dashboard_child: std::sync::Mutex<Option<std::process::Child>>,
}

impl AppState {
    pub fn new() -> Self {
        AppState {
            pty_writers: std::sync::Mutex::new(std::collections::HashMap::new()),
            dashboard_child: std::sync::Mutex::new(None),
        }
    }
}

// ─── App Entry Point ──────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState::new())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let opt = tauri::Manager::state::<AppState>(window)
                    .dashboard_child
                    .lock()
                    .unwrap()
                    .take();
                if let Some(mut child) = opt {
                    child.kill().ok();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::sessions::list_sessions,
            commands::sessions::get_session_history,
            commands::sessions::delete_session,
            commands::chat::send_message,
            commands::chat::get_hermes_info,
            commands::chat::get_hermes_model_config,
            commands::memory::read_memory,
            commands::memory::save_memory,
            commands::dashboard::dashboard_start,
            commands::dashboard::dashboard_stop,
            commands::dashboard::dashboard_status,
            commands::terminal::pty_open,
            commands::terminal::pty_write,
            commands::terminal::pty_resize,
            commands::terminal::pty_close,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
