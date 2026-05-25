# 决策索引

> **Agent 使用规则**：
> - Session 开始时：只读最近 5 条，了解近况
> - Session 结束时：在最前面追加新条目（不是末尾）

[2026-05-25 15:57] FIX README 增加界面预览截图区，引用 screenshot 下 4 张应用截图

[2026-05-25 FIX] 文件预览区 Windows 下无法选文本 — body 全局 user-select:none，WebView2 严格执行致选区始终 collapsed；FileTreePanel previewRef 加 userSelect:"text" 覆盖修复

[2026-05-22 DECISION] feat-204 毛玻璃+主题深度打磨正式取消 — 测试效果不满意，成本高于收益；backlog.md 已记录；features.json 条目保留 passes=false

[2026-05-22 DONE] feat-207 斜杠命令菜单 passes=true — SlashCommandMenu.tsx 已实现完整：15 条命令/5 分组/键盘导航/实时过滤/directSend，代码审查确认满足全部验收标准

[2026-05-22 DECISION] feat-208 分支会话暂不做 — 仅有 /branch 菜单入口，无 Sidebar 分支关系 UI 和专属处理逻辑；实现成本较高，待后续规划

[2026-05-22 POSTMORTEM] 回复终端延迟显示复盘 — 根因是 showTools 关闭时 `blocks.every(tool)` 误把空 streaming 占位当纯工具消息隐藏；沉淀排查顺序与代码规则 → docs/design/2026-05-22-terminal-visibility-postmortem.md

[2026-05-22 FIX] 粘性滚动替换 smooth scroll 解决终端框慢出现 + 消息操作常驻低透明 + contextPct 接通 GuideBot

[2026-05-22 FIX] Grounding 气泡改磨砂半透明背景（backdrop-filter blur），解决透明导致内容重叠视觉问题

[2026-05-22 FIX] GoalBar 无目标时隐藏 + TopBar 目标按钮 + Grounding 气泡改 portal 修层级

[2026-05-22 BUILD] DONE feat-211/212/213 — 隐式上下文 info 条 + 后台步骤时间线 + Grounding 气泡，9 文件已提交

[2026-05-22 11:25] FIX git commit 完成 — 侧边栏改造 + 快捷键修复共 9 文件已提交

[2026-05-22 11:18] FIX 侧边栏标签弹层空标签也保留 X(取消)按钮；修复 ⌘C/V/A/Z/Z 失效 — 自定义 set_menu 替换默认菜单后「编辑」子菜单漏了标准编辑项，补 undo/redo/cut/copy/paste/select_all 预定义项（lib.rs setup_app_menu）

[2026-05-22 11:02] DONE 会话侧边栏改造 6 项 — 刷新按钮 / 标题15字+副标题(末条user消息) / 加宽280px / 颜色标签(≤5字+9色板,localStorage)+顶栏筛选下拉 / 日期≤3天相对>3天M/D / 24h-3天-更早分组；后端 Session 加 last_message；标签编辑用内联展开避免 overflow 裁剪 → sessions/2026-05-22-1102.md

[2026-05-20 19:25] FIX 工具显隐三项调整 — 默认改为关闭；纯工具消息整条隐藏（every tool block → return null）；按钮从大文字改为版本号右侧小图标（app-titlebar-icon-btn 样式）

[2026-05-20 19:10] FIX 工具调用显隐快捷开关 — TopBar 新增「工具」按钮（激活高亮）；showTools state 持久化 localStorage；透传 ChatView→MessageBubble，tool block 条件渲染；默认显示

[2026-05-20 18:50] FIX parseHistoryMessages 补全工具调用 — 之前 role:tool 全部丢弃；现在 assistant.tool_calls 生成 ToolCallBlock，role:tool 按 tool_call_id 回填 output；token 估算因此覆盖文件读取等工具结果；历史视图也能展示工具详情

