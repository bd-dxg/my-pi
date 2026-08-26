/**
 * 自定义 Footer — 移植自 pi-open-tui
 *
 * 两行布局：
 *   Line 1: 左(cwd/会话/working 计时器) + 右(context 进度条)
 *   Line 2: 左(model/effort) + 右(token 统计/成本)
 *   可选额外行：扩展状态
 */

import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import type { IconGlyphs, IconMode } from "./icons.ts";
import { resolveGlyphs, resolveIconMode } from "./icons.ts";
import {
	alignRight,
	basenamePath,
	cacheHitColor,
	effortColor,
	fitSegmentsByPriority,
	fmtTokens,
	formatCwd,
	formatDuration,
	providerColor,
	sanitizeStatus,
	stressColor,
	truncatePath,
	type PrioritizedSegment,
} from "./utils.ts";

// ── Context 进度条 ──

function renderBar(theme: Theme, pct: number, barWidth: number, ascii: boolean): string {
	const filled = Math.max(0, Math.min(barWidth, Math.round((pct / 100) * barWidth)));
	const empty = barWidth - filled;
	const color = stressColor(pct);
	const filledCell = ascii ? "#" : "█";
	const emptyCell = ascii ? "-" : "░";
	return (
		theme.fg("dim", "[") +
		theme.fg(color, filledCell.repeat(filled)) +
		theme.fg("dim", emptyCell.repeat(empty)) +
		theme.fg("dim", "]")
	);
}

function renderContextCompact(theme: Theme, ctx: ExtensionContext, glyphs: IconGlyphs): string {
	const contextUsage = ctx.getContextUsage();
	const contextWindow = contextUsage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
	if (contextWindow <= 0) return "";
	const contextPct = contextUsage?.percent ?? 0;
	return `${theme.fg(stressColor(contextPct), glyphs.context)} ${theme.fg(stressColor(contextPct), `${contextPct.toFixed(1)}%`)}`;
}

function renderContextBar(
	theme: Theme,
	ctx: ExtensionContext,
	width: number,
	glyphs: IconGlyphs,
	iconMode: IconMode,
): string {
	const contextUsage = ctx.getContextUsage();
	const contextWindow = contextUsage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
	const contextTokens = contextUsage?.tokens ?? 0;
	const contextPct = contextUsage?.percent ?? 0;

	if (contextWindow <= 0) return "";

	const pctText = theme.fg(stressColor(contextPct), `${contextPct.toFixed(1)}%`);
	const ctxText = `${theme.fg("text", fmtTokens(contextTokens))}${theme.fg("dim", "/")}${theme.fg("text", fmtTokens(contextWindow))}`;
	const contextIcon = theme.fg(stressColor(contextPct), glyphs.context);
	const reserved = visibleWidth(contextIcon) + visibleWidth(pctText) + visibleWidth(ctxText) + 5 + 2;
	const barWidth = Math.max(4, Math.min(12, width - reserved));
	return `${contextIcon} ${renderBar(theme, contextPct, barWidth, resolveIconMode(iconMode) === "ascii")} ${pctText} ${theme.fg("dim", "·")} ${ctxText}`;
}

// ── 计时器 ──

function renderTimerSegment(theme: Theme, state: FooterState, glyphs: IconGlyphs): string {
	if (state.workingSince !== undefined) {
		return `${theme.fg("accent", glyphs.working)} ${theme.fg("dim", "working")} ${theme.fg("accent", formatDuration(Date.now() - state.workingSince))}`;
	}
	if (state.lastDoneIn !== undefined) {
		return `${theme.fg("success", glyphs.done)} ${theme.fg("success", "done")} ${theme.fg("text", formatDuration(state.lastDoneIn))}`;
	}
	return "";
}

// ── Token/成本统计块 ──

