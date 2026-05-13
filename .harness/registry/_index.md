# 决策索引

> **Agent 使用规则**：
> - Session 开始时：只读最近 5 条，了解近况
> - Session 结束时：在最前面追加新条目（不是末尾）
> - 不要读完整历史，用条目里的文件链接按需查阅

格式：`[日期 时间] [类型] 一句话摘要 → 详情文件`

类型说明：
- `DONE` 完成功能 · `WIP` 进行中 · `BLOCKED` 阻塞
- `DECISION` 架构决策 · `CONSTRAINT` 新发现约束 · `FIX` 修复问题

---

<!-- 新条目追加到这里（上方） -->

[2026-05-13 11:22] DONE feat-102 会话标题编辑 — 侧边栏内联编辑，执行 /title 并持久化桌面端标题映射 → sessions/2026-05-13-1122.md

[2026-05-13 11:00] FIX 模型切换改为直接写 config.yaml，消除对话污染 + 乐观更新 TopBar → commit 2bc6090
[2026-05-13 10:30] FIX 模型选择器改为动态过滤：读 config.yaml + .env，只显示已配置 provider 的模型 → commit da0dd78
[2026-05-13 10:00] DONE feat-101 模型选择器 — TopBar 下拉，预置模型列表+搜索+自定义输入，发 /model 切换 → commit 9d975f1

[2026-05-12 23:30] DECISION 确定方向 A 战略：macOS 原生伴侣，不跟 fathah 拼功能广度。更新产品方向 + 写入 docs/strategy-and-roadmap-v2.md

[2026-05-12 23:00] DONE 会话删除改为两步 inline 确认（删除? ✓ ✕），3s 自动取消，替代不可用的 window.confirm() → commit 62c4f64

[2026-05-12 22:30] FIX 移除 window.confirm()：Tauri WKWebView 不支持该 API，静默返回 false 导致删除从未执行 → commit d0b3f05

[2026-05-12 22:00] FIX delete_session 改为始终删磁盘文件（CLI 只清内部状态不删文件）→ commit c078c39

[2026-05-12 21:00] FIX 修复会话列表重复（.jsonl+.json 去重）、sessions.json 误读、删除按钮失效（补 --yes）→ commit 993fb35

[2026-05-12 20:00] DONE 新增 Warp 设计风格第三套皮肤（暖深色画布 + off-white + Inter/DM Mono），主题循环改为 3 档 → commit 9b3d023

[2026-05-12 18:00] DECISION Phase 1 规划完成，10 个功能（feat-101～110）分 2 Sprint 录入 features.json → current-sprint.md

[2026-05-12 16:04] FIX 重新生成 Hermes Desktop 应用图标

[2026-05-12 10:00] DECISION 项目 harness 初始化完成，Phase 0 四个功能录入 features.json → decisions/init.md
