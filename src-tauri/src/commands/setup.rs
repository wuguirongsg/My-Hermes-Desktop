use serde::Serialize;
use std::process::Command;

const INSTALL_CMD: &str = "pip install 'hermes-agent[web,pty]'";
const API_KEY_NAMES: &[&str] = &[
    "ANTHROPIC_API_KEY",
    "OPENROUTER_API_KEY",
    "OPENAI_API_KEY",
    "OPENCODE_GO_API_KEY",
    "GEMINI_API_KEY",
    "HERMES_GATEWAY_TOKEN",
];

#[derive(Serialize)]
pub struct HermesSetupStatus {
    pub installed: bool,
    pub version: String,
    pub hermes_home: String,
    pub config_exists: bool,
    pub api_key_configured: bool,
    pub configured_providers: Vec<String>,
    pub error: String,
}

fn configured_providers_from_env(env: &str) -> Vec<String> {
    let key_map = [
        ("ANTHROPIC_API_KEY", "Anthropic"),
        ("OPENROUTER_API_KEY", "OpenRouter"),
        ("OPENAI_API_KEY", "OpenAI"),
        ("OPENCODE_GO_API_KEY", "OpenCode Go"),
        ("GEMINI_API_KEY", "Gemini"),
        ("HERMES_GATEWAY_TOKEN", "Hermes Gateway"),
    ];
    let mut providers = Vec::new();

    for line in env.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        for (key, provider) in key_map {
            if let Some(value) = trimmed.strip_prefix(&format!("{key}=")) {
                if !value.trim().trim_matches('"').trim_matches('\'').is_empty()
                    && !providers.iter().any(|p| p == provider)
                {
                    providers.push(provider.to_string());
                }
            }
        }
    }

    providers
}

fn hermes_version() -> Result<String, String> {
    let output = Command::new("hermes")
        .arg("version")
        .output()
        .map_err(|e| format!("Hermes CLI 未安装或不在 PATH 中：{e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let message = if stderr.is_empty() { stdout } else { stderr };
        return Err(if message.is_empty() {
            "Hermes CLI 无法正常运行".to_string()
        } else {
            message
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Ok(if stdout.is_empty() { stderr } else { stdout })
}

#[tauri::command]
pub async fn check_hermes_setup() -> Result<HermesSetupStatus, String> {
    let home = crate::commands::sessions::hermes_home();
    let hermes_home = home
        .as_ref()
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_default();

    let config_exists = home
        .as_ref()
        .map(|path| path.join("config.yaml").exists())
        .unwrap_or(false);

    let env_text = home
        .as_ref()
        .and_then(|path| std::fs::read_to_string(path.join(".env")).ok())
        .unwrap_or_default();
    let configured_providers = configured_providers_from_env(&env_text);
    let api_key_configured = !configured_providers.is_empty()
        || API_KEY_NAMES.iter().any(|key| std::env::var(key).map(|v| !v.trim().is_empty()).unwrap_or(false));

    match hermes_version() {
        Ok(version) => Ok(HermesSetupStatus {
            installed: true,
            version,
            hermes_home,
            config_exists,
            api_key_configured,
            configured_providers,
            error: String::new(),
        }),
        Err(error) => Ok(HermesSetupStatus {
            installed: false,
            version: String::new(),
            hermes_home,
            config_exists,
            api_key_configured,
            configured_providers,
            error,
        }),
    }
}

#[tauri::command]
pub async fn open_install_terminal() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let escaped = INSTALL_CMD.replace('\\', "\\\\").replace('"', "\\\"");
        let script = format!(
            "tell application \"Terminal\"\nactivate\ndo script \"{}\"\nend tell",
            escaped
        );
        let output = Command::new("osascript")
            .arg("-e")
            .arg(script)
            .output()
            .map_err(|e| format!("无法打开终端：{e}"))?;

        if output.status.success() {
            return Ok(());
        }

        let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if message.is_empty() {
            "无法打开终端".to_string()
        } else {
            message
        });
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("当前平台暂不支持自动打开终端，请复制安装命令手动执行。".to_string())
    }
}
