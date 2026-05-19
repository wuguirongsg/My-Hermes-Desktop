use tauri::AppHandle;

/// 由前端调用，同步当前流式状态到系统托盘图标 tooltip 和标题
#[tauri::command]
pub fn update_tray_status(app: AppHandle, status: String) -> Result<(), String> {
    let Some(tray) = app.tray_by_id("hermes-tray") else {
        return Ok(());
    };

    let (tooltip, title) = match status.as_str() {
        "running" => ("Hermes Desktop — 运行中", "●"),
        "error" => ("Hermes Desktop — 错误", "⚠"),
        _ => ("Hermes Desktop", ""),
    };

    tray.set_tooltip(Some(tooltip)).map_err(|e| e.to_string())?;

    // macOS 支持在图标右侧显示文字，其他平台忽略
    #[cfg(target_os = "macos")]
    tray.set_title(Some(title)).map_err(|e| e.to_string())?;
    #[cfg(not(target_os = "macos"))]
    let _ = title;

    Ok(())
}