function renderStatsBlock(
	theme: Theme,
	totals: UsageTotals,
	glyphs: IconGlyphs,
): string {
	const stats: string[] = [];
	stats.push(theme.fg("accent", `${glyphs.input} ${fmtTokens(totals.input)}`));
	stats.push(theme.fg("success", `${glyphs.output} ${fmtTokens(totals.output)}`));
	const hasCacheTokens = totals.cacheRead > 0 || totals.cacheWrite > 0;
	if (hasCacheTokens && totals.latestCacheHitRate !== undefined) {
		stats.push(theme.fg(cacheHitColor(totals.latestCacheHitRate), `${glyphs.cacheHit} ${totals.latestCacheHitRate.toFixed(1)}%`));
	}
	stats.push(theme.fg("warning", `${glyphs.cost}${totals.cost.toFixed(2)}`));
	return stats.join(` ${theme.fg("dim", "|")} `);
}

// ── 扩展状态行 ──

function renderExtensionStatusLines(
	theme: Theme,
	extensionStatuses: ReadonlyMap<string, string>,
	glyphs: IconGlyphs,
	width: number,
): string[] {
	const statuses = Array.from(extensionStatuses.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([, text]) => sanitizeStatus(text))
		.filter((text) => text.length > 0);
	if (statuses.length === 0) return [];

	const separator = ` ${theme.fg("dim", "|")} `;
	const statusText = statuses.map((status) => theme.fg("muted", status)).join(separator);
	const line = `${theme.fg("mdLink", glyphs.extensions)} ${statusText}`;
	return wrapTextWithAnsi(line, width);
}

// ── 状态类型 ──

export interface FooterState {
	workingSince: number | undefined;
	lastDoneIn: number | undefined;
}

export interface UsageTotals {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	latestCacheHitRate: number | undefined;
}

export interface ModelMeta {
	provider: string;
	model: string;
	effort: string | undefined;
}

// usage 缓存

let usageCache: { key: string; totals: UsageTotals } | undefined;

function entriesKey(ctx: ExtensionContext): string {
	const entries = ctx.sessionManager.getEntries();
	const last = entries.at(-1);
	return `${entries.length}:${last?.id ?? ""}:${last?.timestamp ?? ""}`;
}

function getUsageTotals(ctx: ExtensionContext): UsageTotals {
	const key = entriesKey(ctx);
	if (usageCache && usageCache.key === key) return usageCache.totals;

	const totals: UsageTotals = {
		input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0,
		latestCacheHitRate: undefined,
	};
	for (const entry of ctx.sessionManager.getEntries()) {
		if (entry.type === "message" && entry.message?.role === "assistant") {
			const m = entry.message as AssistantMessage;
			const u = m.usage;
			if (!u) continue;
			totals.input += u.input ?? 0;
			totals.output += u.output ?? 0;
			totals.cacheRead += u.cacheRead ?? 0;
			totals.cacheWrite += u.cacheWrite ?? 0;
			totals.cost += u.cost?.total ?? 0;
			const promptTokens = (u.input ?? 0) + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0);
			if (promptTokens > 0) {
				totals.latestCacheHitRate = ((u.cacheRead ?? 0) / promptTokens) * 100;
			}
		}
	}
	usageCache = { key, totals };
	return totals;
}

function invalidateUsageCache(): void {
	usageCache = undefined;
}

function getModelMeta(ctx: ExtensionContext): ModelMeta {
	const provider = ctx.model?.provider
		? ctx.model.provider.charAt(0).toUpperCase() + ctx.model.provider.slice(1)
		: "Unknown";
	const model = ctx.model?.name ?? ctx.model?.id ?? "no-model";
	const reasoning = ctx.model?.reasoning ?? false;
	const effort = reasoning ? ctx.thinkingLevel ?? "off" : undefined;
	return { provider, model, effort };
}

// ── 安装函数 ──

export { invalidateUsageCache, getModelMeta };

