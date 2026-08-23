/**
 * 权限控制扩展
 *
 * 在执行危险操作前弹窗确认，支持 Windows (Git Bash + PowerShell) 环境。
 * 同时还保护敏感文件路径不被意外写入。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // ========== 1. 危险命令检测 ==========
  // Git Bash 危险命令
  const gitBashPatterns = [
    /\brm\b/i,                           // 任何 rm 删除
    /\bsudo\b/i,                       // sudo
    /\b(chmod|chown)\b.*777/i,        // chmod 777
    /\bdd\s+if=/i,                     // dd 写磁盘
    /\bmkfs\b/i,                       // 格式化
    // 注: 原规则 /\b:?>\s*\/dev\//i 会误拦 2>/dev/null 等正常 shell 重定向，已删除
  ]

  // PowerShell 危险命令
  const powershellPatterns = [
    /\bRemove-Item\b/i,                // Remove-Item
    /\brm\s+-recurse\b/i,              // rm -recurse
    /\bdel\s+\/f/i,                    // del /f
    /\brd\s+\/s/i,                     // rd /s
    /\brmdir\s+\/s/i,                  // rmdir /s
    /\bFormat-Volume\b/i,              // 格式化磁盘
    /\bClear-Content\b/i,              // 清空文件
  ]

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return undefined

    const command = event.input.command as string
    const isDangerous = [...gitBashPatterns, ...powershellPatterns].some((p) => p.test(command))

    if (isDangerous) {
      if (!ctx.hasUI) {
        return { block: true, reason: "危险命令已被阻止（无交互界面，无法确认）" }
      }

      const choice = await ctx.ui.select(`⚠️ 危险命令:\n\n  ${command}\n\n是否允许执行？`, [
        "是，允许执行",
        "否，阻止",
      ])

      if (choice !== "是，允许执行") {
        return { block: true, reason: "用户已阻止" }
      }
    }

    return undefined
  })

  // ========== 2. 敏感路径保护 ==========
  const protectedPaths = [
    '.env',
    '.git/',
    'node_modules/',
    'package-lock.json',
    'pnpm-lock.yaml',
    'secrets.',
    'credentials',
    'id_rsa',
    'id_ed25519',
  ]

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "write" && event.toolName !== "edit") {
      return undefined
    }

    const path = event.input.path as string
    const isProtected = protectedPaths.some((p) => path.includes(p))

    if (isProtected) {
      if (ctx.hasUI) {
        ctx.ui.notify(`已阻止写入受保护路径: ${path}`, "warning")
      }
      return { block: true, reason: `路径 "${path}" 受保护，已阻止写入` }
    }

    return undefined
  })
}