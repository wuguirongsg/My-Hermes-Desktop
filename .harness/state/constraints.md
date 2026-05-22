# 已知约束

- [2026-05-22] 回复终端面板不能依赖 Hermes 第一条 stdout 才出现。`hermes chat -q` 启动后可能在模型首 token、工具准备或网络等待期间长时间 stdout 静默，部分早期日志/错误还可能写到 stderr；桌面端必须先显示本地 running 占位，并消费 stderr 防止用户看到“无响应”。

- [2026-05-22] Windows GUI 进程启动 console 子进程会弹出默认终端窗口。所有后台 `wsl.exe` / `taskkill` / CLI 探测类 `std::process::Command` 必须通过 `CommandExt::creation_flags(CREATE_NO_WINDOW)` 隐藏；内嵌 PTY 路径不要直接 `CommandBuilder::new("wsl.exe")`，应经 `cmd.exe /D /Q /C wsl.exe ...` 进入已有伪控制台；只有用户明确点击“打开终端”的安装/配置入口可以保留可见 `wt.exe` / `cmd` 窗口。

- [2026-05-22] 工具调用显示开关不得隐藏 live/running/error 容器。`[].every(...) === true`，所以用 `blocks.every(type === "tool")` 判断“纯工具消息”前必须先检查 `blocks.length > 0`；否则空的 streaming assistant 占位会被误隐藏，表现成“终端框延迟出现”。

- [2026-05-13] `hermes chat -q <slash>` 不会经过交互式 CLI 的 slash command handler，`/undo`、`/title` 等会被当作普通消息发给模型；图形化入口应优先走专用 Tauri 命令、Hermes 子命令或直接编辑配置/会话文件。

- [2026-05-17] 跨平台兼容约束（Phase 2 起生效）：
  - Tauri 官方插件优先（tray/global-shortcut/notification 均三平台支持，不用平台特定方案）
  - 窗口级原生效果（macOS vibrancy、Windows acrylic）必须用 `#[cfg(target_os = "...")]` 条件编译隔离，禁止在 Rust 层直接调用平台 API 而不做条件隔离
  - 前端平台判断统一用 `@tauri-apps/plugin-os` 的 `platform()` API，禁止猜 userAgent
  - 文件路径统一用 Rust `dirs` crate（`dirs::config_dir()` 等），禁止 hardcode `~/` 或 `/Users/`
