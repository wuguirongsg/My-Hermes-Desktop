/// Strip ANSI escape codes and carriage-return rewrites from a raw terminal line.
pub fn strip_ansi(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = String::new();
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            0x1b => {
                i += 1;
                if i >= bytes.len() {
                    break;
                }
                match bytes[i] {
                    b'[' => {
                        i += 1;
                        while i < bytes.len() && !bytes[i].is_ascii_alphabetic() {
                            i += 1;
                        }
                        if i < bytes.len() {
                            i += 1;
                        }
                    }
                    b']' => {
                        // OSC sequence: ESC ] ... BEL(\x07) or ESC\
                        i += 1;
                        while i < bytes.len() {
                            if bytes[i] == 0x07 {
                                i += 1;
                                break;
                            }
                            if bytes[i] == 0x1b {
                                if i + 1 < bytes.len() && bytes[i + 1] == b'\\' {
                                    i += 2;
                                } else {
                                    i += 1;
                                }
                                break;
                            }
                            i += 1;
                        }
                    }
                    _ => {
                        i += 1;
                    }
                }
            }
            b'\r' => {
                // CR = cursor to start of line — discard everything on this line
                out.clear();
                i += 1;
            }
            _ => {
                let start = i;
                while i < bytes.len() && bytes[i] != 0x1b && bytes[i] != b'\r' {
                    i += 1;
                }
                if let Ok(chunk) = std::str::from_utf8(&bytes[start..i]) {
                    out.push_str(chunk);
                }
            }
        }
    }
    out
}

/// Returns true for decorative/metadata lines that should never reach the UI.
pub fn is_decorative(trimmed: &str) -> bool {
    if trimmed.is_empty() {
        return false;
    }

    if trimmed.starts_with('╭') || trimmed.starts_with('╰') {
        return true;
    }
    if trimmed.starts_with('┊') {
        return true;
    }

    // Box-drawing lines (─ ═ ━ │) but NOT plain ASCII dashes.
    // "---" is a valid markdown <hr> and must pass through.
    if trimmed.len() > 4
        && trimmed
            .chars()
            .all(|c| matches!(c, '─' | '═' | '━' | '│' | ' '))
    {
        return true;
    }
    // Very long dash runs (20+) are decorative separators, not markdown hr
    if trimmed.len() >= 20 && trimmed.chars().all(|c| c == '-') {
        return true;
    }

    for prefix in &[
        "Query:",
        "Initializing ",
        "↻ ",
        "Resume this session with:",
        "Session: ",
        "Duration: ",
        "Messages: ",
        "Goodbye!",
        "Welcome to Hermes",
        "Tip:",
        "Warning:",
        // hermes -v verbose init lines (stdout, not stderr)
        "🤖 AI Agent initialized",
        "🔗 Using custom base URL",
        "🔑 Using API key",
        "✅ Enabled toolset",
        "✅ Enabled toolsets",
        "🛠️  Final tool selection",
        "🛠️  Loaded ",
        "⚠️  Some tools may not work",
        "📊 Context limit",
        "💬 Starting conversation",
        "🎉 Conversation completed",
        "💬 Resuming conversation",
        "🔁 ",
        // Tool list summary lines
        "🛠️ ",
    ] {
        if trimmed.starts_with(prefix) {
            return true;
        }
    }

    if trimmed.contains("reflecting...") {
        return true;
    }
    if trimmed.contains("msg=interrupt") || trimmed.contains("Ctrl+C cancel") {
        return true;
    }
    if trimmed == "❯" {
        return true;
    }

    // Python logging format: "HH:MM:SS - module - LEVEL - message"
    // Matches DEBUG / INFO / WARNING / ERROR / CRITICAL from hermes internals.
    // We drop DEBUG and INFO; WARNING/ERROR are allowed through so real errors surface.
    if trimmed.contains(" - DEBUG - ") || trimmed.contains(" - INFO - ") {
        return true;
    }
    // Bare "HH:MM:SS - module - ..." lines that don't carry a level keyword
    // (e.g. multi-line continuation or config-dump lines like "provider=... model=...")
    {
        let bytes = trimmed.as_bytes();
        if bytes.len() >= 9
            && bytes[2] == b':'
            && bytes[5] == b':'
            && bytes[..2].iter().all(|&b| b.is_ascii_digit())
            && bytes[3..5].iter().all(|&b| b.is_ascii_digit())
            && bytes[6..8].iter().all(|&b| b.is_ascii_digit())
        {
            return true;
        }
    }
    // Key=value config-dump lines emitted during agent initialisation
    if trimmed.starts_with("provider=") || trimmed.starts_with("base_url=") {
        return true;
    }

    false
}
