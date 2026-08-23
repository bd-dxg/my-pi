import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { IconMode } from "./icons.ts";
import { installFooter, invalidateUsageCache, type FooterState } from "./footer.ts";

const iconMode: IconMode = "auto";

export default function (pi: ExtensionAPI): void {
	const state: FooterState = {
		workingSince: undefined,
		lastDoneIn: undefined,
	};

	let activeFooterCleanup: (() => void) | undefined;
	let requestRender: (() => void) | undefined;
	let workingTimer: ReturnType<typeof setInterval> | undefined;
	let lastCtx: ExtensionContext | undefined;

	function scheduleRender() {
		requestRender?.();
	}

	const startWorkingTimer = () => {
		stopWorkingTimer();
		const tick = () => {
			requestRender?.();
		};
		tick();
		workingTimer = setInterval(tick, 250);
		workingTimer.unref?.();
	};

	const stopWorkingTimer = () => {
		if (workingTimer) {
			clearInterval(workingTimer);
			workingTimer = undefined;
		}
	};

	// 当 TUI 上下文就绪后安装 footer
	function applyFooter(ctx: ExtensionContext) {
		if (!ctx.hasUI || ctx.mode !== "tui") return;
		if (activeFooterCleanup) return;
		activeFooterCleanup = installFooter(ctx, state, iconMode, (fn) => {
			requestRender = fn ?? undefined;
		});
	}

	function removeFooter(ctx: ExtensionContext) {
		if (!activeFooterCleanup) return;
		activeFooterCleanup();
		activeFooterCleanup = undefined;
	}

	// ── 生命周期事件 ──

	pi.on("session_start", async (_event, ctx) => {
		lastCtx = ctx;
		state.workingSince = undefined;
		state.lastDoneIn = undefined;
		invalidateUsageCache();
		applyFooter(ctx);
		scheduleRender();
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		stopWorkingTimer();
		removeFooter(ctx);
		lastCtx = undefined;
	});

	pi.on("agent_start", () => {
		state.workingSince = Date.now();
		state.lastDoneIn = undefined;
		startWorkingTimer();
	});

	pi.on("agent_end", () => {
		stopWorkingTimer();
		if (state.workingSince !== undefined) {
			state.lastDoneIn = Date.now() - state.workingSince;
			state.workingSince = undefined;
		}
		scheduleRender();
	});

	pi.on("model_select", () => { scheduleRender(); });
	pi.on("thinking_level_select", () => { scheduleRender(); });
	pi.on("message_end", () => {
		invalidateUsageCache();
		scheduleRender();
	});
	pi.on("tool_execution_end", () => { scheduleRender(); });
	pi.on("session_compact", () => {
		invalidateUsageCache();
		scheduleRender();
	});
	pi.on("session_tree", () => {
		invalidateUsageCache();
		scheduleRender();
	});
}

export type { IconMode } from "./icons.ts";
export { type FooterState, type UsageTotals, type ModelMeta } from "./footer.ts";