[2026-05-20 18:25] FIX Token 输入/输出分开估算 — user消息+tool结果=输入，assistant+think+tool调用参数=输出；TopBar 显示 ~3.2K / ~1.4K，输出侧淡色，hover tooltip 说明

[2026-05-20 18:10] FIX Token 用量显示 — hermes 不输出 token 数；改为前端 useMemo 从 sessionMessages 内容长度估算（2 chars≈1 token）；有真实数据优先用真实的；>200 token 才显示，格式 ~12.3K；流式过程中实时更新

[2026-05-20 17:50] DECISION Token 用量不显示原因 — tokensUsed 依赖 hermes status chunk 中的 X/Y 格式；deepseek-v4-flash 不输出该格式；duration/msgCount 来自 session_stat chunk 任意模型都有；待用户决策：降级显示 msgCount 或 token 显示 — 兜底

[2026-05-20 17:40] FIX Steps → Token 用量 — 移除 toolCallCount 相关 state/prop/UI；改为读 status.tokensUsed，有数据才显示，无数据不占位

[2026-05-20 17:30] DECISION Steps 计数器评估 — 存 React state 不持久化、页面刷新归零、纯对话不触发；对普通用户无实际意义；待用户决策：删除/改名/替换为更有意义指标

[2026-05-20 17:20] FIX 标题栏中心区文字 — my-hermes-desktop 改为 My Hermes Desktop（正式大小写带空格）

[2026-05-20 17:15] FIX 项目改名 → My Hermes Desktop — 7 处用户可见位置全部替换（tauri.conf.json/index.html/AppTitleBar/OnboardingPage/appMenu/SettingsPage/NOTICE）；package.json 等内部标识符保留不动

[2026-05-20 17:00] DECISION 项目改名评估 — 用户提议改名为"My Hermes Desktop"；分析了 7 处用户可见改动 + 4 处内部标识符；建议考虑去掉"My"前缀，待用户确认后再执行

[2026-05-20 16:45] FIX 开源协议 — 创建 LICENSE（Apache 2.0 全文）+ NOTICE（版权归属声明），法律层面强制衍生作品保留公司名称

[2026-05-20 16:30] FIX 品牌版权归属 — 标题栏右侧加 logo+玄熵智能小字水印，设置页底部加深圳市玄熵智能科技有限责任公司全称；建议 Apache 2.0 + NOTICE 文件方案

[2026-05-20 15:30] BUILD feat-217 技能行"解释"悬停按钮 — hover 出现"解释"按钮，点击向 hermes 发询问技能用途的消息 → sessions/2026-05-20-1530.md

[2026-05-19 16:45] FIX startDragging() 权限缺失 — Tauri 2.x 所有 invoke 需在 capabilities 显式声明；补加 core:window:allow-start-dragging；静默拦截无报错是常见坑

[2026-05-19 16:35] FIX macOS 标题栏拖动改用 JS startDragging() — -webkit-app-region:drag 在 WKWebView+Overlay 组合下不可靠；mousedown 时调 Tauri startDragging() API，closest() 过滤掉 button/input 等交互元素

[2026-05-19 16:25] FIX tauri.conf.json titleBarStyle 枚举值 — Tauri 2.x 要求 PascalCase，"overlay"→"Overlay"

[2026-05-19 16:20] FIX macOS 标题栏无法拖动 — .app-titlebar-left 默认 justify-self:stretch 撑满 1fr 列覆盖拖拽区；加 justify-self:start 使其只占内容宽度，空白区恢复为 drag 区域

[2026-05-19 16:10] FIX macOS 双层标题栏 — tauri.conf.json 加 titleBarStyle:"overlay"+hiddenTitle:true；.app-titlebar-macos 加 padding-left:72px 避开红绿灯；Windows/Linux 不受影响

[2026-05-19 13:00] FIX 毛玻璃半透明暗膜 — glass 模式 xterm 背景改 rgba(13,17,23,0.52)，body 挂蓝紫渐变底色；52% 暗膜叠渐变产生深度感；ocean/sunset/forest 渐变明确挂 body 层

