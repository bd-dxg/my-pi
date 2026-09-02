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
├── skills/            # 自定义 skills（见下方 Skills 说明）
├── extensions/        # 自定义扩展
│   ├── footer/             # TUI 底部状态栏（cwd/计时/context 进度/token 统计）
│   ├── i-have-adhd/        # ADHD 模式输出规则集
│   ├── pi-rtk-optimizer/   # RTK 命令重写与输出压缩优化
│   └── tools.ts
├── LICENSE
└── README.md
```

## 🧩 扩展说明

### footer — TUI 底部状态栏

一个自绘的底部状态栏扩展，实时展示会话信息，随 TUI 生命周期自动安装/卸载。

| 功能 | 说明 |
|------|------|
| 路径 | 当前工作目录（cwd） |
| 计时 | 当前 agent 回合进行时长 / 上一次完成耗时 |
| context 进度 | 上下文窗口使用进度 |
| token 统计 | 输入/输出 token 用量，含缓存命中率与成本 |
| 当前状态 | 模型、思考、扩展、git 分支等状态标识 |

- 图标支持 **Nerd Font / ASCII** 两种模式，通过 `icons.ts` 自动检测终端切换
- 相关文件：`index.ts`（生命周期装配）、`footer.ts`（渲染逻辑）、`icons.ts`（图标定义）、`utils.ts`（工具函数）

### pi-rtk-optimizer

对 RTK 命令进行重写与输出压缩，减少 token 消耗（见 `settings.json` 的 `packages` 说明）。

### i-have-adhd

ADHD 模式输出规则集。用户说「ADHD MODE ACTIVE」时生效，调整回复形态：先给下一步动作、步骤编号、每轮重述进度、给具体时间估计等，帮助 ADHD 大脑直接行动。

## 🎯 Skills 说明

> pi 会自动读取 `~\.agents\skills` 和 `~\.pi\agent\skills` 这两个全局目录

`skills/` 目录存放自定义 skills

| Skill | 功能 |
|-------|------|
| `gencom` | 根据 git diff 生成符合项目风格的提交信息 |
| `code-review-expert` | 资深工程师视角的代码审查（SOLID、安全、可维护性） |
| `planning-with-files` | 文件化任务规划，追踪多步骤复杂任务进度 |
| `skill-creator` | 创建、优化 skill，含 eval 基准评测与报告生成 |
| `skill-monitor` | 监控 GitHub 仓库文件更新，生成变更摘要 |
| `i-have-adhd` | ADHD 模式输出规则（先给动作、编号步骤、具体时间估计） |
| `humanizer-zh` | 去除中文文本的 AI 写作痕迹 |
| `naming` | 根据中文描述生成英文标识符（PascalCase） |
| `todo-list` | 个人待办增删改查，支持多级项目嵌套 |
| `init-agents-md` | 扫描项目结构并初始化项目级 AGENTS.md |
| `add-anchor` | 为 Markdown 标题添加自定义锚点 |
| `add-frontmatter` | 为 Markdown 文件添加 Frontmatter |
| `find-skills` | 发现并安装可用的 agent skills |
| `github-issue-creator` | 按仓库模板创建带标签的 GitHub Issue |
| `pr-creator` | 按仓库模板创建 Pull Request |
| `pr-address-comments` | 处理当前分支的 GitHub PR 评论 |
| `grill-me-docs-standalone` | 需求不明确时向用户提问澄清 |

## ⚙️ 配置说明

### settings.json

| 配置项 | 说明 |
|--------|------|
| `lastChangelogVersion` | 已读过的版本更新日志版本（0.84.3） |
| `theme` | 界面主题（cc-dark） |
| `defaultProvider` / `defaultModel` | 默认 AI 提供商与模型（LinuxHub / deepseek-v4-flash-vision-exp） |
| `defaultThinkingLevel` | 默认思考等级（high） |
| `httpProxy` | HTTP 代理地址（127.0.0.1:7897） |
| `packages` | 需要额外安装的 pi 包（见下方安装说明） |
| `defaultTools` | 默认工具列表（read、powershell、edit、write） |
| `retry` | 自动重试策略（最多 8 次，基础延迟 10s，provider 最大重试延迟 120s） |
| `compaction` | 上下文压缩（已关闭） |
| `hideThinkingBlock` | 隐藏思考过程 |
| `showCacheMissNotices` | 缓存未命中提示 |
| `quietStartup` | 静默启动 |
| `tuiMode` | TUI 模式（regular） |
| `fullscreenExitOutput` | 全屏模式退出时输出的内容（transcript） |
| `markdown.mermaid` | Mermaid 图表渲染时机（final） |

### packages 安装

`settings.json` 中配置的 `packages` 需要单独安装，在终端执行：

```powershell
pi install pi-mcp-adapter
pi install @ff-labs/pi-fff
pi install @juicesharp/rpiv-ask-user-question
pi install @pi-unipi/notify
pi install pi-cc-extensions
pi install pi-rtk-optimizer
pi install @juicesharp/rpiv-todo
```

各包功能：

| 包名 | 说明 |
|------|------|
| `pi-mcp-adapter` | MCP 协议适配器 |
| `@ff-labs/pi-fff` | ff 文件搜索工具（ffgrep / fffind） |
| `@juicesharp/rpiv-ask-user-question` | 结构化提问（ask_user_question 工具） |
| `@pi-unipi/notify` | 跨平台通知（notify_user 工具） |
| `pi-cc-extensions` | Claude Code 风格 UI、上下文检查等生产力套件 |
| `pi-rtk-optimizer` | RTK 命令重写与输出压缩优化（节省 token） |
| `@juicesharp/rpiv-todo` | 个人待办管理（todo-list 增删改查） |

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
      "baseUrl": "http://xxx/v1", // 填写中转站域名
      "api": "openai-completions", // 一般不用修改
      "apiKey": "ollama", // 填写生成的key
      "headers": { "user-agent": "Go-http-client/2.0" }, //部分要求指定UA,这里可以自定义配置
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
4. 将 `AGENTS.md` 放置在`~\.pi\agent`目录作为 AI 行为全局准则
5. 将需要的 skill 从 `skills/` 复制到 `~\.agents\skills`

## 感谢

感谢 [LinuxDo 社区](https://linux.do/)对本项目的支持