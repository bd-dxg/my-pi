# 🧠 my-pi

个人 [pi](https://pi.dev) 编码智能体 Agent 配置仓库。

## 📦 概述

> **pi v1.0+** 已内置 MCP 支持，不再需要 `pi-mcp-adapter` 包。

## 📌 版本追踪

> 当前配置对应 **pi v1.6.0**。以后每次更新配置时同步更新此处。

本仓库集中管理 pi Agent 的个性化配置、扩展、MCP 服务以及开发规范，旨在为 AI 编码助手提供**一致的行为准则、工具链和工作流**。

## 🗂️ 目录结构

```
.
├── AGENTS.md          # 全局开发配置（语言、编码原则、工作流、命令策略）
├── settings.json      # pi 核心设置（主题、包、提供商、代理等）
├── mcp.json           # MCP 服务器配置（chrome-devtools、searchcode、tavily）
├── models.json        # 自定义 Provider 与模型配置
├── notify-icon.png    # Windows Toast 通知图标（notify 扩展使用）
├── skills/            # 自定义 skills（见下方 Skills 说明）
├── extensions/        # 自定义扩展
│   ├── footer/             # TUI 底部状态栏（cwd/计时/context 进度/token 统计）
│   ├── notify.ts           # Windows Toast 桌面通知
│   ├── zvision.ts          # image_understand 图像理解工具
│   └── tools.ts            # /tools 工具开关命令
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
- 扩展状态并入第二行左侧，优先级最低，宽度不足时优先被截断，不再单独占行
- 相关文件：`index.ts`（生命周期装配）、`footer.ts`（渲染逻辑）、`icons.ts`（图标定义）、`git.ts`（git 状态）、`utils.ts`（工具函数）

### notify — 桌面通知

在「Pi 需要你」的两个时刻弹出 Windows Toast 通知：

| 时机 | 说明 |
|------|------|
| `agent_settled` | 一轮跑完、等待下一条消息，正文带最后一段回复摘要 |
| `ui_prompt_start` | 弹选择/确认/输入框时通知（含 `ask_user_question`） |

- 仅在 Windows + TUI 模式生效；前台窗口属于 pi 自身祖先进程时静默跳过
- 每次通知起一个隐藏 `powershell.exe`（`-EncodedCommand`），不阻塞主线程，失败静默
- 可选配置：`%PI_CODING_AGENT_DIR%/notify.json`

### zvision — 图像理解

注册自定义工具 `image_understand`，把本地图片或图片 URL 交给智谱 `GLM-4.6V-Flash` 视觉模型理解。适合当前会话模型不支持图片输入时「看懂」截图。

- 配置：环境变量 `ZHIPU_API_KEY`（在 open.bigmodel.cn 申请，免费）

### tools — 工具开关

提供 `/tools` 命令交互式启用/禁用工具，选择结果随会话持久化。

## 🎯 Skills 说明

> pi 会自动读取 `~\.agents\skills` 和 `~\.pi\agent\skills` 这两个全局目录

`skills/` 目录存放自定义 skills

| Skill | 功能 |
|-------|------|
| `gencom` | 根据 git diff 生成符合项目风格的提交信息 |
| `code-review-expert` | 资深工程师视角的代码审查（SOLID、安全、可维护性） |
| `grill-me` | 按设计树逐轮逼问需求，直到达成共识 |
| `skill-creator` | 创建、优化 skill，含 eval 基准评测与报告生成 |
| `skill-monitor` | 监控 GitHub 仓库文件更新，生成变更摘要 |
| `humanizer-zh` | 去除中文文本的 AI 写作痕迹 |
| `naming` | 根据中文描述生成英文标识符（PascalCase） |
| `init-agents-md` | 扫描项目结构并初始化项目级 AGENTS.md |
| `add-anchor` | 为 Markdown 标题添加自定义锚点 |
| `add-frontmatter` | 为 Markdown 文件添加 Frontmatter |
| `find-skills` | 发现并安装可用的 agent skills |
| `github-issue-creator` | 按仓库模板创建带标签的 GitHub Issue |
| `pr-creator` | 按仓库模板创建 Pull Request |
| `pr-address-comments` | 处理当前分支的 GitHub PR 评论 |

> `planning-with-files`（文件化任务规划）已改为通过 npm 包提供，见下方 `packages 安装`。

## ⚙️ 配置说明

### settings.json

| 配置项 | 说明 |
|--------|------|
| `lastChangelogVersion` | 已读过的版本更新日志版本（1.6.0） |
| `theme` | 界面主题（cc-dark-hc） |
| `defaultProvider` / `defaultModel` | 默认 AI 提供商与模型（墨析AI / deepseek-v4.1-flash） |
| `defaultThinkingLevel` | 默认思考等级（high） |
| `httpProxy` | HTTP 代理地址（127.0.0.1:7897） |
| `packages` | 需要额外安装的 pi 包（见下方安装说明） |
| `defaultTools` | 默认工具列表（read、powershell、edit、write） |
| `retry` | 自动重试策略（最多 8 次，基础延迟 10s，provider 最大重试延迟 120s） |
| `compaction` | 上下文压缩（已关闭） |
| `hideThinkingBlock` | 隐藏思考过程（false，默认展开） |
| `showCacheMissNotices` | 缓存未命中提示 |
| `quietStartup` | 静默启动 |
| `tuiMode` | TUI 模式（fullscreen） |
| `fullscreenCopyOnSelect` | 全屏模式下选中即复制（false） |
| `markdown.mermaid` | Mermaid 图表渲染时机（final） |
| `extensionChangelogVersions` | 各扩展已读更新日志版本 |

### packages 安装

`settings.json` 中配置的 `packages` 需要单独安装，在终端执行：

```powershell
pi install @juicesharp/rpiv-ask-user-question
pi install pi-cc-extensions
pi install @juicesharp/rpiv-todo
pi install planning-with-files
```

各包功能：

| 包名 | 说明 |
|------|------|
| `@juicesharp/rpiv-ask-user-question` | 结构化提问（ask_user_question 工具） |
| `pi-cc-extensions` | Claude Code 风格 UI、上下文检查等生产力套件 |
| `@juicesharp/rpiv-todo` | 个人待办管理（todo-list 增删改查） |
| `planning-with-files` | 文件化任务规划（task_plan / findings / progress），替代原本地 skill |

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
          "id": "deepseek-v4-flash", // 模型id
          "name": "DSv4Flash", // 模型昵称,防止id过长显示不方便
          "reasoning": true, // 是否支持思考,不支持就是false,支持就选true
          "input": ["text"],
          "compat": {
            "supportsReasoningEffort": true,
            "supportsDeveloperRole": false // 部分模型不支持Developer,所以要关闭(可选配置)
          },
          "contextWindow": 1000000, // 自行查询,现在模型都是1M了
          "maxTokens": 64000, // 自行查询
          "cost": {"input": 3,"output": 9,"cacheRead": 0.1,"cacheWrite": 0}, // API价格
          "thinkingLevelMap": { "minimal": null, "low": null, "medium": null, "high": "high", "xhigh": "max" }, // 思考强度
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