use crate::AppState;
use portable_pty::{CommandBuilder, PtySize, native_pty_system};
use std::io::{Read, Write};
use tauri::{AppHandle, Emitter, State};

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
        .openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| format!("PTY open failed: {e}"))?;

    let mut cmd = CommandBuilder::new("hermes");
    cmd.arg("chat");
    cmd.arg("--tui");
    if let Some(ref id) = session_id {
        cmd.arg("--resume");
        cmd.arg(id);
    }

    let child = pair.slave.spawn_command(cmd).map_err(|e| format!("Failed to start hermes: {e}"))?;
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    state.pty_writers.lock().unwrap().insert(pty_id.clone(), writer);
    state.pty_masters.lock().unwrap().insert(pty_id.clone(), pair.master);
    state.pty_children.lock().unwrap().insert(pty_id.clone(), child);

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
pub fn pty_write(
    state: State<'_, AppState>,
    pty_id: String,
    data: String,
) -> Result<(), String> {
    let mut writers = state.pty_writers.lock().unwrap();
    if let Some(writer) = writers.get_mut(&pty_id) {
        writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
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
            .resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn pty_close(
    state: State<'_, AppState>,
    pty_id: String,
) -> Result<(), String> {
    close_pty_handles(&state, &pty_id);
    Ok(())
}