[2026-05-19 12:30] FIX TUI 终端背景透明不生效 — xterm.js 不识别 "transparent"→改 rgba(0,0,0,0)；.xterm-viewport inline style 被 JS 覆盖→CSS !important 强制透明；渐变移至 .terminal-panel-body 紧贴 canvas

[2026-05-19 12:00] DONE TUI 终端背景配置 — 新增 useTerminalBg hook（5 种：dark/glass/ocean/sunset/forest，localStorage 持久化）；xterm.js allowTransparency+动态 theme 更新；Settings 页新增"终端背景"5 张预览卡片；CSS 渐变+毛玻璃变体

[2026-05-19 11:00] DONE feat-202+203 全局快捷键 + 原生通知 — Cmd+Shift+H toggle 窗口；bg_start Instant 计时 ≥30s 推 notification + emit bg-task-done；ChatPage 跳转会话/打开后台面板

[2026-05-19 10:00] DONE feat-201 菜单栏托盘集成 — TrayIconBuilder with_id("hermes-tray")；右键菜单打开/新建/退出；CloseRequested→hide；update_tray_status 命令（三态 tooltip + macOS title 点）；ChatPage 同步 streaming 状态

[2026-05-18 05:00] DONE Agent 停止中断功能 — AppState 新增 chat_processes 字段存 Child；send_message 存/取进程；新增 kill_session Tauri 命令；ChatView 红色"停止"按钮在 streaming 时出现；ChatPage 传 onStop handler

[2026-05-18 04:00] DONE feat-210 文件树侧边栏 — FileTreePanel（文件树+预览双栏）；react-syntax-highlighter 代码高亮；Rust list_dir/read_text_file/get_home_dir；WorkingDirBar ⊟ 触发；与 SnapshotPanel 互斥

[2026-05-18 03:00] FIX TerminalPanel lineHeight 修复 — xterm.js lineHeight 1.3→1.0，消除 ASCII 艺术字行间缝隙，与原生终端渲染一致

[2026-05-18 02:00] PLAN 录入 feat-211～213 — 隐式上下文 info 条 / 后台任务步骤时间线 / Grounding 气泡；Agent 计划确认流因依赖模型行为暂不录入，待评估

[2026-05-18 01:30] DONE feat-209 工作目录切换 — WorkingDirBar 组件：basename 展示 + 原生 Folder Picker + cwd 传入 hermes 进程 + localStorage 持久化；tauri-plugin-dialog 新增

[2026-05-18 01:00] DISCUSS 工作目录管理功能分析 — 建议做：工作目录切换（Folder Picker）+ 只读文件树侧边栏；不做文件编辑器（与 AI 定位冲突）；录入 feat-209、feat-210

[2026-05-18 00:07] DONE 今日一问卡片优化 — pool 扩至 30 条（行动型 14 + 查询型 16），行动型覆盖文件整理/PPT/邮件/日程/工作汇报；卡片左侧加 message 小图标修复渲染异常方块

[2026-05-18 00:06] DONE 今日一问 2×2 卡片区 — 备选库扩至 24 条（天气/新闻/股市/汇率/知识/娱乐/健康），每次挂载随机抽 4 条显示为圆角矩形卡片网格；功能 pill 恢复为独立的 3 个（写脚本/解释报错/分析代码）

[2026-05-18 00:05] DONE 随机每日问题池 — 第四张 Starter Prompt 卡片改为从 14 条日常问题随机取一条展示（天气/新闻/股市/汇率/知识/娱乐/健康），样式 A（pill 直接显示问题原文），每次挂载随机选取

[2026-05-18 00:04] PENDING "随便问问"卡片随机问题池设计 — 待用户确认：问题池分类（天气/新闻/股市/汇率/知识/娱乐）是否合适；卡片样式选 A（pill 直接显示问题）还是 B（"今日一问"+小字副标题）

