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
├── models.json        # 自定义 Provider 与模型配置
├── extensions/        # 自定义扩展
│   ├── permission-gate.ts
│   ├── qna.ts.bak
│   ├── question.ts.bak
│   ├── questionnaire.ts.bak
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
| `defaultThinkingLevel` | 默认思考等级（high） |
| `httpProxy` | HTTP 代理地址 |
| `packages` | 需要额外安装的 pi 包（见下方安装说明） |
| `retry` | 自动重试策略（最多 8 次，基础延迟 10s） |
| `compaction` | 上下文压缩（已关闭） |
| `hideThinkingBlock` | 隐藏思考过程 |
| `showCacheMissNotices` | 缓存未命中提示 |
| `quietStartup` | 静默启动 |

### packages 安装

`settings.json` 中配置的 `packages` 需要单独安装，在终端执行：

```powershell
pi install pi-mcp-adapter
pi install pi-open-tui
pi install @juicesharp/rpiv-todo
pi install @firstpick/pi-themes-bundle
pi install pi-win-notify
pi install @ff-labs/pi-fff
```

各包功能：

| 包名 | 说明 |
|------|------|
| `pi-mcp-adapter` | MCP 协议适配器 |
| `pi-open-tui` | 终端 UI 增强 |
| `@juicesharp/rpiv-todo` | 任务管理 |
| `@firstpick/pi-themes-bundle` | 主题包合集 |
| `pi-win-notify` | Windows 通知 |
| `@ff-labs/pi-fff` | ff 文件搜索工具 |

### MCP 服务

`mcp.json` 配置了以下 MCP 服务器：

- **chrome-devtools** — Chrome DevTools 协议集成（通过 `npx chrome-devtools-mcp`）
- **searchcode** — 公共代码搜索与分析
- **tavily-remote-mcp** — 网络搜索（实时信息、新闻、事实）

### models.json

`models.json` 用于声明自定义 AI 提供商与模型，替代原有的 TypeScript 扩展方式。

```json
{
  "providers": {
    "ollama": { // 字段可修改为中转站名称,方便识别
      "baseUrl": "http://localhost:11434/v1", // 填写中转站域名
      "api": "openai-completions", // 一般不用修改
      "apiKey": "ollama", // 填写生成的key
      "models": [
        {
          "id": "llama3.1:8b", // 模型名字
          "name": "Llama 3.1 8B (Local)", // 与上方相同
          "reasoning": false, // 是否支持思考,不支持就是false,支持就选true
          "input": ["text"],
          "compat": {
            "supportsReasoningEffort": true,
            "supportsDeveloperRole": false // 部分模型不支持Developer,所以要关闭(可选配置)
          },
          "contextWindow": 128000, // 自行查询,现在模型都是1M了
          "maxTokens": 32000, // 自行查询
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
        }
      ]
    }
  }
}
```

## 📜 开发规范（AGENTS.md）

`AGENTS.md` 是 AI 编码助手的行为准则，核心要点：

- **语言**：所有输出使用简体中文
- **编码原则**：先思考再编码、简洁优先、外科手术式修改、目标驱动执行
- **工作流**：普通功能 → 编码 → 审查 → 提交；复杂功能先规划
- **命令策略**：文件操作用专用工具，Git 只读操作自动执行，管理员/交互命令交用户执行
- **自动代理**：代码审查 `code-review-expert`、复杂规划 `planning-with-files` 自动触发

## 🚀 快速开始

1. 克隆本仓库
2. 安装依赖包（见上方 `packages 安装` 章节）
3. 将 `settings.json`、`mcp.json` 放置在 pi 配置目录中
4. 将 `AGENTS.md` 放置在项目根目录作为 AI 行为准则

## 感谢

感谢 [LinuxDo 社区](https://linux.do/)对本项目的支持