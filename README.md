# 🧠 my-pi

个人 [pi](https://pi.dev) 编码智能体 Agent 配置仓库。

## 📦 概述

本仓库集中管理 pi Agent 的个性化配置、扩展、MCP 服务以及开发规范，旨在为 AI 编码助手提供**一致的行为准则、工具链和工作流**。

## 🗂️ 目录结构

```
.
├── AGENTS.md          # 全局开发配置（语言、编码原则、工作流、命令策略）
├── settings.json      # pi 核心设置（主题、包、提供商、代理等）
├── mcp.json           # MCP 服务器配置（chrome-devtools、searchcode、tavily）
├── open-tui.json      # Open TUI 终端 UI 配置
├── extensions/        # 自定义扩展
│   ├── custom-provider.ts
│   ├── permission-gate.ts
│   ├── qna.ts
│   ├── question.ts
│   ├── questionnaire.ts
│   ├── structured-output.ts
│   └── tools.ts
├── LICENSE
└── README.md
```

## ⚙️ 配置说明

### settings.json

| 配置项 | 说明 |
|--------|------|
| `theme` | 界面主题（one-dark） |
| `defaultProvider` / `defaultModel` | 默认 AI 提供商与模型 |
| `httpProxy` | HTTP 代理地址 |
| `packages` | 需要额外安装的 pi 包（见下方安装说明） |
| `retry` | 自动重试策略（最多 8 次，基础延迟 5s） |
| `hideThinkingBlock` | 隐藏思考过程 |
| `quietStartup` | 静默启动 |

### packages 安装

`settings.json` 中配置的 `packages` 需要单独安装，在终端执行：

```powershell
pi install pi-mcp-adapter
pi install pi-open-tui
pi install @tintinweb/pi-subagents
pi install @pi-lab/notify
pi install @juicesharp/rpiv-todo
pi install @firstpick/pi-themes-bundle
pi install pi-rounded-tools
```

各包功能：

| 包名 | 说明 |
|------|------|
| `pi-mcp-adapter` | MCP 协议适配器 |
| `pi-open-tui` | 终端 UI 增强 |
| `@tintinweb/pi-subagents` | 子代理支持 |
| `@pi-lab/notify` | 通知功能 |
| `@juicesharp/rpiv-todo` | 任务管理 |
| `@firstpick/pi-themes-bundle` | 主题包合集 |
| `pi-rounded-tools` | 圆角工具样式 |

### MCP 服务

`mcp.json` 配置了以下 MCP 服务器：

- **chrome-devtools** — Chrome DevTools 协议集成（通过 `npx chrome-devtools-mcp`）
- **searchcode** — 公共代码搜索与分析
- **tavily-remote-mcp** — 网络搜索（实时信息、新闻、事实）

### Open TUI

`open-tui.json` 配置了终端 UI 的显示语言、图标、底部状态栏段落和遥测选项。

## 📜 开发规范（AGENTS.md）

`AGENTS.md` 是 AI 编码助手的行为准则，核心要点：

- **语言**：所有输出使用简体中文
- **编码原则**：先思考再编码、简洁优先、外科手术式修改、目标驱动执行
- **工作流**：普通功能 → 编码 → 审查 → 提交；复杂功能先规划
- **命令策略**：文件操作用专用工具，Git 只读操作自动执行，管理员/交互命令交用户执行
- **自动代理**：代码审查 `/code-review-expert`、复杂规划 `/planning-with-files` 自动触发

## 🚀 快速开始

1. 克隆本仓库
2. 安装依赖包（见上方 `packages 安装` 章节）
3. 将 `settings.json`、`mcp.json`、`open-tui.json` 放置在 pi 配置目录中
4. 将 `AGENTS.md` 放置在项目根目录作为 AI 行为准则

## 感谢

感谢 [LinuxDo 社区](https://linux.do/)对本项目的支持