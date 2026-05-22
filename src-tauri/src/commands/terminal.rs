use crate::AppState;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::io::{Read, Write};
use tauri::{AppHandle, Emitter, State};

fn append_tui_args(cmd: &mut CommandBuilder, session_id: Option<&str>) {
    cmd.arg("chat");
    cmd.arg("--tui");
    if let Some(id) = session_id {
        cmd.arg("--resume");
        cmd.arg(id);
    }
}

#[cfg(target_os = "windows")]
fn build_wsl_tui_command(wsl_hermes_path: &str, session_id: Option<&str>) -> CommandBuilder {
    let mut cmd = CommandBuilder::new("cmd.exe");
    cmd.args(["/D", "/Q", "/C", "wsl.exe", wsl_hermes_path]);
    append_tui_args(&mut cmd, session_id);
    cmd
}

fn build_tui_command(session_id: Option<&str>) -> Result<CommandBuilder, String> {
    #[cfg(target_os = "windows")]
    {
        let Some(wsl_path) = super::sessions::wsl_hermes_path() else {
            return Err("WSL 中未找到 hermes，请先在 WSL 里安装并确认 `bash -l -c \"command -v hermes\"` 能找到它".into());
        };
        return Ok(build_wsl_tui_command(wsl_path, session_id));
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut cmd = CommandBuilder::new(super::sessions::hermes_binary());
        append_tui_args(&mut cmd, session_id);
        Ok(cmd)
    }
}

fn close_pty_handles(state: &AppState, pty_id: &str) {
    if let Some(mut child) = state.pty_children.lock().unwrap().remove(pty_id) {
        let _ = child.kill();
    }
    state.pty_writers.lock().unwrap().remove(pty_id);
    state.pty_masters.lock().unwrap().remove(pty_id);
}

#[tauri::command]
pub fn pty_open(
    app: AppHandle,
    state: State<'_, AppState>,
    pty_id: String,
    session_id: Option<String>,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    close_pty_handles(&state, &pty_id);

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("PTY open failed: {e}"))?;

    let cmd = build_tui_command(session_id.as_deref())?;

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to start hermes: {e}"))?;
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    state
        .pty_writers
        .lock()
        .unwrap()
        .insert(pty_id.clone(), writer);
    state
        .pty_masters
        .lock()
        .unwrap()
        .insert(pty_id.clone(), pair.master);
    state
        .pty_children
        .lock()
        .unwrap()
        .insert(pty_id.clone(), child);

    let event_name = format!("pty:{}", pty_id);
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    app.emit(&event_name, data).ok();
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn pty_write(state: State<'_, AppState>, pty_id: String, data: String) -> Result<(), String> {
    let mut writers = state.pty_writers.lock().unwrap();
    if let Some(writer) = writers.get_mut(&pty_id) {
        writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn pty_resize(
    state: State<'_, AppState>,
    pty_id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let masters = state.pty_masters.lock().unwrap();
    if let Some(master) = masters.get(&pty_id) {
        master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn pty_close(state: State<'_, AppState>, pty_id: String) -> Result<(), String> {
    close_pty_handles(&state, &pty_id);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsStr;

    #[cfg(target_os = "windows")]
    #[test]
    fn tui_command_uses_wsl_hermes_on_windows() {
        let cmd = build_wsl_tui_command("/home/me/.local/bin/hermes", Some("session-123"));
        let argv = cmd.get_argv();

        assert_eq!(argv[0], OsStr::new("cmd.exe"));
        assert!(argv.iter().any(|arg| arg == OsStr::new("/C")));
        assert!(argv.iter().any(|arg| arg == OsStr::new("wsl.exe")));
        assert!(argv
            .iter()
            .any(|arg| arg == OsStr::new("/home/me/.local/bin/hermes")));
        assert_eq!(
            argv.iter().filter(|arg| *arg == OsStr::new("chat")).count(),
            1
        );
        assert!(argv.iter().any(|arg| arg == OsStr::new("--tui")));
        assert!(argv.iter().any(|arg| arg == OsStr::new("--resume")));
        assert!(argv.iter().any(|arg| arg == OsStr::new("session-123")));
    }
}
