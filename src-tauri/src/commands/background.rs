use crate::AppState;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use tauri::State;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BackgroundTask {
    pub id: String,
    pub prompt: String,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub status: String, // "running" | "done" | "failed"
    pub pid: Option<u32>,
    pub exit_code: Option<i32>,
    pub output_path: String,
    pub session_id: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct BackgroundTaskSummary {
    pub id: String,
    pub prompt: String,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub status: String,
    pub pid: Option<u32>,
    pub exit_code: Option<i32>,
    pub session_id: Option<String>,
    pub tail: String,
}

fn output_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/tmp"));
    home.join(".hermes-desktop").join("background-tasks")
}

fn make_task_id() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    format!("bg-{now}")
}

fn read_tail(path: &str, max_lines: usize) -> String {
    let Ok(file) = File::open(path) else {
        return String::new();
    };
    let reader = BufReader::new(file);
    let lines: Vec<String> = reader
        .lines()
        .filter_map(|l| l.ok())
        .map(|l| crate::stream::strip_ansi(&l))
        .filter(|l| !l.trim().is_empty() && !crate::stream::is_decorative(l.trim()))
        .collect();
    let start = lines.len().saturating_sub(max_lines);
    lines[start..].join("\n")
}

fn parse_session_id(text: &str) -> Option<String> {
    for line in text.lines() {
        if line.contains("Resume this session with:") {
            let mut parts = line.split_whitespace();
            while let Some(p) = parts.next() {
                if p == "--resume" || p == "-r" {
                    return parts.next().map(|s| s.trim().to_string());
                }
            }
        }
    }
    None
}

#[cfg(unix)]
fn kill_pid(pid: u32) {
    let _ = Command::new("kill").arg(pid.to_string()).status();
}

#[cfg(windows)]
fn kill_pid(pid: u32) {
    let _ = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/F"])
        .status();
}

#[tauri::command]
pub async fn bg_start(
    app_state: State<'_, AppState>,
    prompt: String,
) -> Result<String, String> {
    let prompt = prompt.trim().to_string();
    if prompt.is_empty() {
        return Err("Prompt is empty".into());
    }

    let task_id = make_task_id();
    let dir = output_dir();
    std::fs::create_dir_all(&dir).map_err(|e| format!("Cannot create log dir: {e}"))?;
    let log_path = dir.join(format!("{task_id}.log"));
    let stdout_file = File::create(&log_path).map_err(|e| format!("Cannot create log file: {e}"))?;
    let stderr_file = stdout_file.try_clone().map_err(|e| e.to_string())?;

    let child = Command::new(super::sessions::hermes_binary())
        .args(["chat", "-q", &prompt, "--source", "tool"])
        .env("PYTHONUNBUFFERED", "1")
        .stdout(Stdio::from(stdout_file))
        .stderr(Stdio::from(stderr_file))
        .spawn()
        .map_err(|e| format!("Failed to start hermes: {e}. Is hermes installed and in PATH?"))?;

    let pid = child.id();
    let started_at = chrono::Local::now().to_rfc3339();
    let task = BackgroundTask {
        id: task_id.clone(),
        prompt: prompt.clone(),
        started_at,
        finished_at: None,
        status: "running".into(),
        pid: Some(pid),
        exit_code: None,
        output_path: log_path.to_string_lossy().to_string(),
        session_id: None,
    };

    {
        let mut map = app_state.background_tasks.lock().unwrap();
        map.insert(task_id.clone(), task);
    }

    let map_clone = app_state.background_tasks.clone();
    let task_id_clone = task_id.clone();
    let log_path_clone = log_path.clone();
    std::thread::spawn(move || {
        let mut child = child;
        let exit_status = child.wait();
        let now = chrono::Local::now().to_rfc3339();
        let session_id = std::fs::read_to_string(&log_path_clone)
            .ok()
            .and_then(|t| parse_session_id(&t));
        let mut map = map_clone.lock().unwrap();
        if let Some(t) = map.get_mut(&task_id_clone) {
            t.finished_at = Some(now);
            match exit_status {
                Ok(es) => {
                    t.exit_code = es.code();
                    t.status = if es.success() {
                        "done".into()
                    } else {
                        "failed".into()
                    };
                }
                Err(_) => t.status = "failed".into(),
            }
            if t.session_id.is_none() {
                t.session_id = session_id;
            }
        }
    });

    Ok(task_id)
}

#[tauri::command]
pub async fn bg_list(
    app_state: State<'_, AppState>,
) -> Result<Vec<BackgroundTaskSummary>, String> {
    let map = app_state.background_tasks.lock().unwrap();
    let mut tasks: Vec<BackgroundTaskSummary> = map
        .values()
        .map(|t| BackgroundTaskSummary {
            id: t.id.clone(),
            prompt: t.prompt.clone(),
            started_at: t.started_at.clone(),
            finished_at: t.finished_at.clone(),
            status: t.status.clone(),
            pid: t.pid,
            exit_code: t.exit_code,
            session_id: t.session_id.clone(),
            tail: read_tail(&t.output_path, 5),
        })
        .collect();
    tasks.sort_by(|a, b| b.started_at.cmp(&a.started_at));
    Ok(tasks)
}

#[tauri::command]
pub async fn bg_get_output(
    app_state: State<'_, AppState>,
    task_id: String,
) -> Result<String, String> {
    let path = {
        let map = app_state.background_tasks.lock().unwrap();
        let t = map.get(&task_id).ok_or("Task not found")?;
        t.output_path.clone()
    };
    let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let cleaned: String = raw
        .lines()
        .map(|l| crate::stream::strip_ansi(l))
        .collect::<Vec<_>>()
        .join("\n");
    Ok(cleaned)
}

#[tauri::command]
pub async fn bg_stop(
    app_state: State<'_, AppState>,
    task_id: String,
) -> Result<(), String> {
    let pid = {
        let map = app_state.background_tasks.lock().unwrap();
        let t = map.get(&task_id).ok_or("Task not found")?;
        if t.status != "running" {
            return Ok(());
        }
        t.pid
    };
    if let Some(pid) = pid {
        kill_pid(pid);
    }
    Ok(())
}

#[tauri::command]
pub async fn bg_stop_all(app_state: State<'_, AppState>) -> Result<u32, String> {
    let pids: Vec<u32> = {
        let map = app_state.background_tasks.lock().unwrap();
        map.values()
            .filter(|t| t.status == "running")
            .filter_map(|t| t.pid)
            .collect()
    };
    let count = pids.len() as u32;
    for pid in pids {
        kill_pid(pid);
    }
    Ok(count)
}

#[tauri::command]
pub async fn bg_clear_finished(app_state: State<'_, AppState>) -> Result<u32, String> {
    let mut map = app_state.background_tasks.lock().unwrap();
    let before = map.len();
    map.retain(|_, t| t.status == "running");
    Ok((before - map.len()) as u32)
}

#[tauri::command]
pub async fn bg_running_count(app_state: State<'_, AppState>) -> Result<u32, String> {
    let map = app_state.background_tasks.lock().unwrap();
    Ok(map.values().filter(|t| t.status == "running").count() as u32)
}
