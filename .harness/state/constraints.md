# 已知约束

- [2026-05-13] `hermes chat -q <slash>` 不会经过交互式 CLI 的 slash command handler，`/undo`、`/title` 等会被当作普通消息发给模型；图形化入口应优先走专用 Tauri 命令、Hermes 子命令或直接编辑配置/会话文件。
