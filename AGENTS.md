# 全局开发配置

## 语言和环境

- **语言**: 所有输出（包括思考过程、回复、代码注释和 commit 信息）一律使用简体中文
- **操作系统**: Windows 11 | **AI 终端**: Git Bash (MSYS2) | **用户终端**: PowerShell
- **环境限制**: 无 Python 环境，避免使用 Python 相关命令 和 脚本
- **已安装 CLI**: GitHub CLI（`gh`），涉及 GitHub 仓库操作时优先使用

## 权限

- 拥有读取任意文件的权限，无需询问确认

## 编码原则（核心哲学）

### 1. 先思考，再编码

- 明确说明假设；有多种解读时，列出选项，不要悄悄选一个
- 遇到更简单的方案，主动说出来；真正不清楚时，**停下来问**，主动使用 `grill-me-docs-standalone` skill 询问

### 2. 简洁优先

- 只实现被要求的功能，不写投机性代码
- 单次使用的代码不做抽象；不要"未来可能用到"的灵活性
- 写了 200 行但 50 行能解决 → 重写

### 3. 外科手术式修改

- 只改必须改的地方；不"顺手优化"无关代码
- 保持现有代码风格，即使你会用不同写法
- 你的改动产生的孤儿代码（无用 import/变量）→ 删掉；原有死代码 → 仅提及，不删除

### 4. 目标驱动执行

将任务转化为可验证的目标：

- "修复 bug" → "写一个能复现它的测试，然后让它通过"
- "重构 X" → "确保重构前后测试都通过"

多步骤任务先列计划：

```text
1. [步骤] → 验证: [检查点]
2. [步骤] → 验证: [检查点]
```

## 命令执行策略

### AI 自动执行（✅ 允许）

- **文件操作**：使用专用工具（Read、Write、Edit、Glob、Grep），不用 find/grep/cat/echo 等 shell 命令
- **Git 只读**：`git status/log/diff/branch/show/blame`
- **GitHub 操作**：`gh pr/issue/repo/search` 等

### 提供给用户执行（PowerShell 代码块）

需要管理员权限、交互式操作、长运行进程的命令 → 给出 PowerShell 代码块，由用户手动执行

### 绝对禁止

- 交互式命令（文本编辑器、交互式安装向导）
- 系统管理命令（需要管理员权限）
- 文件操作 shell 命令（rm、cp、mv、curl 等）

## 核心工作流

### 普通功能

规划 → 编码 → `/code-review-expert` → `/gencom` 提交

### 复杂功能 / 架构变更

`/planning-with-files` 生成计划 → 用户确认 → 分阶段实现 → 全面审查 → `/gencom` 提交

### 自动触发代理

| 代理                   | 触发条件                               |
| ---------------------- | -------------------------------------- |
| `/code-review-expert`  | 写完任何代码后，立即触发（必须）       |
| `/planning-with-files` | 复杂功能或大型重构，编码前触发（推荐） |

## MCP 工具

当前配置了 3 个 MCP 服务器，按需调用。首次使用某服务器时需先 `connect`。

### searchcode — 公开 Git 仓库代码搜索/分析（6 tools）

| 工具 | 用途 |
|------|------|
| `searchcode_code_search` | 跨任意公开 Git 仓库快速搜索代码 |
| `searchcode_code_analyze` | 仓库概览：语言、复杂度、目录结构 |
| `searchcode_code_get_file` | 获取远程仓库单个文件内容 |
| `searchcode_code_get_files` | 批量获取远程仓库多个文件内容 |
| `searchcode_code_file_tree` | 列出远程仓库的目录/文件树 |
| `searchcode_code_get_findings` | 获取远程仓库代码质量分析结果 |

> 适用场景：分析开源项目、搜索别人怎么实现某个功能、查看依赖源码。

### tavily-remote-mcp — 网络搜索与网页提取（5 tools）

| 工具 | 用途 |
|------|------|
| `tavily-remote-mcp_tavily_search` | 搜索当前信息、新闻、事实 |
| `tavily-remote-mcp_tavily_extract` | 提取指定 URL 的页面内容（纯文本） |
| `tavily-remote-mcp_tavily_crawl` | 从起始 URL 开始爬取网站，提取页面内容 |
| `tavily-remote-mcp_tavily_map` | 映射网站结构，返回 URL 列表 |
| `tavily-remote-mcp_tavily_research` | 对某个话题进行深度综合研究 |

> 适用场景：查最新信息、新闻、事实，或需要读取某个网页内容时。


### chrome-devtools — Chrome 浏览器自动化（3 tools）

| 工具 | 用途 |
|------|------|
| `chrome-devtools_navigate` | 加载/跳转 URL |
| `chrome-devtools_screenshot` | 截图 |
| `chrome-devtools_evaluate` | 执行 JS 脚本 |

> 适用场景：需要浏览器交互时（登录、JS 渲染页面、截图验证等）。

### 使用方式

- 查看服务器状态：`mcp({})`
- 连接服务器：`mcp({ connect: "server-name" })`
- 搜索工具：`mcp({ search: "keyword" })`
- 查看工具详情：`mcp({ describe: "tool_name" })`
- 调用工具：`mcp({ tool: "tool_name", args: { ... } })`
- 批量调用：用 `mcpScript` 编写 JavaScript 串联多个调用

## 工作原则

- 优先查阅项目级 `CLAUDE.md`或者`AGENTS.md`
- 优先编辑现有文件，不创建新文件

## 错误处理

- **工具失败**：分析原因 → 尝试替代方案（Glob 失败 → 试 Grep）→ 连续失败 3 次向用户说明
- **构建/测试失败**：增量修复，一次处理一个错误，每次修复后验证
