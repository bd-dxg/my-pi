---
name: add-frontmatter
description: 为当前打开的 Markdown 文件添加 Frontmatter（包含 title 和 description）
---

## 功能说明

为您**当前正在编辑的 Markdown 文件**自动添加或更新 Frontmatter，包含以下字段：

1. **title**: 使用文件中的一级标题作为 title
2. **description**: 根据文章内容生成简短的描述（不超过 50 字）

## 使用方法

1. 在 VSCode 中打开需要处理的 Markdown 文件
2. 运行 `/add-frontmatter` 命令
3. 系统自动为文件添加 Frontmatter

## 处理逻辑

- 如果文件已有 Frontmatter，则更新现有内容
- description 需要准确概括文章核心内容（不超过 50 字）
- 保持原有文件格式和内容不变