[2026-05-18 00:03] DONE 空状态 Starter Prompts + 全消息复制按钮 — 空对话区新增 4 个场景卡片（写脚本/解释报错/分析代码/随便问问），点击填入输入框；所有 assistant 消息 hover 均显示复制按钮，重试按钮仍只在最后一条

[2026-05-18 00:02] DESIGN ICO 框架产品评审 — 三大高价值低成本改动：空状态 Starter Prompts、代码块复制按钮（纯前端可立即做）；最大 Agentic 缺口：复杂任务执行前缺"揭示计划"确认流；feat-108 Tier 2 进度缺步骤时间线；隐式上下文可见性缺失

[2026-05-18 00:01] SETUP ai-interface-design skill 安装 — skills/ai-interface-design.SKILL.md → ~/.claude/skills/ai-interface-design/SKILL.md，重启后即可用 /ai-interface-design

[2026-05-18 00:00] DESIGN 产品设计评审 — feat-207 斜杠命令信任危机（虚构命令需分类标注）；建议 feat-204 提前做（视觉冲击最强、无依赖）；feat-206 需先验证 dashboard 路由；feat-208 建议最小版（去掉树形 UI）；feat-201 首次关窗需一次性提示

[2026-05-17 00:00] PLAN Phase 2 规划完成 — feat-201～206 录入 features.json；跨平台兼容约束写入 constraints.md；current-sprint.md 切换到 Phase 2

[2026-05-15 12:30] DESIGN ACP SDK 调研 — 官方 TS SDK `@agentclientprotocol/sdk`、Rust crate `agent-client-protocol` v0.11.1 均存在；推荐方案：Rust crate 直接对接，天然解决双通道问题

[2026-05-15 12:00] DESIGN ACP 协议深度解析 — 接口全表、prompt/notification 双通道原理、Python SDK 位置、Rust 重做方案（含 Python proxy 选项）

[2026-05-15 11:30] RETRO Phase 2 ACP 方案回滚 — dispatcher 设计缺陷（合成事件 + 历史未迁移），搁置 ACP 迁移，feat-111 跟随暂缓，继续 one-shot 模型

[2026-05-14 11:00] DONE feat-106 快照时间线 — 右侧滑出面板（快照/后台 Tab），保存/恢复/回滚，恢复前内联确认 → commit b97881b

[2026-05-14 10:00] DONE feat-105 目标条 — 对话区顶部可折叠栏，支持设置/暂停/恢复/清除，状态灯+轮数计数，发对应 /goal 命令 → commit b97881b
> - 不要读完整历史，用条目里的文件链接按需查阅

格式：`[日期 时间] [类型] 一句话摘要 → 详情文件`

类型说明：
- `DONE` 完成功能 · `WIP` 进行中 · `BLOCKED` 阻塞
- `DECISION` 架构决策 · `CONSTRAINT` 新发现约束 · `FIX` 修复问题

---

<!-- 新条目追加到这里（上方） -->

[2026-05-25 DONE] feat-208 分支会话 passes=true — fork_session Rust 命令复制 session 文件；ChatPage 拦截 /branch [name]；Sidebar hermes_branch_meta localStorage + ⎇ 图标标记

[2026-05-22 15:46] FIX Windows 打包版点击 UI 弹出 wsl.exe 终端窗口 — 后台 Command 加 CREATE_NO_WINDOW；内嵌 Terminal 的 WSL PTY 改经 cmd.exe /D /Q /C 进入伪控制台

[2026-05-22 14:25] FIX 回复终端面板延迟出现 — 提交后立即显示本地 streaming 终端占位；Rust 启动前后发 raw 状态并消费 stderr，避免等待 Hermes 第一条 stdout

[2026-05-15 18:00] DONE feat-109 图片/附件输入 — 拖拽/粘贴截图 → dataURL → Rust 写 ~/Library/Caches/hermes-desktop/images/ + --image；get_session_history 后处理 [Image attached at] 占位符还原为 image block；tauri.conf dragDropEnabled=false 释放 webview 拖放事件 → commit bafbcf4

