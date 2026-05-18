use crate::StreamChunk;
use crate::stream::{is_decorative, strip_ansi};
use base64::Engine;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

fn decode_image_data_url(data_url: &str) -> Result<(Vec<u8>, &'static str), String> {
    let body = data_url.strip_prefix("data:").ok_or("image is not a data URL")?;
    let (header, payload) = body.split_once(',').ok_or("image data URL missing comma")?;
    let (mime, encoding) = header.split_once(';').unwrap_or((header, ""));
    if !encoding.eq_ignore_ascii_case("base64") {
        return Err("image data URL must be base64-encoded".into());
    }
    let ext = match mime.to_ascii_lowercase().as_str() {
        "image/png"  => "png",
        "image/jpeg" => "jpg",
        "image/jpg"  => "jpg",
        "image/gif"  => "gif",
        "image/webp" => "webp",
        "image/bmp"  => "bmp",
        other => return Err(format!("unsupported image mime: {other}")),
    };
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(payload.trim())
        .map_err(|e| format!("base64 decode failed: {e}"))?;
    Ok((bytes, ext))
}

// Persistent storage for attached images so that reloading a session can still
// recover them. macOS: ~/Library/Caches/hermes-desktop/images/
pub fn image_store_dir() -> Option<PathBuf> {
    let mut dir = dirs::cache_dir()?;
    dir.push("hermes-desktop");
    dir.push("images");
    Some(dir)
}

fn write_image_persistent(data_url: &str) -> Result<PathBuf, String> {
    let (bytes, ext) = decode_image_data_url(data_url)?;
    let dir = image_store_dir().ok_or("cannot locate cache dir")?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("cannot create image dir: {e}"))?;
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let path = dir.join(format!("img-{nanos}-{:x}.{ext}", std::process::id()));
    let mut f = std::fs::File::create(&path).map_err(|e| format!("cannot create image file: {e}"))?;
    f.write_all(&bytes).map_err(|e| format!("cannot write image file: {e}"))?;
    Ok(path)
}

fn emit(app: &AppHandle, session_id: &str, kind: &str, content: &str) {
    app.emit("hermes:chunk", StreamChunk {
        kind: kind.to_string(),
        content: content.to_string(),
        session_id: session_id.to_string(),
    })
    .ok();
}

fn extract_resume_session_id(line: &str) -> Option<String> {
    let mut parts = line.split_whitespace();
    while let Some(part) = parts.next() {
        if part == "--resume" || part == "-r" {
            return parts.next().map(|value| value.trim().to_string()).filter(|value| !value.is_empty());
        }
    }
    None
}

#[tauri::command]
pub async fn send_message(
    app: AppHandle,
    session_id: Option<String>,
    message: String,
    session_tag: String,
    image: Option<String>,
    working_dir: Option<String>,
) -> Result<(), String> {
    // No -Q: non-quiet mode streams output token-by-token as the model generates.
    // PYTHONUNBUFFERED=1 ensures Python flushes stdout on each write.
    let mut args: Vec<String> = vec!["chat".into(), "-q".into(), message.clone()];
    if let Some(ref id) = session_id {
        args.push("--resume".into());
        args.push(id.clone());
    }

    // Image attachment: decode data URL into a persistent cache file and pass via --image.
    // Kept on disk so reloading the session later can still surface the image
    // from the [Image attached at: <path>] marker hermes writes into the transcript.
    if let Some(ref data_url) = image {
        let path = write_image_persistent(data_url)?;
        args.push("--image".into());
        args.push(path.to_string_lossy().to_string());
    }

    // Use pipe (not PTY) so hermes detects non-TTY stdout and runs in line-buffered
    // non-interactive mode. PTY would put hermes into TUI mode where it uses ANSI
    // redraws + \r in place of \n, which BufReader::lines() cannot consume.
    let mut cmd = Command::new(super::sessions::hermes_binary());
    cmd.args(&args)
        .env("PYTHONUNBUFFERED", "1")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(ref dir) = working_dir {
        let path = std::path::Path::new(dir);
        if path.is_dir() {
            cmd.current_dir(path);
        }
    }
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start hermes: {e}. Is hermes installed and in PATH?"))?;

    let stdout = child.stdout.take().ok_or("No stdout")?;
    let reader = BufReader::new(stdout);
    let mut in_think = false;
    let mut in_footer = false;
    let mut in_diff = false;
    let mut discovered_session_id: Option<String> = None;

    for line_result in reader.lines() {
        let raw = line_result.map_err(|e| e.to_string())?;
        let clean = strip_ansi(&raw);
        let trimmed = clean.trim();

        emit(&app, &session_tag, "raw", &clean);

        // ── Footer (session info after response) ──────────────────────────────
        if trimmed.starts_with("Resume this session with:") {
            discovered_session_id = extract_resume_session_id(trimmed);
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

    let output = child.wait().map_err(|e| e.to_string())?;
    if !output.success() {
        emit(&app, &session_tag, "error", &format!("Hermes exited with status: {output}"));
    }

    let mut done_session_tag = session_tag.clone();
    if session_id.is_none() {
        if let Some(real_id) = discovered_session_id {
            emit(&app, &session_tag, "new_session_id", &real_id);
            done_session_tag = real_id;
        } else if let Ok(sessions) = super::sessions::list_sessions().await {
            if let Some(first) = sessions.first() {
                emit(&app, &session_tag, "new_session_id", &first.id);
                done_session_tag = first.id.clone();
            }
        }
    }

    emit(&app, &done_session_tag, "done", "");
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

    // Also detect OAuth-authenticated providers from auth.json credential_pool
    let auth_text = std::fs::read_to_string(home.join("auth.json")).unwrap_or_default();
    if let Ok(auth) = serde_json::from_str::<serde_json::Value>(&auth_text) {
        if let Some(pool) = auth["credential_pool"].as_object() {
            for (prov, creds) in pool {
                if let Some(arr) = creds.as_array() {
                    if !arr.is_empty() && !configured.contains(prov) {
                        configured.push(prov.clone());
                    }
                }
            }
        }
    }

    // Always include the active provider even if its key isn't in .env
    if !current_provider.is_empty() && !configured.contains(&current_provider) {
        configured.insert(0, current_provider.clone());
    }

    // Hardcoded model fallbacks for providers not covered by models_dev_cache.json
    const PROVIDER_MODEL_FALLBACKS: &[(&str, &[&str])] = &[
        ("openai-codex", &["gpt-5.5", "gpt-5.4-mini", "gpt-5.4", "gpt-5.3-codex", "gpt-5.2-codex", "gpt-5.1-codex-max", "gpt-5.1-codex-mini"]),
        ("nous", &["hermes-3-llama-3.1-405b", "hermes-3-llama-3.1-70b"]),
    ];

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
                continue;
            }
        }
        // Provider not in cache — use hardcoded fallback if available
        for (fb_prov, fb_models) in PROVIDER_MODEL_FALLBACKS {
            if prov == fb_prov {
                model_groups.push(serde_json::json!({
                    "provider": prov,
                    "models": fb_models,
                }));
                break;
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
    let version_out = Command::new(super::sessions::hermes_binary())
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
