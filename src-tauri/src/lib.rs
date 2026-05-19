use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};

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
    pub chat_processes: std::sync::Mutex<std::collections::HashMap<String, std::process::Child>>,
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
            chat_processes: std::sync::Mutex::new(std::collections::HashMap::new()),
        }
    }
}

// ─── Tray Setup ───────────────────────────────────────────────────────────────

fn setup_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::{
        menu::{Menu, MenuItem, PredefinedMenuItem},
        tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    };

    let open = MenuItem::with_id(app, "open", "打开 Hermes Desktop", true, None::<&str>)?;
    let new_session = MenuItem::with_id(app, "new_session", "新建会话", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&open, &new_session, &sep, &quit])?;

    TrayIconBuilder::with_id("hermes-tray")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Hermes Desktop")
        .menu(&menu)
        // 左键单击切换窗口显示/隐藏
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(win) = app.get_webview_window("main") {
                    if win.is_visible().unwrap_or(false) {
                        win.hide().unwrap();
                    } else {
                        win.show().unwrap();
                        win.set_focus().unwrap();
                    }
                }
            }
        })
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => {
                if let Some(win) = app.get_webview_window("main") {
                    win.show().unwrap();
                    win.set_focus().unwrap();
                }
            }
            "new_session" => {
                if let Some(win) = app.get_webview_window("main") {
                    win.show().unwrap();
                    win.set_focus().unwrap();
                    let _ = win.emit("new-session-from-tray", ());
                }
            }
            "quit" => {
                // 退出前 kill 后台进程
                let state = app.state::<AppState>();
                if let Some(mut child) = state.dashboard_child.lock().unwrap().take() {
                    child.kill().ok();
                }
                let mut procs = state.chat_processes.lock().unwrap();
                for (_, mut child) in procs.drain() {
                    child.kill().ok();
                }
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

// ─── App Entry Point ──────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .setup(|app| {
            setup_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| match event {
            // 关闭按钮 → 隐藏到托盘，不退出进程
            tauri::WindowEvent::CloseRequested { api, .. } => {
                window.hide().unwrap();
                api.prevent_close();
            }
            // 进程真正退出时（app.exit() 触发）kill dashboard
            tauri::WindowEvent::Destroyed => {
                let state = tauri::Manager::state::<AppState>(window);
                let child = state.dashboard_child.lock().unwrap().take();
                drop(state);
                if let Some(mut c) = child {
                    c.kill().ok();
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            commands::sessions::list_sessions,
            commands::sessions::get_session_history,
            commands::sessions::delete_session,
            commands::sessions::rename_session,
            commands::sessions::undo_last_turn,
            commands::sessions::set_hermes_path,
            commands::chat::send_message,
            commands::chat::kill_session,
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
            commands::tray::update_tray_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
