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

- [2026-05-18] [用户反馈] 语音输入输出优化（whisper-rs 方案）
  - 当前 feat-214 使用 Web Speech API（需联网，走 Apple 服务器）+ macOS `say`
  - 优化方向：用 `whisper-rs`（whisper.cpp 的 Rust binding）替换 Web Speech API，实现完全本地离线 STT，tiny 模型 75MB，精度更高，隐私更好
  - 语音输出继续用 `say`（稳定性优先，Edge TTS 是非官方 API 不建议用）
  - 前置条件：先评估 whisper-rs 模型打包方案（sidecar vs bundle），控制应用体积
  - 优先级：Phase 3 候选，feat-214 稳定后评估

- [2026-05-17] [用户反馈] 配置引导：上下文感知卡片 + dashboard 深链接
  - 场景1：App 启动时读 ~/.hermes/config.yaml，检测到 API Key 未配置 → 对话区顶部常驻卡片（可关闭）
  - 场景2：hermes 进程报错时 Rust 层拦截错误类型（api key/model not found/rate limit/mcp tool 等），在对话流中插入对应说明卡片 + 跳转到 dashboard 指定页面的按钮
  - 前置条件：先摸清 hermes dashboard 的实际路由结构（localhost:9119 跑起来后看），确认深链接可行性
  - 不做：完整重建配置 UI，只做"缺啥说哪里补"的引导入口
  - 优先级：Phase 2 候选，先完成 macOS 原生感核心功能后评估

---

## 已规划 / 已否决 / 变更

> 已进入 Sprint 的需求注明 Sprint；取消/调整的功能也记在这里。

- [2026-05-12] Sprint-1（Phase 0）— Dashboard 集成、Memory 编辑器、状态栏完善、上下文压缩触发器
- [2026-05-12] 暂缓 — /steer 图形化，需 PTY 双向通道架构改造，成本过高
- [2026-05-22] 取消 — feat-204 毛玻璃+主题深度打磨，测试效果不满意，成本高于收益，正式砍掉；features.json 条目保留 passes=false 作为历史记录

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

[2026-05-22] 会话列表内浮层会被裁剪 — `.session-list` 有 `overflow-y:auto`，任何 `position:absolute` 的弹层/popover 都会被列表容器裁掉。处理方式：会话项内的编辑类 UI（标签编辑、删除确认）用「内联展开」而非浮层；若确需浮层须用 `position:fixed` + 计算坐标。

[2026-05-15] ACP gateway 方案回滚到 master — 实现后会话/对话出现多处问题。根因：dispatcher 把 notification 流与 response 混在同一 channel，用合成事件 `__prompt_done__` 做哨兵，导致 session/new response 提前触发循环退出；同时 get_session_history 未迁移到 ACP 路径，切历史对话状态错乱。干净的重做方案：notification 流与 response future 分离，不注入合成信号。当前决定搁置 Phase 2 ACP 迁移，继续 one-shot 进程模型。feat-111 /steer 依赖 ACP 长连接，暂时跟随搁置。

- [2026-05-13] `hermes chat -q <slash>` 不会经过交互式 CLI 的 slash command handler，`/undo`、`/title` 等会被当作普通消息发给模型 — 一次性进程模式绕过了交互式 CLI 前端循环
- [2026-05-14] 上述约束派生准则：**前端虚构的 slash 命令（/personality、/goal 等 hermes CLI 不存在的命令）发给模型时行为不稳定** — 模型可能照做也可能回答"没这个命令"。处理方式：feat-107 已改用自然语言提示词；其它 `/goal`、`/snapshot` 等若发现失效，按同样思路（前端状态 + 自然语言指令）改造，不要依赖 slash 字面被模型识别
