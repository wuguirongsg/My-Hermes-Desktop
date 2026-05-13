use crate::Session;
use std::process::Command;

pub fn hermes_home() -> Option<std::path::PathBuf> {
    dirs::home_dir().map(|h| h.join(".hermes"))
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

    let out = Command::new("hermes")
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
    let out = Command::new("hermes")
        .args(["sessions", "export", "-", "--session-id", &session_id])
        .output();

    if let Ok(o) = out {
        if o.status.success() {
            let text = String::from_utf8_lossy(&o.stdout).to_string();
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
                return Ok(v);
            }
            let exported: Vec<serde_json::Value> = text
                .lines()
                .filter(|line| !line.trim().is_empty())
                .filter_map(|line| serde_json::from_str::<serde_json::Value>(line).ok())
                .collect();
            if exported.len() == 1 {
                return Ok(exported.into_iter().next().unwrap());
            }
            if !exported.is_empty() {
                return Ok(serde_json::Value::Array(exported));
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
                return Ok(serde_json::Value::Array(msgs));
            } else {
                return serde_json::from_str(&content).map_err(|e| e.to_string());
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
    let _ = Command::new("hermes")
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
