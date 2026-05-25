# 贡献指南

感谢你对 My Hermes Desktop 的兴趣！以下是参与贡献的基本流程。

## 提 Issue

- **Bug 报告**：使用 Bug Report 模板，附上复现步骤、系统版本（macOS/Hermes CLI 版本）、截图或日志
- **功能建议**：使用 Feature Request 模板，说明使用场景和期望行为
- 提交前请先搜索已有 Issue，避免重复

## 提 Pull Request

1. Fork 本仓库，基于 `main` 分支创建功能分支：

   ```bash
   git checkout -b feat/your-feature-name
   ```

2. 遵守以下编码规范：
   - 前端：TypeScript + React Hooks，组件放 `src/components/` 对应子目录
   - 后端：Rust 命令放 `src-tauri/src/commands/` 对应模块，复杂逻辑拆独立函数
   - 不加没被要求的功能、配置项、抽象层
   - 不留孤儿 import / 未使用变量

3. 确保通过类型检查和测试：

   ```bash
   npm test
   npx tsc --noEmit
   ```

4. 提交信息格式：

   ```
   feat: 简短描述（不超过 72 字符）
   fix: 修复 xxx 导致的 yyy
   ```

5. 发起 PR，填写模板中的说明，包括：截图（UI 变化必填）、测试方法

## 本地开发环境

见 [README.md](README.md) 的"本地开发"一节。

## 目录规范速查

| 要添加什么 | 放哪里 |
|-----------|--------|
| 新的 React 组件 | `src/components/` 或对应子目录 |
| 聊天区子组件 | `src/components/chat/` |
| TopBar 子组件 | `src/components/topbar/` |
| 新的 Tauri 命令 | `src-tauri/src/commands/` 对应模块 |
| 全局类型定义 | `src/types.ts` |
| 全局样式 / 主题变量 | `src/index.css` |

## 许可证

提交 PR 即表示你同意将代码贡献以 [Apache License 2.0](LICENSE) 发布。
