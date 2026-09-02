---
name: init-agents-md
description: 扫描项目结构并初始化项目级 AGENTS.md（context file）。当用户提到"初始化 AGENTS.md"、"创建项目说明"、"设置项目上下文"、"为新项目生成规则文件"、"看看这个项目要注意什么"，或刚进入一个不熟悉的新仓库、开始新项目工作时，都应使用此 skill，即使没有明确提到 AGENTS.md。
---

# 初始化 AGENTS.md

为新项目（或缺失 AGENTS.md 的项目）扫描结构、分析技术栈与约定，生成一份项目级 `AGENTS.md`，作为 pi（及其他 agent）进入该项目时的上下文文件。

## 为什么要这样做

`AGENTS.md` / `CLAUDE.md` 是 pi 启动时自动加载的 context file（从 `~/.pi/agent/` 全局、父目录、当前目录逐级拼接）。一份好的项目 AGENTS.md 能让 agent 直接知道技术栈、命令和约定，避免每次重新摸索——这就是"初始化项目上下文"的价值。

## 工作流程

### 1. 扫描项目结构

用只读工具收集信息，覆盖以下方面：

- **目录树**：`ls` 根目录（包含隐藏文件），再按需深入 `src/`、`lib/`、`app/` 等源码目录，了解模块划分
- **构建/包管理配置文件**：在根目录查找以下任一文件并读取：
  - JS/TS：`package.json`（scripts、dependencies、devDependencies）
  - Python：`pyproject.toml`、`requirements.txt`、`Pipfile`
  - Go：`go.mod`、`Makefile`
  - Rust：`Cargo.toml`
  - Java/Kotlin：`pom.xml`、`build.gradle`
  - 其他：`composer.json`、`Gemfile`、`mix.exs`、`pubspec.yaml`
- **框架与工具**：`Dockerfile`、`docker-compose.yml`、`.github/workflows/`、`.gitlab-ci.yml`、`Jenkinsfile`、`.pre-commit-config.yaml`、linter/格式化配置（`.eslintrc*`、`.prettierrc*`、`ruff.toml`、`.golangci.yml`）
- **语言分布**：统计主要源码扩展名，确定主语言占比
- **项目描述**：读取 `README.md` 的标题和简介，了解项目用途
- **Git 状态**：`git status` / `git remote -v` 确认仓库状态和远程地址（只读，不修改）

如果项目根目录**已有 AGENTS.md**，不要覆盖——先读取内容，询问用户是更新还是保留。

### 2. 生成 AGENTS.md

在项目根目录写入 `AGENTS.md`，使用以下模板（简体中文）。只填充扫描到的真实信息，**不要编造**不存在的命令或配置；没有的内容就省略该小节。

```markdown
# <项目名> 开发指南

## 项目概览

<一句话描述项目用途，来自 README 或代码分析>

## 技术栈

- 语言/运行时：<如 TypeScript / Node.js 20>
- 框架：<如 React 18 + Vite>
- 主要依赖：<按用途列 3-5 个核心依赖>

## 常用命令

- 安装依赖：<如 `npm install`>
- 开发运行：<如 `npm run dev`>
- 构建：<如 `npm run build`>
- 测试：<如 `npm test`>
- 代码检查：<如 `npm run lint`>

## 代码约定

- 目录结构：<如"业务代码在 src/modules/ 下按领域划分">
- 命名/风格：<从 lint 配置和现有代码推断，如"使用 PascalCase 组件名">
- 测试约定：<如"测试文件与源码同目录，*.test.ts">

## 注意事项

- <项目特有约束，如"禁止提交 dist/ 目录"、"接口走 /api/v2 前缀">
```

### 3. 检查与汇报

写入后自查一遍：

- 命令是否与 `package.json` scripts 等实际配置一致？
- 技术栈信息是否有依据？
- 是否遗漏了明显的项目特性（monorepo、多语言、特殊构建流程）？

完成后向用户简要汇报：AGENTS.md 已生成、覆盖了哪些要点、以及项目中值得注意的地方。

## 注意事项

- 全程只读扫描，不修改项目文件（除最终写入 AGENTS.md 外）
- 不要添加模板中未提及的冗余章节（如许可证、贡献指南——除非项目里已有相关约定）
- 保持 AGENTS.md 精炼，目标是让 agent 快速上手，不是写完整文档
- 生成语言：简体中文
