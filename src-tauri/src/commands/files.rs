use serde::Serialize;
use std::path::Path;

#[derive(Serialize, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

#[tauri::command]
pub async fn list_dir(path: String) -> Result<Vec<FileEntry>, String> {
    let dir = Path::new(&path);
    if !dir.is_dir() {
        return Err(format!("Not a directory: {path}"));
    }

    let mut entries: Vec<FileEntry> = std::fs::read_dir(dir)
        .map_err(|e| format!("Cannot read directory: {e}"))?
        .filter_map(|res| res.ok())
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().to_string();
            // skip hidden files (starting with .)
            if name.starts_with('.') {
                return None;
            }
            let meta = entry.metadata().ok()?;
            Some(FileEntry {
                path: entry.path().to_string_lossy().to_string(),
                name,
                is_dir: meta.is_dir(),
                size: meta.len(),
            })
        })
        .collect();

    // directories first, then files, both sorted alphabetically
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

#[tauri::command]
pub async fn get_home_dir() -> String {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "/".to_string())
}

#[tauri::command]
pub async fn open_path(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("open failed: {e}"))?;

    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("open failed: {e}"))?;

    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("open failed: {e}"))?;

    Ok(())
}

#[tauri::command]
pub async fn open_with_editor(path: String, editor: String) -> Result<(), String> {
    let cmd = if editor.trim().is_empty() {
        "code".to_string()
    } else {
        editor.trim().to_string()
    };

    #[cfg(target_os = "macos")]
    {
        // Map known editor CLI names to macOS .app bundle names.
        // `open -a` uses the system app database — no PATH dependency.
        let app_name = match cmd.as_str() {
            "code" => Some("Visual Studio Code"),
            "cursor" => Some("Cursor"),
            "zed" => Some("Zed"),
            "windsurf" => Some("Windsurf"),
            "webstorm" => Some("WebStorm"),
            "idea" => Some("IntelliJ IDEA"),
            _ => None,
        };
        if let Some(app) = app_name {
            return std::process::Command::new("open")
                .args(["-a", app, &path])
                .spawn()
                .map_err(|e| format!("无法打开 {app}：{e}（确认已安装该应用）"))
                .map(|_| ());
        }
        // Fallback: try via login shell (picks up /usr/local/bin etc.)
        let shell_cmd = format!("{} \"{}\"", cmd, path.replace('"', "\\\""));
        std::process::Command::new("/bin/zsh")
            .args(["-l", "-c", &shell_cmd])
            .spawn()
            .map_err(|e| format!("命令 '{cmd}' 未找到：{e}"))?;
    }

    #[cfg(not(target_os = "macos"))]
    {
        std::process::Command::new(&cmd)
            .arg(&path)
            .spawn()
            .map_err(|e| {
                format!("Cannot open editor '{cmd}': {e}. Is it installed and in PATH?")
            })?;
    }

    Ok(())
}

#[tauri::command]
pub async fn speak_text(
    text: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // Kill any running say process first
        if let Ok(mut guard) = state.say_process.lock() {
            if let Some(mut child) = guard.take() {
                child.kill().ok();
            }
        }
        let truncated: String = text.chars().take(500).collect();
        let child = std::process::Command::new("/usr/bin/say")
            .args(["-v", "Tingting", &truncated])
            .spawn()
            .map_err(|e| format!("say failed: {e}"))?;
        if let Ok(mut guard) = state.say_process.lock() {
            *guard = Some(child);
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn stop_speak(state: tauri::State<'_, crate::AppState>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if let Ok(mut guard) = state.say_process.lock() {
            if let Some(mut child) = guard.take() {
                child.kill().ok();
            }
        }
    }
    Ok(())
}

const MAX_PREVIEW_BYTES: u64 = 512 * 1024; // 512 KB

#[tauri::command]
pub async fn read_text_file(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    let size = p.metadata().map(|m| m.len()).unwrap_or(0);
    if size > MAX_PREVIEW_BYTES {
        return Err(format!("File too large to preview ({} KB)", size / 1024));
    }
    std::fs::read_to_string(p).map_err(|e| format!("Cannot read file: {e}"))
}

/// Check whether ~/.hermes/memories/MEMORY.md exists and is non-empty.
#[tauri::command]
pub async fn check_memory_loaded() -> bool {
    let Some(home) = dirs::home_dir() else { return false };
    let path = home.join(".hermes").join("memories").join("MEMORY.md");
    path.metadata().map(|m| m.len() > 0).unwrap_or(false)
}

/// Copy a user-selected file into ~/.hermes/uploads/YYYY-MM-DD/ and return the destination path.
/// The caller passes the source path (from Tauri file dialog); we handle the rest.
#[tauri::command]
pub async fn save_upload(src_path: String) -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let date = chrono::Local::now().format("%Y-%m-%d").to_string();
    let upload_dir = home.join(".hermes").join("uploads").join(&date);
    std::fs::create_dir_all(&upload_dir).map_err(|e| format!("Cannot create upload dir: {e}"))?;
    let filename = Path::new(&src_path)
        .file_name()
        .ok_or("Invalid source path")?
        .to_string_lossy()
        .to_string();
    let dest = upload_dir.join(&filename);
    std::fs::copy(&src_path, &dest).map_err(|e| format!("Cannot copy file: {e}"))?;
    Ok(dest.to_string_lossy().to_string())
}
