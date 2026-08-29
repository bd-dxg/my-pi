/**
 * 图标定义 — 移植自 pi-open-tui
 * 支持 Nerd Font / ASCII 自动切换
 */

export type IconMode = "auto" | "nerd" | "ascii";

export interface IconGlyphs {
	cwd: string;
	session: string;
	working: string;
	done: string;
	context: string;
	model: string;
	thinking: string;
	input: string;
	output: string;
	cacheHit: string;
	cost: string;
	extensions: string;
	gitBranch: string;
	gitStatus: string;
	gitAhead: string;
	gitBehind: string;
	gitDiverged: string;
	gitConflicted: string;
	gitStashed: string;
	gitModified: string;
	gitStaged: string;
	gitUntracked: string;
	gitRenamed: string;
	gitDeleted: string;
}

const NERD_GLYPHS: IconGlyphs = {
	cwd: " ",
	session: "",
	working: "",
	done: "",
	context: "",
	model: " ",
	thinking: "",
	input: "",
	output: "",
	cacheHit: "",
	cost: "￥",
	extensions: "",
	gitBranch: "",
	gitStatus: "",
	gitAhead: "↑",
	gitBehind: "↓",
	gitDiverged: "⇕",
	gitConflicted: "=",
	gitStashed: "$",
	gitModified: "!",
	gitStaged: "+",
	gitUntracked: "?",
	gitRenamed: "»",
	gitDeleted: "✘",
};

const ASCII_GLYPHS: IconGlyphs = {
	cwd: "@",
	session: "s",
	working: "o",
	done: "+",
	context: "#",
	model: "☁",
	thinking: "~",
	input: "↑",
	output: "↓",
	cacheHit: "c",
	cost: "￥",
	extensions: "&",
	gitBranch: "*",
	gitStatus: "*",
	gitAhead: "^",
	gitBehind: "v",
	gitDiverged: "^v",
	gitConflicted: "=",
	gitStashed: "S",
	gitModified: "!",
	gitStaged: "A",
	gitUntracked: "?",
	gitRenamed: "r",
	gitDeleted: "x",
};

const NERD_FONT_TERMINALS = new Set([
	"iTerm.app",
	"Ghostty",
	"WezTerm",
	"kitty",
	"rio",
	"tabby",
	"WindowsTerminal",
	"vscode",
]);

export function detectNerdFont(): boolean {
	const termProgram = process.env.TERM_PROGRAM;
	if (termProgram && NERD_FONT_TERMINALS.has(termProgram)) return true;

	const lcTerminal = process.env.LC_TERMINAL;
	if (lcTerminal && NERD_FONT_TERMINALS.has(lcTerminal)) return true;

	if (process.env.TERM === "xterm-kitty") return true;
	if (process.env.WT_SESSION) return true;
	if (process.env.TERM_PROGRAM === "vscode") return true;

	return false;
}

export function resolveIconMode(mode: IconMode): "nerd" | "ascii" {
	if (mode === "nerd") return "nerd";
	if (mode === "ascii") return "ascii";
	return detectNerdFont() ? "nerd" : "ascii";
}

export function resolveGlyphs(mode: IconMode): IconGlyphs {
	return resolveIconMode(mode) === "nerd" ? NERD_GLYPHS : ASCII_GLYPHS;
}
