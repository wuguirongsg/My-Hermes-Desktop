# 已知约束

- [2026-05-22] 回复终端面板不能依赖 Hermes 第一条 stdout 才出现。`hermes chat -q` 启动后可能在模型首 token、工具准备或网络等待期间长时间 stdout 静默，部分早期日志/错误还可能写到 stderr；桌面端必须先显示本地 running 占位，并消费 stderr 防止用户看到“无响应”。

- [2026-05-13] `hermes chat -q <slash>` 不会经过交互式 CLI 的 slash command handler，`/undo`、`/title` 等会被当作普通消息发给模型；图形化入口应优先走专用 Tauri 命令、Hermes 子命令或直接编辑配置/会话文件。

- [2026-05-17] 跨平台兼容约束（Phase 2 起生效）：
  - Tauri 官方插件优先（tray/global-shortcut/notification 均三平台支持，不用平台特定方案）
  - 窗口级原生效果（macOS vibrancy、Windows acrylic）必须用 `#[cfg(target_os = "...")]` 条件编译隔离，禁止在 Rust 层直接调用平台 API 而不做条件隔离
  - 前端平台判断统一用 `@tauri-apps/plugin-os` 的 `platform()` API，禁止猜 userAgent
  - 文件路径统一用 Rust `dirs` crate（`dirs::config_dir()` 等），禁止 hardcode `~/` 或 `/Users/`
