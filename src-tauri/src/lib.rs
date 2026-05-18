use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

pub mod stream;
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
    pub session_id: String,
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
    pub pty_masters: std::sync::Mutex<
        std::collections::HashMap<String, Box<dyn portable_pty::MasterPty + Send>>,
    >,
    pub pty_children: std::sync::Mutex<
        std::collections::HashMap<String, Box<dyn portable_pty::Child + Send + Sync>>,
    >,
    pub dashboard_child: std::sync::Mutex<Option<std::process::Child>>,
    pub background_tasks: Arc<
        Mutex<std::collections::HashMap<String, commands::background::BackgroundTask>>,
    >,
    pub say_process: std::sync::Mutex<Option<std::process::Child>>,
}

impl AppState {
    pub fn new() -> Self {
        AppState {
            pty_writers: std::sync::Mutex::new(std::collections::HashMap::new()),
            pty_masters: std::sync::Mutex::new(std::collections::HashMap::new()),
            pty_children: std::sync::Mutex::new(std::collections::HashMap::new()),
            dashboard_child: std::sync::Mutex::new(None),
            background_tasks: Arc::new(Mutex::new(std::collections::HashMap::new())),
            say_process: std::sync::Mutex::new(None),
        }
    }
}

// ─── App Entry Point ──────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
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
            commands::sessions::rename_session,
            commands::sessions::undo_last_turn,
            commands::chat::send_message,
            commands::chat::get_hermes_info,
            commands::chat::get_hermes_model_config,
            commands::chat::set_hermes_model,
            commands::setup::check_hermes_setup,
            commands::setup::open_install_terminal,
            commands::setup::open_setup_terminal,
            commands::memory::read_memory,
            commands::memory::save_memory,
            commands::dashboard::dashboard_start,
            commands::dashboard::dashboard_stop,
            commands::dashboard::dashboard_status,
            commands::terminal::pty_open,
            commands::terminal::pty_write,
            commands::terminal::pty_resize,
            commands::terminal::pty_close,
            commands::background::bg_start,
            commands::background::bg_list,
            commands::background::bg_get_output,
            commands::background::bg_stop,
            commands::background::bg_stop_all,
            commands::background::bg_clear_finished,
            commands::background::bg_running_count,
            commands::files::list_dir,
            commands::files::read_text_file,
            commands::files::get_home_dir,
            commands::files::open_path,
            commands::files::open_with_editor,
            commands::files::speak_text,
            commands::files::stop_speak,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
