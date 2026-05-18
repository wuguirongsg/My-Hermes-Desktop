use crate::Session;
use base64::Engine;
use regex::Regex;
use std::process::Command;
use std::sync::OnceLock;

static IMAGE_MARKER_RE: OnceLock<Regex> = OnceLock::new();

fn image_marker_re() -> &'static Regex {
    IMAGE_MARKER_RE.get_or_init(|| Regex::new(r"\[Image attached at:\s*([^\]]+)\]").unwrap())
}

fn mime_for_path(path: &str) -> Option<&'static str> {
    let lower = path.to_ascii_lowercase();
    if lower.ends_with(".png") { Some("image/png") }
    else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") { Some("image/jpeg") }
    else if lower.ends_with(".gif") { Some("image/gif") }
    else if lower.ends_with(".webp") { Some("image/webp") }
    else if lower.ends_with(".bmp") { Some("image/bmp") }
    else { None }
}

fn read_image_as_data_url(path: &str) -> Option<String> {
    let mime = mime_for_path(path)?;
    let bytes = std::fs::read(path).ok()?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Some(format!("data:{mime};base64,{b64}"))
}

// Walk a message JSON value, collect & strip "[Image attached at: <path>]" markers
// from text content. Returns the list of data URLs that should be attached as
// image blocks on the client side.
fn extract_image_attachments(msg: &mut serde_json::Value) -> Vec<String> {
    let re = image_marker_re();
    let mut paths: Vec<String> = Vec::new();

    let strip = |text: &str, paths: &mut Vec<String>| -> String {
        for cap in re.captures_iter(text) {
            if let Some(p) = cap.get(1) {
                paths.push(p.as_str().trim().to_string());
            }
        }
        re.replace_all(text, "").trim().to_string()
    };

    if let Some(content) = msg.get_mut("content") {
        match content {
            serde_json::Value::String(s) => {
                let cleaned = strip(s, &mut paths);
                *s = cleaned;
            }
            serde_json::Value::Array(arr) => {
                for block in arr.iter_mut() {
                    if block.get("type").and_then(|v| v.as_str()) == Some("text") {
                        if let Some(text_val) = block.get_mut("text") {
                            if let Some(s) = text_val.as_str() {
                                let cleaned = strip(s, &mut paths);
                                *text_val = serde_json::Value::String(cleaned);
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    }

    paths.into_iter()
        .filter_map(|p| read_image_as_data_url(&p))
        .collect()
}

fn enrich_history_with_images(value: &mut serde_json::Value) {
    let messages: Option<&mut Vec<serde_json::Value>> = match value {
        serde_json::Value::Array(arr) => Some(arr),
        serde_json::Value::Object(obj) => obj.get_mut("messages").and_then(|m| m.as_array_mut()),
        _ => None,
    };
    if let Some(messages) = messages {
        for msg in messages.iter_mut() {
            let urls = extract_image_attachments(msg);
            if !urls.is_empty() {
                if let serde_json::Value::Object(map) = msg {
                    map.insert(
                        "image_attachments".into(),
                        serde_json::Value::Array(
                            urls.into_iter().map(serde_json::Value::String).collect(),
                        ),
                    );
                }
            }
        }
    }
}

pub fn hermes_home() -> Option<std::path::PathBuf> {
    dirs::home_dir().map(|h| h.join(".hermes"))
}

/// Resolve the hermes binary path.
/// macOS .app bundles only get a minimal PATH (/usr/bin:/bin:/usr/sbin:/sbin),
/// so we check known install locations first, then fall back to the login shell.
pub fn hermes_binary() -> String {
    let mut candidates: Vec<std::path::PathBuf> = Vec::new();
    if let Some(home) = dirs::home_dir() {
        candidates.push(home.join(".hermes").join("bin").join("hermes"));
        candidates.push(home.join(".local").join("bin").join("hermes"));
        candidates.push(home.join("bin").join("hermes"));
    }
    candidates.push(std::path::PathBuf::from("/usr/local/bin/hermes"));
    candidates.push(std::path::PathBuf::from("/opt/homebrew/bin/hermes"));
    candidates.push(std::path::PathBuf::from("/usr/bin/hermes"));

    for path in &candidates {
        if path.exists() {
            return path.to_string_lossy().to_string();
        }
    }

    // Fallback: ask the login shell (slower, but handles any custom PATH)
    for shell in &["/bin/zsh", "/bin/bash"] {
        if let Ok(out) = std::process::Command::new(shell)
            .args(["-l", "-c", "command -v hermes 2>/dev/null"])
            .output()
        {
            if out.status.success() {
                let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !path.is_empty() {
                    return path;
                }
            }
        }
    }

    "hermes".to_string()
}

fn filename_stem(path: &std::path::Path) -> String {
    path.file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string()
}

fn title_map_path() -> Option<std::path::PathBuf> {
    hermes_home().map(|h| h.join("session_titles.json"))
}

fn read_title_map() -> std::collections::HashMap<String, String> {
    let Some(path) = title_map_path() else {
        return std::collections::HashMap::new();
    };
    let Ok(text) = std::fs::read_to_string(path) else {
        return std::collections::HashMap::new();
    };
    serde_json::from_str(&text).unwrap_or_default()
}

fn write_title_map(map: &std::collections::HashMap<String, String>) -> Result<(), String> {
    let path = title_map_path().ok_or_else(|| "Cannot find home dir".to_string())?;
    let text = serde_json::to_string_pretty(map).map_err(|e| e.to_string())?;
    std::fs::write(path, format!("{text}\n")).map_err(|e| e.to_string())
}

fn session_file_candidates(session_id: &str) -> Result<Vec<std::path::PathBuf>, String> {
    let home = hermes_home().ok_or("Cannot find home dir")?;
    let sessions_dir = home.join("sessions");
    Ok(vec![
        sessions_dir.join(format!("session_{}.json", session_id)),
        sessions_dir.join(format!("{}.json", session_id)),
        sessions_dir.join(format!("session_{}.jsonl", session_id)),
        sessions_dir.join(format!("{}.jsonl", session_id)),
    ])
}

fn remove_last_turn_from_session_value(session: &mut serde_json::Value) -> Result<(), String> {
    let messages = session
        .get_mut("messages")
        .and_then(|value| value.as_array_mut())
        .ok_or_else(|| "Session has no messages array".to_string())?;

    let Some(last_user_index) = messages
        .iter()
        .rposition(|message| message.get("role").and_then(|role| role.as_str()) == Some("user"))
    else {
        return Ok(());
    };

    messages.truncate(last_user_index);
    let next_count = messages.len() as u64;

    if let Some(count) = session.get_mut("message_count") {
        *count = serde_json::Value::Number(next_count.into());
    }
    if let Some(updated) = session.get_mut("last_updated") {
        *updated = serde_json::Value::String(chrono::Local::now().naive_local().to_string());
    }

    Ok(())
}

fn remove_last_turn_from_jsonl(content: &str) -> Result<String, String> {
    let mut messages: Vec<serde_json::Value> = content
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| serde_json::from_str(line).map_err(|e| e.to_string()))
        .collect::<Result<_, _>>()?;

    let Some(last_user_index) = messages
        .iter()
        .rposition(|message| message.get("role").and_then(|role| role.as_str()) == Some("user"))
    else {
        return Ok(content.to_string());
    };

    messages.truncate(last_user_index);
    let lines = messages
        .into_iter()
        .map(|message| serde_json::to_string(&message).map_err(|e| e.to_string()))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(if lines.is_empty() {
        String::new()
    } else {
        format!("{}\n", lines.join("\n"))
    })
}

fn read_session_info(
    path: &std::path::Path,
    fs_updated: &str,
) -> (String, String, u32, String, Option<String>) {
    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => {
            return (
                filename_stem(path),
                "Untitled".into(),
                0,
                fs_updated.into(),
                None,
            )
        }
    };

    if let Ok(obj) = serde_json::from_str::<serde_json::Value>(&content) {
        if obj.is_object() {
            let hermes_id = obj
                .get("session_id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let id = if hermes_id.is_empty() {
                filename_stem(path)
            } else {
                hermes_id
            };

            let updated = obj
                .get("last_updated")
                .or_else(|| obj.get("session_start"))
                .and_then(|v| v.as_str())
                .unwrap_or(fs_updated)
                .to_string();

            let model = obj
                .get("model")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            let messages = obj
                .get("messages")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();

            let count = messages.len() as u32;
            let title = obj
                .get("title")
                .and_then(|v| v.as_str())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .or_else(|| {
                    messages
                        .iter()
                        .find(|m| m.get("role").and_then(|r| r.as_str()) == Some("user"))
                        .and_then(|m| {
                            let c = m.get("content")?;
                            if let Some(s) = c.as_str() {
                                Some(s.trim().chars().take(60).collect::<String>())
                            } else if let Some(arr) = c.as_array() {
                                arr.iter()
                                    .find(|b| {
                                        b.get("type").and_then(|t| t.as_str()) == Some("text")
                                    })
                                    .and_then(|b| b.get("text").and_then(|t| t.as_str()))
                                    .map(|s| s.trim().chars().take(60).collect::<String>())
                            } else {
                                None
                            }
                        })
                })
                .unwrap_or_else(|| id.clone());

            return (id, title, count, updated, model);
        }
    }

    // JSONL fallback
    let lines: Vec<&str> = content.lines().filter(|l| !l.trim().is_empty()).collect();
    let count = lines.len() as u32;
    let title = lines
        .iter()
        .filter_map(|l| serde_json::from_str::<serde_json::Value>(l).ok())
        .find(|obj| obj.get("role").and_then(|r| r.as_str()) == Some("user"))
        .and_then(|obj| {
            obj.get("content")
                .and_then(|c| c.as_str())
                .map(|s| s.trim().chars().take(60).collect::<String>())
        })
        .unwrap_or_else(|| filename_stem(path));

    (filename_stem(path), title, count, fs_updated.into(), None)
}

#[tauri::command]
pub async fn list_sessions() -> Result<Vec<Session>, String> {
    let sessions_dir = match hermes_home() {
        Some(h) => h.join("sessions"),
        None => return Ok(vec![]),
    };

    // session files are named either `<id>.jsonl` or `session_<id>.json`
    // files to skip: request_dump_*, sessions.json (platform metadata)
    let mut by_id: std::collections::HashMap<String, Session> = std::collections::HashMap::new();
    let title_map = read_title_map();

    if let Ok(entries) = std::fs::read_dir(&sessions_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

            if filename.starts_with("request_dump_") {
                continue;
            }
            if filename == "sessions.json" {
                continue;
            }

            if !path
                .extension()
                .map_or(false, |e| e == "json" || e == "jsonl")
            {
                continue;
            }

            let meta = entry.metadata().ok();
            let fs_updated = meta
                .and_then(|m| m.modified().ok())
                .and_then(|t| {
                    t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| {
                        chrono::DateTime::<chrono::Utc>::from(
                            std::time::UNIX_EPOCH + std::time::Duration::from_secs(d.as_secs()),
                        )
                        .to_rfc3339()
                    })
                })
                .unwrap_or_default();

            let (id, title, count, updated, model) = read_session_info(&path, &fs_updated);
            if id.is_empty() {
                continue;
            }

            // Deduplicate: keep the entry with the higher message count
            let title = title_map.get(&id).cloned().unwrap_or(title);
            let entry_val = Session {
                id: id.clone(),
                title,
                created_at: updated.clone(),
                updated_at: updated,
                message_count: Some(count),
                cost: None,
                model,
            };
            by_id
                .entry(id)
                .and_modify(|existing| {
                    if count > existing.message_count.unwrap_or(0) {
                        *existing = entry_val.clone();
                    }
                })
                .or_insert(entry_val);
        }
    }

    let mut sessions: Vec<Session> = by_id.into_values().collect();
    sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(sessions)
}

#[tauri::command]
pub async fn rename_session(session_id: String, title: String) -> Result<(), String> {
    let clean_title = title.trim();
    if clean_title.is_empty() {
        return Err("Title cannot be empty".into());
    }

    let out = Command::new(hermes_binary())
        .args(["sessions", "rename", &session_id, clean_title])
        .output()
        .map_err(|e| format!("Failed to start hermes: {e}. Is hermes installed and in PATH?"))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
        let message = if !stderr.is_empty() { stderr } else { stdout };
        return Err(if message.is_empty() {
            "Failed to rename session".into()
        } else {
            message
        });
    }

    let mut map = read_title_map();
    map.insert(session_id.clone(), clean_title.to_string());
    write_title_map(&map)?;

    Ok(())
}

#[tauri::command]
pub async fn get_session_history(session_id: String) -> Result<serde_json::Value, String> {
    let out = Command::new(hermes_binary())
        .args(["sessions", "export", "-", "--session-id", &session_id])
        .output();

    if let Ok(o) = out {
        if o.status.success() {
            let text = String::from_utf8_lossy(&o.stdout).to_string();
            if let Ok(mut v) = serde_json::from_str::<serde_json::Value>(&text) {
                enrich_history_with_images(&mut v);
                return Ok(v);
            }
            let exported: Vec<serde_json::Value> = text
                .lines()
                .filter(|line| !line.trim().is_empty())
                .filter_map(|line| serde_json::from_str::<serde_json::Value>(line).ok())
                .collect();
            if exported.len() == 1 {
                let mut v = exported.into_iter().next().unwrap();
                enrich_history_with_images(&mut v);
                return Ok(v);
            }
            if !exported.is_empty() {
                let mut v = serde_json::Value::Array(exported);
                enrich_history_with_images(&mut v);
                return Ok(v);
            }
        }
    }

    for p in session_file_candidates(&session_id)? {
        let candidate = p.file_name().and_then(|name| name.to_str()).unwrap_or("");
        if p.exists() {
            let content = std::fs::read_to_string(&p).map_err(|e| e.to_string())?;
            if candidate.ends_with(".jsonl") {
                let msgs: Vec<serde_json::Value> = content
                    .lines()
                    .filter_map(|l| serde_json::from_str(l).ok())
                    .collect();
                let mut v = serde_json::Value::Array(msgs);
                enrich_history_with_images(&mut v);
                return Ok(v);
            } else {
                let mut v: serde_json::Value =
                    serde_json::from_str(&content).map_err(|e| e.to_string())?;
                enrich_history_with_images(&mut v);
                return Ok(v);
            }
        }
    }

    Ok(serde_json::Value::Array(vec![]))
}

#[tauri::command]
pub async fn undo_last_turn(session_id: String) -> Result<(), String> {
    for path in session_file_candidates(&session_id)? {
        if !path.exists() {
            continue;
        }

        let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let updated = if path.extension().map_or(false, |ext| ext == "jsonl") {
            remove_last_turn_from_jsonl(&content)?
        } else {
            let mut session: serde_json::Value =
                serde_json::from_str(&content).map_err(|e| e.to_string())?;
            remove_last_turn_from_session_value(&mut session)?;
            format!(
                "{}\n",
                serde_json::to_string_pretty(&session).map_err(|e| e.to_string())?
            )
        };

        std::fs::write(&path, updated).map_err(|e| e.to_string())?;
        return Ok(());
    }

    Err("Session file not found".into())
}

#[tauri::command]
pub async fn delete_session(session_id: String) -> Result<(), String> {
    // Tell hermes to deregister the session from its internal state
    let _ = Command::new(hermes_binary())
        .args(["sessions", "delete", "--yes", &session_id])
        .output();

    // Always delete the session files — hermes CLI only removes its internal
    // tracking record but leaves the .json/.jsonl files on disk
    if let Some(home) = hermes_home() {
        let sessions_dir = home.join("sessions");
        for name in [
            format!("session_{}.json", session_id),
            format!("{}.json", session_id),
            format!("session_{}.jsonl", session_id),
            format!("{}.jsonl", session_id),
        ] {
            let p = sessions_dir.join(&name);
            if p.exists() {
                let _ = std::fs::remove_file(&p);
            }
        }
    }

    let mut map = read_title_map();
    if map.remove(&session_id).is_some() {
        let _ = write_title_map(&map);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn remove_last_turn_truncates_from_last_user_message() {
        let mut session = json!({
            "message_count": 5,
            "messages": [
                { "role": "user", "content": "first" },
                { "role": "assistant", "content": "first reply" },
                { "role": "user", "content": "second" },
                { "role": "assistant", "content": "", "tool_calls": [] },
                { "role": "tool", "content": "{}" }
            ]
        });

        remove_last_turn_from_session_value(&mut session).unwrap();

        let messages = session["messages"].as_array().unwrap();
        assert_eq!(messages.len(), 2);
        assert_eq!(session["message_count"], 2);
        assert_eq!(messages[0]["content"], "first");
        assert_eq!(messages[1]["content"], "first reply");
    }
}
