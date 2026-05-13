# 产品 Backlog

> 需求池、产品方向、已知约束 — 集中在这一个文件。
> Sprint 规划时从"待评估"区取材；发现约束立即追加到"已知约束"区。

---

## 产品方向

> 所有决策的北极星。与此冲突的功能不做。

**为谁**：对计算机终端操作不熟悉的普通用户（macOS 优先）

**解决什么**：无法使用命令行工具操作 Hermes Agent 的问题

**一句话定位**：macOS 上最轻、最优雅的 Hermes Agent 桌面伴侣。不跟 fathah/hermes-desktop 比功能多，只比在 Mac 上用着舒服。

**差异化路线**：
- Tauri 原生轻量（< 20MB、启动瞬时）vs Electron 笨重
- 设计优先 — 三个主题系统（Claude Noir / Apple / Warp）
- PTY 内嵌终端 — fathah 没有的功能，是我们的一级交互
- macOS 原生感 — 菜单栏集成、全局快捷键、原生通知、毛玻璃效果

**竞争策略**：把长板打到极致，不追对方的短板。用户选择我们的理由不是"功能多"，而是"在 Mac 上用着舒服"。

**成功标准**：用户不需要说明书就知道如何使用；操作流畅，符合苹果式直觉交互体验；每次打开都觉得"这是个真正的 Mac 应用"。

**明确不做**：
- 华而不实的功能 — 每个功能必须切实解决用户问题，不为展示技术复杂性而做
- 管理类功能（Kanban/Cron/Config/Skills/Profiles/MCP/API Keys/消息网关）— 全部委托 hermes dashboard iframe
- 跟 fathah 拼功能广度 — 不做 16 个消息网关、不做 profile 切换、不做 i18n 框架

---

## 待评估需求

> 格式：`- [日期] [来源] 描述`
> 来源：自己 / 用户反馈 / 竞品观察 / 技术债 / [VERIFY] / [RETRO]

<!-- 新需求追加到这里 -->

---

## 已规划 / 已否决 / 变更

> 已进入 Sprint 的需求注明 Sprint；取消/调整的功能也记在这里。

- [2026-05-12] Sprint-1（Phase 0）— Dashboard 集成、Memory 编辑器、状态栏完善、上下文压缩触发器
- [2026-05-12] 暂缓 — /steer 图形化，需 PTY 双向通道架构改造，成本过高

---

## 已知约束与坑

> 发现新约束立即追加。不要删历史。

### 架构约束

- **一次性进程模型**：每条消息触发独立进程 `hermes chat -q <msg> --resume <id>`，进程退出后连接断开。这决定了斜杠命令的实现分类（A/B/C 类），详见设计文档 §3.1
- **C 类命令暂缓**：`/steer` 需要持久 PTY stdin 注入，当前架构不可行，不做
- **Dashboard 委托**：Kanban / Cron / Config / Skills / Profiles / MCP / API Keys 等管理功能全部委托给 `hermes dashboard` iframe，不自建

### 已知坑

- 项目刚起步，暂无已知坑

### Session 中新发现

（格式：`[YYYY-MM-DD] 描述 — 原因`）

- [2026-05-13] `hermes chat -q <slash>` 不会经过交互式 CLI 的 slash command handler，`/undo`、`/title` 等会被当作普通消息发给模型 — 一次性进程模式绕过了交互式 CLI 前端循环
