# Hermes Desktop

一个为 [Hermes Agent](https://hermes-agent.nousresearch.com) 打造的桌面 UI，基于 Tauri 2 + React。

## 功能

### 对话核心
- **多轮对话** — 完整对话历史，自动滚动，Markdown 渲染
- **Think Block 可视化** — 折叠式思考过程展示（紫色区块）
- **Tool Call 可视化** — 工具调用输入/输出折叠展示（青色区块）
- **斜杠命令菜单** — 输入 `/` 触发命令选择器，快速执行预设操作
- **@ 引用** — 输入 `@` 引用文件或技能，文件内容自动注入消息
- **消息队列** — Agent 执行时可排队多条消息，支持逐条取消或全部清空
- **后台运行** — 将输入作为独立任务在后台执行，不影响当前会话
- **重试 / 停止** — 一键重试上一条消息，或中断正在执行的 Agent
- **语音输入** — 内置语音识别支持，中文语音转文字
- **图片粘贴与拖拽** — 剪贴板粘贴或拖拽上传图片
- **文件附件** — 上传 PDF / Word / Excel / PPT / 文本等文件
- **错误智能分析** — 对 401 / 429 / 模型不存在 / MCP 错误展示可操作建议卡片
- **个性选择** — 切换对话 Personality
- **新会话引导** — 今日一问随机建议 + 快速启动模板
- **上下文压缩** — 上下文接近上限时一键压缩

### 会话管理
- **侧边栏会话列表** — 切换/删除（含 3 秒反悔窗口），自动加载 `~/.hermes/sessions/`
- **标签与筛选** — 彩色标签（≤5 字）、按时间分组、按标签筛选
- **状态徽章** — 实时显示执行中 / 排队中 / 执行完成
- **会话统计** — 底部显示总会话数

### 状态监控
- **顶栏仪表盘** — 实时显示当前模型、Token 用量、费用、运行时长

### 记忆编辑器
- **图形化管理** — 直接编辑 Agent 的 `MEMORY.md` 和 `USER.md`
- **容量感知** — 字符上限条形图，超出禁止保存，实时保存/加载

### Dashboard
- **内嵌管理面板** — 管理 Kanban / Cron / Config / MCP 等
- **自动启动** — 自动启动 Hermes Dashboard 后端 + 依赖检测

### 个性化设置
- **3 套主题** — Claude Noir / Apple / Warp
- **5 种机器人形象** — Classic / Voxel / Anime / Cyber / Pod
- **5 种终端背景** — 暗夜 / 毛玻璃 / 深海 / 暮色 / 暗林
- **字体大小** — 界面 / 终端 / 文件管理器 三区独立调节

### 新手引导
- **自动检测** — 首次运行检测 Hermes CLI 安装状态
- **配置检查** — 版本、路径、API Key、提供商一览

### 窗口与快捷键
- **自定义标题栏** — 应用菜单（新建/记忆/Dashboard/设置/终端/快照等）
- **原生窗口控制** — 最小化/最大化/关闭
- **快捷键面板** — `Cmd+/` 触发全局快捷键速查
- **全局快捷键** — `Cmd+N` 新建会话，`Cmd+W` 关闭面板，`Cmd+Shift+H` 显示/隐藏窗口
- **面板系统** — 快照时间线 / 终端 / 文件树 可切换面板
- **Terminal Noir 主题** — 深色琥珀金配色，JetBrains Mono 字体

## 前置条件

1. **安装 Hermes Agent**

   ```bash
   curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
   ```

2. **安装 Rust**（Tauri 需要）

   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

3. **安装 Node.js**（>=18）

   通过 nvm、brew 或官网安装即可。

4. **安装 Tauri CLI**

   ```bash
   npm install -g @tauri-apps/cli@next
   ```

## 安装依赖

```bash
cd hermes-desktop
npm install
```

## 开发模式

```bash
npm run tauri dev
```

Vite dev server 会在 1420 端口启动，Tauri 窗口会自动打开。

## 打包发布

```bash
npm run tauri build
```

产出物在 `src-tauri/target/release/bundle/` 中。

## 架构说明

```
hermes-desktop/
├── src-tauri/          # Rust 后端
│   └── src/
│       ├── main.rs     # 程序入口
│       └── lib.rs      # 所有 Tauri 命令（spawn hermes、解析输出流）
├── src/                # React 前端
│   ├── App.tsx         # 状态管理、事件监听
│   ├── types.ts        # TypeScript 类型
│   ├── index.css       # Terminal Noir 主题样式
│   └── components/
│       ├── TopBar.tsx      # 顶部状态栏
│       ├── Sidebar.tsx     # 会话侧边栏
│       ├── ChatView.tsx    # 聊天主区域 + 输入框
│       └── MessageBubble.tsx  # 消息气泡（含 think/tool 可视化）
```

## 通信机制

每次发送消息时，Rust 层会：

1. 执行 `hermes chat -q "<message>" [--resume <session_id>]`
2. 逐行读取 stdout，剥离 ANSI 转义码
3. 状态机解析：普通文本 / think block / tool call
4. 通过 Tauri 事件 `hermes:chunk` 推送到前端
5. 前端实时更新 React 状态，渲染流式内容

## 自定义配置

在 `src-tauri/src/lib.rs` 中可以调整：

- `banner_lines`：跳过 hermes 欢迎 banner 的行数（默认 6）
- Tool call 检测的 Unicode 头字符（`◆` `▶` 等）
- Think block 的标记格式

## 常见问题

**Q: 提示 "Failed to start hermes"**
A: 确保 `hermes` 命令在 PATH 中，运行 `which hermes` 验证。

**Q: 会话列表为空**
A: 先用 `hermes chat` 跑一次，生成 `~/.hermes/sessions/` 目录。

**Q: Think block 没有正确折叠**
A: Hermes 的 think block 标记格式可能因版本不同，在 `lib.rs` 的 `send_message` 函数中调整检测字符串。
