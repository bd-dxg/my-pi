/**
 * Q&A 抽取器 — 从 AI 回复中提取问题，箭头选择答案
 *
 * 自动触发: AI 回复完成后自动检测问题并弹出选择
 * 手动触发: /qna
 * 流程: 取最后一条 AI 回复 → LLM 抽取问题 → 逐题箭头选择 → 汇总填入编辑器
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { complete, type UserMessage } from "@earendil-works/pi-ai/compat";
import { BorderedLoader } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey } from "@earendil-works/pi-tui";

interface QItem {
  question: string;
  options: string[];
}

interface QnAAnswer {
  question: string;
  answer: string;
}

const SYSTEM_PROMPT = `You are a question extractor. Given text from a conversation, find ALL questions that need a decision/answer from the user.

Output each question in this EXACT format (one per block, separated by blank line):

<code>
[Q] 问题文本
[O] 选项1
[O] 选项2
[O] 选项3
</code>

Rules:
- Only extract REAL questions that the user should answer (not rhetorical)
- Provide 2-5 concise options per question
- Keep options mutually exclusive
- If a question is Yes/No, options should be like "是" / "否" or the two clear choices
- Output ONLY the [Q]/[O] blocks, nothing else
- If no questions found, output: [NONE]`;

/** 已处理过的消息 ID，防止重复触发 */
const processedMessageIds = new Set<string>();

export default function (pi: ExtensionAPI) {
  // ========== 自动触发 ==========
  pi.on("agent_settled", async (_event, ctx) => {
    if (ctx.mode !== "tui") return;
    if (!ctx.model) return;

    const lastText = getLastAssistantText(ctx);
    if (!lastText) return;

    // 快速预检：没有问号就跳过
    if (!hasQuestionMark(lastText)) return;

    // 生成消息指纹，避免重复处理
    const fingerprint = simpleHash(lastText);
    if (processedMessageIds.has(fingerprint)) return;

    await runQna(ctx, lastText);
  });

  // ========== 手动触发 ==========
  pi.registerCommand("qna", {
    description: "从最后一条 AI 回复中提取问题，箭头选择回答",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("qna 需要交互模式", "error");
        return;
      }

      if (!ctx.model) {
        ctx.ui.notify("未选择模型", "error");
        return;
      }

      const lastText = getLastAssistantText(ctx);
      if (!lastText) {
        ctx.ui.notify("未找到 AI 回复", "error");
        return;
      }

      await runQna(ctx, lastText);
    },
  });
}

// ========== 核心流程 ==========

async function runQna(ctx: ExtensionContext, lastText: string): Promise<void> {
  // 1. 用 LLM 抽取问题
  const extraction = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
    const loader = new BorderedLoader(tui, theme, `抽取问题中... (${ctx.model!.id})`);
    loader.onAbort = () => done(null);

    const doExtract = async () => {
      const auth = await ctx.modelRegistry.getApiKeyAndHeaders(ctx.model!);
      if (!auth.ok || !auth.apiKey) {
        throw new Error(auth.ok ? `无 API key: ${ctx.model!.provider}` : auth.error);
      }

      const userMessage: UserMessage = {
        role: "user",
        content: [{ type: "text", text: lastText }],
        timestamp: Date.now(),
      };

      const response = await complete(
        ctx.model!,
        { systemPrompt: SYSTEM_PROMPT, messages: [userMessage] },
        { apiKey: auth.apiKey, headers: auth.headers, env: auth.env, signal: loader.signal },
      );

      if (response.stopReason === "aborted") return null;

      return response.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n");
    };

    doExtract().then(done).catch(() => done(null));
    return loader;
  });

  if (!extraction) {
    ctx.ui.notify("取消了抽取", "info");
    return;
  }

  // 2. 解析 [Q]/[O] 格式
  const questions: QItem[] = parseQuestions(extraction);
  if (questions.length === 0) {
    ctx.ui.notify("未在 AI 回复中发现问题", "info");
    return;
  }

  // 标记已处理，防止重复触发
  const fingerprint = simpleHash(lastText);
  processedMessageIds.add(fingerprint);

  // 3. 逐题箭头选择
  const answers: QnAAnswer[] = [];

  for (const item of questions) {
    const answer = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
      let index = 0;

      return {
        render(width: number): string[] {
          const rw = Math.max(1, width);
          const lines: string[] = [];

          lines.push(theme.fg("accent", "─".repeat(rw)));
          lines.push(theme.bold(theme.fg("text", item.question)));
          lines.push("");

          for (let i = 0; i < item.options.length; i++) {
            const selected = i === index;
            const prefix = selected ? theme.fg("accent", "> ") : "  ";
            const label = `${i + 1}. ${item.options[i]!}`;
            lines.push(prefix + theme.fg(selected ? "accent" : "text", label));
          }

          lines.push("");
          lines.push(theme.fg("dim", "↑↓ 导航 • Enter 选择 • Esc 跳过"));
          lines.push(theme.fg("accent", "─".repeat(rw)));

          return lines;
        },

        handleInput(data: string): void {
          if (matchesKey(data, Key.up)) {
            index = Math.max(0, index - 1);
          } else if (matchesKey(data, Key.down)) {
            index = Math.min(item.options.length - 1, index + 1);
          } else if (matchesKey(data, Key.enter)) {
            done(item.options[index] ?? item.options[0] ?? "");
          } else if (matchesKey(data, Key.escape)) {
            done(null);
          }
        },

        invalidate(): void {},
      };
    });

    if (!answer) {
      ctx.ui.notify("已跳过 Q&A", "info");
      return;
    }

    answers.push({ question: item.question, answer });
  }

  // 4. 汇总填入编辑器
  const result =
    "### Q&A 汇总\n\n" +
    answers.map(({ question, answer }) => `**Q: ${question}**\nA: ${answer}`).join("\n\n") +
    "\n\n---\n提交后 AI 将根据你的回答继续处理。";

  ctx.ui.setEditorText(result);
  ctx.ui.notify(`已汇总 ${answers.length} 个问题，编辑后提交即可`, "info");
}

// ========== 辅助函数 ==========

/** 从 session 中取最后一条 assistant 消息的文本 */
function getLastAssistantText(ctx: ExtensionContext): string | undefined {
  const branch = ctx.sessionManager.getBranch();
  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i];
    if (entry.type === "message") {
      const msg = entry.message;
      if ("role" in msg && msg.role === "assistant") {
        if (msg.stopReason !== "stop") return undefined;
        const parts = msg.content
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((c) => c.text);
        if (parts.length > 0) return parts.join("\n");
      }
    }
  }
  return undefined;
}

/** 快速检查文本中是否包含问号 */
function hasQuestionMark(text: string): boolean {
  return /[？?]/.test(text);
}

/** 简单哈希，用于消息去重 */
function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

/** 解析 [Q]/[O] 格式文本 */
function parseQuestions(text: string): QItem[] {
  const lines = text.split("\n");
  const result: QItem[] = [];
  let current: QItem | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const qMatch = line.match(/^\[Q\]\s*(.+)$/);
    const oMatch = line.match(/^\[O\]\s*(.+)$/);
    const noneMatch = line.match(/^\[NONE\]$/);

    if (noneMatch) return [];
    if (qMatch) {
      current = { question: qMatch[1]!, options: [] };
      result.push(current);
    } else if (oMatch && current) {
      current.options.push(oMatch[1]!);
    }
  }

  return result.filter((q) => q.options.length > 0);
}
