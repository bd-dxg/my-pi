/**
 * 工具函数 — 移植自 pi-open-tui
 */

import { isAbsolute, relative, resolve, sep } from "node:path";
import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

export { truncateToWidth, visibleWidth };

export function formatCwd(cwd: string): string {
	const home = process.env.HOME || process.env.USERPROFILE;
	if (!home) return cwd;
	const resolvedCwd = resolve(cwd);
	const resolvedHome = resolve(home);
	const rel = relative(resolvedHome, resolvedCwd);
	const insideHome =
		rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
	if (!insideHome) return cwd;
	return rel === "" ? "~" : `~${sep}${rel}`;
}

export function basenamePath(path: string): string {
	return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

export function truncateBranch(branch: string, maxLen: number): string {
	if (branch.length <= maxLen) return branch;
	if (maxLen <= 3) return "...".slice(0, maxLen);
	return `${branch.slice(0, maxLen - 3)}...`;
}

export function truncatePath(path: string, maxLen: number): string {
	if (path.length <= maxLen) return path;
	if (maxLen <= 3) return "...".slice(0, maxLen);
	const sepChar = path.includes("/") ? "/" : "\\";
	const parts = path.split(/[\\/]/);
	if (parts.length <= 2) return path.slice(0, maxLen - 3) + "...";
	const tail: string[] = [];
	let tailLen = 0;
	for (let i = parts.length - 1; i >= 1; i--) {
		const seg = parts[i]!;
		if (tailLen + seg.length + 4 > maxLen) break;
		tail.unshift(seg);
		tailLen += seg.length + 1;
	}
	const head = parts[0]!;
	const result = `${head}${sepChar}...${sepChar}${tail.join(sepChar)}`;
	return result.length > maxLen ? result.slice(0, maxLen - 3) + "..." : result;
}

export function fmtTokens(n: number): string {
	if (n < 1000) return n.toString();
	if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
	if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
	if (n < 10_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	return `${Math.round(n / 1_000_000)}M`;
}

export function formatDuration(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	if (totalSeconds < 60) return `${totalSeconds}s`;
	const s = totalSeconds % 60;
	const totalMinutes = Math.floor(totalSeconds / 60);
	if (totalMinutes < 60) return `${totalMinutes}m ${s}s`;
	const m = totalMinutes % 60;
	const h = Math.floor(totalMinutes / 60);
	return `${h}h ${m}m ${s}s`;
}

export function alignRight(left: string, right: string, width: number, theme: Theme): string {
	const rightW = visibleWidth(right);
	if (rightW > width) {
		right = truncateToWidth(right, width, theme.fg("dim", "..."));
	}
	const leftW = visibleWidth(left);
	const rightW2 = visibleWidth(right);
	const pad = width - leftW - rightW2;
	if (pad >= 1) {
		return left + " ".repeat(pad) + right;
	}
	const availableForLeft = Math.max(0, width - rightW2 - 1);
	const truncatedLeft =
		availableForLeft > 0 ? truncateToWidth(left, availableForLeft, theme.fg("dim", "...")) : "";
	return truncatedLeft ? truncatedLeft + " " + right : right;
}

export type PrioritizedSegment = {
	text: string;
	priority: number;
	/** Compact form swapped in before truncation/drop. */
	compactText?: string;
	/** Segment-aware truncation. */
	truncate?: (text: string, maxWidth: number, ellipsis: string) => string;
};

/** Pack segments into maxWidth: compact first, then shrink/drop low priority. */
export function fitSegmentsByPriority(
	segs: readonly PrioritizedSegment[],
	maxW: number,
	ellipsis = "...",
): string[] {
	const items = segs.map((s) => ({
		text: s.text,
		compactText: s.compactText,
		priority: s.priority,
		truncate: s.truncate,
		w: visibleWidth(s.text),
	}));
	const totalW = () => {
		const active = items.filter((it) => it.text !== "");
		return active.reduce((a, it) => a + it.w, 0) + Math.max(0, active.length - 1);
	};
	// Compact before sacrificing
	if (totalW() > maxW) {
		for (const item of items) {
			if (!item.compactText || visibleWidth(item.compactText) >= item.w) continue;
			item.text = item.compactText;
			item.w = visibleWidth(item.text);
			if (totalW() <= maxW) break;
		}
	}
	while (totalW() > maxW) {
		let target = -1;
		for (let i = 0; i < items.length; i++) {
			if (items[i].text !== "" && (target === -1 || items[i].priority < items[target].priority)) {
				target = i;
			}
		}
		if (target === -1) break;
		const others = items.filter((_, i) => i !== target && items[i].text !== "");
		const otherW = others.reduce((a, it) => a + it.w, 0) + Math.max(0, others.length - 1);
		const avail = maxW - otherW - (others.length > 0 ? 1 : 0);
		if (avail <= visibleWidth(ellipsis)) {
			items[target].text = "";
			items[target].w = 0;
		} else if (avail < items[target].w) {
			const truncate = items[target].truncate;
			items[target].text = truncate
				? truncate(items[target].text, avail, ellipsis)
				: truncateToWidth(items[target].text, avail, ellipsis);
			items[target].w = visibleWidth(items[target].text);
		} else {
			break;
		}
	}
	return items.filter((it) => it.text !== "").map((it) => it.text);
}

export function stressColor(value: number, warn = 70, danger = 90): ThemeColor {
	if (value >= danger) return "error";
	if (value >= warn) return "warning";
	return "accent";
}

export function cacheHitColor(value: number): ThemeColor {
	if (value < 30) return "error";
	if (value < 70) return "warning";
	return "success";
}

export function providerColor(provider: string): ThemeColor {
	switch (provider.toLowerCase()) {
		case "anthropic":
			return "accent";
		case "openai":
		case "openai-codex":
			return "success";
		case "google":
		case "google-vertex":
			return "warning";
		case "amazon-bedrock":
			return "thinkingHigh";
		case "github-copilot":
			return "mdLink";
		case "deepseek":
			return "thinkingLow";
		case "xai":
		case "groq":
			return "error";
		default:
			return "muted";
	}
}

export function effortColor(level: string | undefined): ThemeColor {
	switch (level) {
		case "minimal":
			return "thinkingMinimal";
		case "low":
			return "thinkingLow";
		case "medium":
			return "thinkingMedium";
		case "high":
			return "thinkingHigh";
		case "xhigh":
			return "thinkingXhigh";
		default:
			return "thinkingMedium";
	}
}

export function sanitizeStatus(text: string): string {
	return text
		.replace(/\x1b\[[0-9;]*m/g, "")
		.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
		.replace(/ +/g, " ")
		.trim();
}