[2026-05-15 17:00] DECISION Phase 2 评估 — gateway 模式调研：Hermes CLI 自带 `hermes acp`（ACP server，stdio JSON-RPC）即天然 gateway。能解决进程启动慢/slash 命令不支持/双向中断三大痛点，但需重写 Rust 通信层 + 推翻"一次性进程"约束。决定先收 feat-109 → Phase 1 关闭 → 再做 1～2 天 ACP spike → 可行再开 Phase 2

[2026-05-14 23:30] DONE feat-108 后台任务面板 — desktop 自管理任务表（spawn `hermes chat -q --source tool`），SnapshotPanel 后台 Tab 5s 轮询 + 状态灯/tail/停止全部，窗口关闭时弹层确认保留/终止 → commit 0e7ea9f

[2026-05-14 21:48] FIX 人格选择器移入输入区底部快捷操作行，主输入行只保留输入框和发送按钮

[2026-05-14 21:35] FIX 人格选择器图标统一为系统线性 SVG 风格，替换 emoji 标识并优化选中卡片视觉

[2026-05-14 22:00] DONE feat-107 人格选择器 — 输入框左侧圆形 emoji 按钮 + 弹层卡片网格（8 个内置人格），localStorage 持久化，非默认时显示当前人格 chip + × 清除 → commit 095dbd0

[2026-05-14 21:15] FIX 侧栏会话列表元信息改为图标数字，执行状态改为紧凑状态胶囊并避免标题重叠

[2026-05-14 11:00] FIX 模型选择器：读 auth.json credential_pool 显示 OAuth 配置的 openai-codex，补 fallback 模型列表，自定义输入框视觉区分搜索框

[2026-05-13 23:10] FIX 美化流式终端预览 — raw 输出按命令/状态/错误/警告分色，补 live 标记和深色层次

[2026-05-13 22:36] FIX 首次引导按官方首页调整为 install.sh + hermes setup 两步，并提供配置向导终端入口

[2026-05-13 22:31] FIX 首次引导安装命令改为官方 curl install.sh，一并同步 Dashboard 缺依赖提示

[2026-05-13 22:27] FIX 为 feat-110 增加手动使用引导入口 — 左侧栏底部按钮 + #/onboarding 路由

[2026-05-13 22:19] DONE feat-110 首次使用引导 — Hermes CLI 安装检测 + 三步引导页 + 终端安装入口 → sessions/2026-05-13-2219.md

[2026-05-13 15:37] FIX 修复多会话流式输出重复与 raw 终端格式污染

[2026-05-13 14:30] DONE feat-104 多会话并发架构 — StreamChunk 附加 session_id，前端 per-session 状态隔离，全局 listener 按 session 路由，Sidebar 显示 running/queued/done 徽章，streaming 时可自由切换会话 → sessions/2026-05-13-1424.md

[2026-05-13 14:24] FIX feat-104 排队列表改为数组，支持多条消息排队（逐条取消+全部取消），placeholder 显示当前队列长度 → sessions/2026-05-13-1424.md

[2026-05-13 12:22] FIX feat-103 修复重试/撤销执行错误 — 避免 chat -q 吞掉 slash 命令，改用会话文件回滚 + 静默重发

[2026-05-13 11:52] DONE feat-103 消息快捷操作 — 最后一条 assistant 消息 hover 提供重试/撤销按钮 → sessions/2026-05-13-1152.md

[2026-05-13 11:45] FIX 标题重命名改用 hermes sessions rename，避免 /title 污染对话历史

[2026-05-13 11:35] FIX 会话标题编辑入口从侧边栏移到 TopBar，避免切换会话误触重命名

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

[2026-05-25] FIX 修复双击标题栏无法最大化窗口：AppTitleBar.tsx 补 onDoubleClick → toggleMaximize()

[2026-05-25] DONE 开源发布准备 — 补齐 Cargo.toml 元数据、重写 README（对齐真实组件结构）、新增 CONTRIBUTING.md、.github/ Issue/PR 模板和 CI 工作流
