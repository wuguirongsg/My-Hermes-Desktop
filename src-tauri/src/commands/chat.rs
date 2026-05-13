use crate::StreamChunk;
use crate::stream::{is_decorative, strip_ansi};
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter};

fn emit(app: &AppHandle, session_id: &str, kind: &str, content: &str) {
    app.emit("hermes:chunk", StreamChunk {
        kind: kind.to_string(),
        content: content.to_string(),
        session_id: session_id.to_string(),
    })
    .ok();
}

#[tauri::command]
pub async fn send_message(
    app: AppHandle,
    session_id: Option<String>,
    message: String,
    session_tag: String,
) -> Result<(), String> {
    // No -Q: non-quiet mode streams output token-by-token as the model generates.
    // PYTHONUNBUFFERED=1 ensures Python flushes stdout on each write.
    let mut args: Vec<String> = vec!["chat".into(), "-q".into(), message.clone()];
    if let Some(ref id) = session_id {
        args.push("--resume".into());
        args.push(id.clone());
    }

    let mut child = Command::new("hermes")
        .args(&args)
        .env("PYTHONUNBUFFERED", "1")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start hermes: {e}. Is hermes installed and in PATH?"))?;

    let stdout = child.stdout.take().ok_or("No stdout")?;
    let reader = BufReader::new(stdout);
    let mut in_think = false;
    let mut in_footer = false;
    let mut in_diff = false;
    let mut in_query_echo = false;

    for line_result in reader.lines() {
        let raw = line_result.map_err(|e| e.to_string())?;
        let clean = strip_ansi(&raw);
        let trimmed = clean.trim();

        emit(&app, &session_tag, "raw", &clean);

        // Hermes prints the submitted query before the actual response. That is
        // useful in raw logs, but it should not be rendered as assistant text.
        if trimmed.starts_with("Query:") {
            in_query_echo = true;
            continue;
        }
        if in_query_echo {
            if trimmed.starts_with("Initializing ")
                || trimmed.starts_with('\u{2183}')
                || trimmed.starts_with('\u{21BB}')
            {
                in_query_echo = false;
            } else {
                continue;
            }
        }

        // ── Footer (session info after response) ──────────────────────────────
        if trimmed.starts_with("Resume this session with:") {
            in_footer = true;
        }
        if in_footer {
            if trimmed.starts_with("Duration:") || trimmed.starts_with("Messages:") {
                emit(&app, &session_tag, "session_stat", trimmed);
            }
            continue;
        }

        // ── Status bar (context window indicator) ─────────────────────────────
        if (trimmed.contains('│') || trimmed.contains('|'))
            && (trimmed.contains("K/") || trimmed.contains("M/"))
        {
            emit(&app, &session_tag, "status", trimmed);
            continue;
        }

        // ── Think block ───────────────────────────────────────────────────────
        if trimmed == "<think>" || trimmed.to_lowercase() == "[thinking]" || trimmed == "《思考》" {
            in_think = true;
            emit(&app, &session_tag, "think_start", "");
            continue;
        }
        if trimmed == "</think>" || trimmed.to_lowercase() == "[/thinking]" || trimmed == "《/思考》" {
            in_think = false;
            emit(&app, &session_tag, "think_end", "");
            continue;
        }
        if in_think {
            if !trimmed.is_empty() {
                emit(&app, &session_tag, "think", trimmed);
            }
            continue;
        }

        // ── Decorative / metadata lines ───────────────────────────────────────
        if is_decorative(trimmed) {
            continue;
        }
        // Session resume headers (Ↄ U+2183 or ↻ U+21BB)
        let first_char = trimmed.chars().next().unwrap_or(' ');
        if first_char == '\u{2183}' || first_char == '\u{21BB}' {
            continue;
        }
        // Tool call summary lines: "| tool_name ... → result"
        if trimmed.starts_with("| ") && trimmed.contains(" \u{2192} ") {
            continue;
        }

        // ── Git-diff tool output ──────────────────────────────────────────────
        if trimmed.starts_with("@@") && trimmed.contains("@@") {
            in_diff = true;
            continue;
        }
        if in_diff {
            if trimmed.starts_with('+') || trimmed.starts_with('-') || trimmed.starts_with(' ') {
                continue;
            }
            in_diff = false;
        }

        // Emit trimmed content so that the 4-space terminal box indent is removed.
        // This lets markdown list items ("- foo"), headings ("# h"), and fences
        // ("```") reach the renderer with correct syntax.
        // Empty lines become "" → JS side produces the \n\n paragraph separator.
        emit(&app, &session_tag, "text", trimmed);
    }

    let output = child.wait_with_output().map_err(|e| e.to_string())?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if !stderr.trim().is_empty() {
            emit(&app, &session_tag, "error", &stderr);
        }
    }

    if session_id.is_none() {
        if let Ok(sessions) = super::sessions::list_sessions().await {
            if let Some(first) = sessions.first() {
                emit(&app, &session_tag, "new_session_id", &first.id);
            }
        }
    }

    emit(&app, &session_tag, "done", "");
    Ok(())
}

// ─── set_hermes_model: directly edit config.yaml ────────────────────────────

fn normalize_model_id(provider: &str, model: &str) -> String {
    let prefix = format!("{provider}:");
    model.strip_prefix(&prefix).unwrap_or(model).to_string()
}