export function installFooter(
	ctx: ExtensionContext,
	state: FooterState,
	iconMode: IconMode,
	setRequestRender?: (fn: (() => void) | undefined) => void,
): () => void {
	ctx.ui.setFooter((tui, theme, footerData) => {
		setRequestRender?.(() => tui.requestRender());
		const unsubBranch = footerData.onBranchChange(() => {
			tui.requestRender();
		});
		return {
			dispose() {
				unsubBranch();
				setRequestRender?.(undefined);
			},
			invalidate() {},
			render(width: number): string[] {
				if (width <= 0) return [""];
				const glyphs = resolveGlyphs(iconMode);
				const totals = getUsageTotals(ctx);
				const meta = getModelMeta(ctx);

				// ── Line 1: left(shared) + right(context bar) ──

				const leftParts: PrioritizedSegment[] = [];

				// cwd
				const maxCwd = Math.min(30, Math.max(10, Math.floor(width * 0.4)));
				const cwd = formatCwd(ctx.sessionManager.getCwd());
				const cwdPrefix = `${theme.fg("mdLink", glyphs.cwd)} `;
				const accent = (text: string) => theme.fg("accent", text);
				leftParts.push({
					text: `${cwdPrefix}${accent(truncatePath(cwd, maxCwd))}`,
					compactText: `${cwdPrefix}${accent(truncatePath(basenamePath(cwd), maxCwd))}`,
					priority: 0,
					truncate: (_text: string, maxWidth: number, ellipsis: string) => {
						const pathWidth = maxWidth - visibleWidth(cwdPrefix);
						if (pathWidth <= visibleWidth(ellipsis)) {
							return truncateToWidth(`${cwdPrefix}${accent(basenamePath(cwd))}`, maxWidth, ellipsis);
						}
						return `${cwdPrefix}${accent(truncatePath(basenamePath(cwd), pathWidth))}`;
					},
				});

				// session name
				const sessionName = ctx.sessionManager.getSessionName();
				if (sessionName) {
					leftParts.push({
						text: `${theme.fg("dim", glyphs.session)} ${theme.fg("text", truncateToWidth(sessionName, 24, theme.fg("dim", "...")))}`,
						priority: 2,
					});
				}

				// working timer
				const timerSeg = renderTimerSegment(theme, state, glyphs);
				if (timerSeg) {
					leftParts.push({ text: timerSeg, priority: 1 });
				}

				// context bar — separate, rendered right-aligned
				let contextText = "";
				let contextCompact: string | undefined;
				contextText = renderContextBar(theme, ctx, width, glyphs, iconMode);
				const compact = renderContextCompact(theme, ctx, glyphs);
				if (compact && visibleWidth(compact) < visibleWidth(contextText)) {
					contextCompact = compact;
				}
				const allParts: PrioritizedSegment[] = [...leftParts];
				if (contextText) {
					allParts.push({ text: contextText, compactText: contextCompact, priority: 4 });
				}

				const fitted = fitSegmentsByPriority(allParts, width, theme.fg("dim", "..."));
				const fittedContext = contextText ? fitted.pop() ?? "" : "";
				const line1 = alignRight(fitted.join(" "), fittedContext, width, theme);

				// ── Line 2: model info + stats ──

				const modelParts: string[] = [];
				modelParts.push(`${theme.fg("mdLink", glyphs.model)} ${theme.fg(providerColor(ctx.model?.provider ?? "none"), meta.provider)}`);
				modelParts.push(theme.fg("text", meta.model));
				if (meta.effort && meta.effort !== "off") {
					modelParts.push(theme.fg(effortColor(meta.effort), `${glyphs.thinking} ${meta.effort}`));
				}
				const modelBlock = modelParts.join(theme.fg("dim", " · "));
				const statsBlock = renderStatsBlock(theme, totals, glyphs);
				const line2 = alignRight(modelBlock, statsBlock, width, theme);

				const mainLines = [line1, line2]
					.map((line) => truncateToWidth(line, width, theme.fg("dim", "...")));

				return [
					...mainLines,
					...renderExtensionStatusLines(
						theme,
						footerData.getExtensionStatuses(),
						glyphs,
						width,
					),
				];
			},
		};
	});

	return () => {
		ctx.ui.setFooter(undefined);
	};
}