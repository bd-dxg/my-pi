/**
 * Question Tool - 让 AI 主动向你提问
 * 演示：AI 拿不定主意时，弹选项让你选
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Editor, type EditorTheme, Key, matchesKey, Text, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { Type } from "typebox";

const OptionSchema = Type.Object({
  label: Type.String({ description: "选项标签" }),
  description: Type.Optional(Type.String({ description: "选项描述" })),
})

const QuestionParams = Type.Object({
  question: Type.String({ description: "要问用户的问题" }),
  options: Type.Array(OptionSchema, { description: "选项列表" }),
})

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "question",
    label: "Question",
    description: "向用户提问，让用户从选项中选择或输入自定义答案。当需要用户决策或澄清时使用。",
    parameters: QuestionParams,
    executionMode: "sequential",

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (ctx.mode !== "tui") {
        return {
          content: [{ type: "text", text: "错误：非交互模式下无法提问" }],
          details: { question: params.question, options: params.options.map(o => o.label), answer: null },
        }
      }

      const allOptions = [...params.options, { label: "自己输入...", isOther: true }]

      const result = await ctx.ui.custom<{ answer: string; wasCustom: boolean } | null>(
        (tui, theme, _kb, done) => {
          let optionIndex = 0
          let editMode = false

          const editorTheme: EditorTheme = {
            borderColor: s => theme.fg("accent", s),
            selectList: {
              selectedPrefix: t => theme.fg("accent", t),
              selectedText: t => theme.fg("accent", t),
              description: t => theme.fg("muted", t),
              scrollInfo: t => theme.fg("dim", t),
              noMatch: t => theme.fg("warning", t),
            },
          }
          const editor = new Editor(tui, editorTheme)

          editor.onSubmit = (value) => {
            const trimmed = value.trim()
            if (trimmed) {
              done({ answer: trimmed, wasCustom: true })
            } else {
              editMode = false
              editor.setText("")
            }
          }

          return {
            render(width) {
              const lines: string[] = []
              const rw = Math.max(1, width)

              lines.push(theme.fg("accent", "─".repeat(rw)))
              lines.push(theme.bold(theme.fg("text", params.question)))
              lines.push("")

              for (let i = 0; i < allOptions.length; i++) {
                const opt = allOptions[i]
                const selected = i === optionIndex
                const prefix = selected ? theme.fg("accent", "> ") : "  "
                const label = `${i + 1}. ${opt.label}${opt.isOther && editMode ? " ✎" : ""}`
                lines.push(prefix + theme.fg(selected ? "accent" : "text", label))
                if (opt.description) {
                  lines.push("   " + theme.fg("muted", opt.description))
                }
              }

              if (editMode) {
                lines.push("")
                lines.push(theme.fg("muted", "你的回答:"))
                for (const line of editor.render(Math.max(1, rw - 2))) {
                  lines.push(" " + line)
                }
              }

              lines.push("")
              lines.push(theme.fg("dim", editMode ? "Enter 提交 • Esc 返回选项" : "↑↓ 导航 • Enter 选择 • Esc 取消"))
              lines.push(theme.fg("accent", "─".repeat(rw)))

              return lines
            },
            handleInput(data) {
              if (editMode) {
                if (matchesKey(data, Key.escape)) {
                  editMode = false
                  editor.setText("")
                  return
                }
                editor.handleInput(data)
                return
              }

              if (matchesKey(data, Key.up)) optionIndex = Math.max(0, optionIndex - 1)
              else if (matchesKey(data, Key.down)) optionIndex = Math.min(allOptions.length - 1, optionIndex + 1)
              else if (matchesKey(data, Key.enter)) {
                const selected = allOptions[optionIndex]
                if (selected.isOther) {
                  editMode = true
                } else {
                  done({ answer: selected.label, wasCustom: false })
                }
              } else if (matchesKey(data, Key.escape)) {
                done(null)
              }
            },
          }
        },
      )

      if (!result) {
        return {
          content: [{ type: "text", text: "用户取消了选择" }],
          details: { question: params.question, options: params.options.map(o => o.label), answer: null },
        }
      }

      return {
        content: [{ type: "text", text: result.wasCustom ? `用户输入: ${result.answer}` : `用户选择: ${result.answer}` }],
        details: { question: params.question, options: params.options.map(o => o.label), answer: result.answer },
      }
    },
  })
}