fn rewrite_model_section(yaml: &str, new_provider: &str, new_model: &str) -> String {
    let mut lines: Vec<String> = Vec::new();
    let mut in_model = false;

    for line in yaml.lines() {
        if line == "model:" {
            in_model = true;
            lines.push(line.to_string());
            continue;
        }
        if in_model {
            if !line.starts_with(' ') && !line.is_empty() {
                in_model = false;
            } else {
                let t = line.trim();
                if t.starts_with("provider:") {
                    lines.push(format!("  provider: {}", new_provider));
                    continue;
                } else if t.starts_with("default:") {
                    lines.push(format!("  default: {}", new_model));
                    continue;
                }
            }
        }
        lines.push(line.to_string());
    }
    lines.join("\n")
}

#[tauri::command]
pub async fn set_hermes_model(provider: String, model: String) -> Result<(), String> {
    let home = crate::commands::sessions::hermes_home()
        .ok_or_else(|| "Cannot locate hermes home".to_string())?;
    let path = home.join("config.yaml");
    let text = std::fs::read_to_string(&path)
        .map_err(|e| format!("Cannot read config.yaml: {e}"))?;
    let model = normalize_model_id(&provider, &model);
    let updated = rewrite_model_section(&text, &provider, &model);
    std::fs::write(&path, updated)
        .map_err(|e| format!("Cannot write config.yaml: {e}"))
}

// ─── Helpers for get_hermes_model_config ─────────────────────────────────────

fn parse_model_section(yaml: &str) -> (String, String) {
    let mut provider = String::new();
    let mut default_model = String::new();
    let mut in_model = false;

    for line in yaml.lines() {
        if line == "model:" {
            in_model = true;
            continue;
        }
        if in_model {
            // A non-indented, non-empty line means we've left the model section
            if !line.starts_with(' ') && !line.is_empty() {
                break;
            }
            let t = line.trim();
            if let Some(v) = t.strip_prefix("provider:") {
                provider = v.trim().trim_matches('\'').trim_matches('"').to_string();
            } else if let Some(v) = t.strip_prefix("default:") {
                default_model = v.trim().trim_matches('\'').trim_matches('"').to_string();
            }
        }
    }
    (provider, default_model)
}

fn configured_providers_from_env(env: &str) -> Vec<String> {
    const KEY_MAP: &[(&str, &str)] = &[
        ("ANTHROPIC_API_KEY", "anthropic"),
        ("OPENROUTER_API_KEY", "openrouter"),
        ("OPENAI_API_KEY", "openai"),
        ("OPENCODE_GO_API_KEY", "opencode-go"),
        ("GEMINI_API_KEY", "gemini"),
        ("HERMES_GATEWAY_TOKEN", "nous"),
    ];
    let mut providers = Vec::new();
    for line in env.lines() {
        let t = line.trim();
        if t.starts_with('#') || t.is_empty() { continue; }
        for (key, prov) in KEY_MAP {
            if let Some(val) = t.strip_prefix(&format!("{}=", key)) {
                let v = val.trim();
                if !v.is_empty() && !providers.iter().any(|p: &String| p == prov) {
                    providers.push(prov.to_string());
                }
            }
        }
    }
    providers
}

#[tauri::command]
pub async fn get_hermes_model_config() -> Result<serde_json::Value, String> {
    let home = crate::commands::sessions::hermes_home()
        .ok_or_else(|| "Cannot locate hermes home".to_string())?;

    let config_text = std::fs::read_to_string(home.join("config.yaml")).unwrap_or_default();
    let env_text    = std::fs::read_to_string(home.join(".env")).unwrap_or_default();

    let (current_provider, current_model) = parse_model_section(&config_text);
    let mut configured = configured_providers_from_env(&env_text);

    // Always include the active provider even if its key isn't in .env
    if !current_provider.is_empty() && !configured.contains(&current_provider) {
        configured.insert(0, current_provider.clone());
    }

    // Read models_dev_cache.json and extract model IDs per configured provider
    let cache_text = std::fs::read_to_string(home.join("models_dev_cache.json")).unwrap_or_default();
    let cache: serde_json::Value = serde_json::from_str(&cache_text).unwrap_or(serde_json::Value::Null);

    let mut model_groups: Vec<serde_json::Value> = Vec::new();
    for prov in &configured {
        if let Some(entry) = cache.get(prov) {
            if let Some(models_map) = entry.get("models").and_then(|m| m.as_object()) {
                let mut ids: Vec<String> = models_map.keys().cloned().collect();
                ids.sort();
                model_groups.push(serde_json::json!({
                    "provider": prov,
                    "models": ids,
                }));
            }
        }
    }

    Ok(serde_json::json!({
        "current_provider":     current_provider,
        "current_model":        current_model,
        "configured_providers": configured,
        "model_groups":         model_groups,
    }))
}

#[tauri::command]
pub async fn get_hermes_info() -> Result<serde_json::Value, String> {
    let version_out = Command::new("hermes")
        .args(["version"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|_| "unknown".into());

    Ok(serde_json::json!({
        "version": version_out,
        "hermes_home": crate::commands::sessions::hermes_home()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default(),
    }))
}
