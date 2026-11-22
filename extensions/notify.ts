/**
 * notify — 桌面通知扩展（Windows Toast）
 *
 * 在「Pi 需要你」的两个时刻弹一条 Windows 系统通知：
 *   - agent_settled   ：一轮跑完、等你下一条消息，正文带最后一段回复摘要
 *   - ui_prompt_start ：弹出选择 / 确认 / 输入框等你点（含 ask_user_question）
 *
 * 设计要点：
 *   - 只在 Windows + TUI 模式生效，其它情况静默跳过
 *   - 前台窗口属于 pi 自身的祖先进程（同一个 VS Code / Windows Terminal / 终端）
 *     时静默：你人在键盘前就不打扰。判定在 PowerShell 侧做，Node 不参与
 *   - 每次通知起一个隐藏窗口的 powershell.exe（-EncodedCommand，绕开引号地狱），
 *     不阻塞主线程，失败静默
 *
 * 关于通知归属（踩过的坑，实测数据）：Windows 11 只投递 AppUserModelID「本机已注册」
 * 的 Toast，其余一律静默丢弃（Show() 不报错、通知中心也不出现）：
 *   ✗ Microsoft.Windows.PowerShell  未投递（键都不创建）
 *   ✗ Pi.Notify                     注册前未投递
 *   ✓ Pi.Notify                     注册后投递，归属显示「Pi」+ 自定义图标
 *   ✓ Microsoft.VisualStudioCode    稳定投递（有开始菜单快捷方式）
 *   ✓ Microsoft.WindowsTerminal_8wekyb3d8bbwe!App  稳定投递
 * 现在用 Pi.Notify：归属名靠 HKCU 下两个值（DisplayName/IconUri），**实测只需注册表、不需要快捷方式**：
 *   HKCU\Software\Classes\AppUserModelId\Pi.Notify
 *     DisplayName = Pi
 *     IconUri     = %USERPROFILE%\.pi\agent\notify-icon.png
 * 但光靠这两个值**图标不会显示**（Shell 的 AppsFolder 里没有该 AUMID，解析不到图标）——
 * 图标改用 Toast 自带的 appLogoOverride 声明（见 buildToastScript），实测可靠，也不依赖任何注册。
 * 换机器 / 被删掉后重新注册（改回 VS Code 归属：删键 + 把 AUMID 改成 Microsoft.VisualStudioCode）：
 *   reg add "HKCU\Software\Classes\AppUserModelId\Pi.Notify" /v DisplayName /t REG_SZ /d Pi /f
 *   reg add "HKCU\Software\Classes\AppUserModelId\Pi.Notify" /v IconUri /t REG_SZ /d "%USERPROFILE%\.pi\agent\notify-icon.png" /f
 *
 * 第二个坑：ToastGeneric 模板里的 <text> 不能带 id 属性（那是旧模板 ToastText02 的写法）。
 * 带了不会报错、也能投递，但 Win11 渲染失败会退成「<应用名> / 新通知」占位内容——
 * 实测：带 id 的两条显示为占位；去掉 id 的同一条正文、以及官方 ToastText02 都正常显示。
 *
 * 配置：%PI_CODING_AGENT_DIR%/notify.json（默认 ~/.pi/agent/notify.json，可选）
 *   {
 *     "enabled": true,          // 总开关
 *     "onComplete": true,       // 一轮跑完通知
 *     "onPrompt": true,         // 等你选择时通知
 *     "skipWhenFocused": true,  // 前台是 pi 所在终端时静默
 *     "summaryLength": 120      // 摘要字数上限
 *   }
 *
 * 命令：/notify 查看状态 · /notify on · /notify off · /notify test
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

interface NotifyConfig {
  enabled: boolean;
  onComplete: boolean;
  onPrompt: boolean;
  skipWhenFocused: boolean;
  summaryLength: number;
}

const DEFAULTS: NotifyConfig = {
  enabled: true,
  onComplete: true,
  onPrompt: true,
  skipWhenFocused: true,
  summaryLength: 120,
};

const AGENT_DIR = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
const CONFIG_PATH = join(AGENT_DIR, "notify.json");

/** 通知左侧图标：由 Toast 自己声明（appLogoOverride），不依赖 Shell 注册；文件不存在就自动省掉 */
const ICON_PATH = join(AGENT_DIR, "notify-icon.png");

/** Toast 归属 AUMID（已在 HKCU 注册为「Pi」）；换成未注册的名字会静默失效 */
const AUMID = "Pi.Notify";

function loadConfig(): NotifyConfig {
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Partial<NotifyConfig>;
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveConfig(config: NotifyConfig): void {
  try {
    writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  } catch {
    // 配置写不进去不影响通知本身
  }
}

/** 转成 PowerShell 单引号字符串（单引号翻倍转义），顺带压掉换行 */
function psQuote(value: string): string {
  return `'${value.replace(/[\r\n]+/g, " ").replace(/'/g, "''")}'`;
}

/** 生成一次性 Toast 脚本；导出仅供本地调试（pi 只读 default 导出） */
export function buildToastScript(
  title: string,
  body: string,
  skipWhenFocused: boolean,
): string {
  // Toast 自带图标声明，不依赖 Shell 的 AUMID→图标解析（实测靠它才能出图）
  const icon = existsSync(ICON_PATH)
    ? `<image placement='appLogoOverride' hint-crop='circle' src='file:///${ICON_PATH.replace(/\\/g, "/").replace(/["'<>&]/g, "")}'/>`
    : "";
  return `
$ErrorActionPreference = 'Stop'
$Title = ${psQuote(title)}
$Body = ${psQuote(body)}
$SkipWhenFocused = ${skipWhenFocused ? "$true" : "$false"}

# 前台窗口属于 pi 自身的祖先进程（同一个终端 / IDE）时返回 $true；判定失败一律当 $false（宁可多弹一条）
function Test-PiForeground {
  try {
    $sig = '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);'
    Add-Type -Namespace PiNotify -Name Native -MemberDefinition $sig
    $fg = 0
    [void][PiNotify.Native]::GetWindowThreadProcessId([PiNotify.Native]::GetForegroundWindow(), [ref]$fg)
    if ($fg -le 0) { return $false }
    $parent = @{}
    $name = @{}
    foreach ($p in Get-CimInstance Win32_Process -Property ProcessId, ParentProcessId, Name) {
      $id = [int]$p.ProcessId
      $parent[$id] = [int]$p.ParentProcessId
      $name[$id] = [string]$p.Name
    }
    $cur = $PID
    for ($i = 0; $i -lt 32; $i++) {
      # 走到桌面 / 系统进程就停：它们不是终端，不能因为当前台是资源管理器就静默
      if ($name[$cur] -in @('explorer.exe', 'wininit.exe', 'services.exe')) { return $false }
      if ($cur -eq $fg) { return $true }
      if (-not $parent.ContainsKey($cur)) { return $false }
      $next = $parent[$cur]
      if ($next -le 0 -or $next -eq $cur) { return $false }
      $cur = $next
    }
    return $false
  } catch {
    return $false
  }
}

if ($SkipWhenFocused -and (Test-PiForeground)) { exit 0 }

try {
  # WinRT 投影类型要先加载，否则 New-Object 找不到类型
  [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
  [Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
  [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime] > $null
  $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
  # 注意：ToastGeneric 的 <text> 不能带 id 属性，带了会让 Win11 退成「新通知」占位（见文件头）
  $xml.LoadXml("<toast duration='short'><visual><binding template='ToastGeneric'>${icon}<text/><text/></binding></visual><audio src='ms-winsoundevent:Notification.Default'/></toast>")
  $texts = $xml.GetElementsByTagName('text')
  [void]$texts.Item(0).AppendChild($xml.CreateTextNode($Title))
  [void]$texts.Item(1).AppendChild($xml.CreateTextNode($Body))
  # 借已注册的 AUMID 投递，否则 Win11 会静默丢弃未注册来源的 Toast（详见文件头）
  $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${AUMID}')
  $notifier.Show((New-Object Windows.UI.Notifications.ToastNotification $xml))
  exit 0
} catch {
  exit 1
}
`;
}

function sendToast(title: string, body: string, skipWhenFocused: boolean): void {
  if (process.platform !== "win32") return;
  const encoded = Buffer.from(
    buildToastScript(title, body, skipWhenFocused),
    "utf16le",
  ).toString("base64");
  try {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
      { windowsHide: true, stdio: "ignore" },
    );
    child.on("error", () => {});
    child.unref();
  } catch {
    // 通知失败不影响 pi
  }
}

/** Markdown 压成一行纯文本：代码块丢掉，链接留文字，去掉标记符 */
function cleanText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}[-*+]\s+/gm, "")
    .replace(/[*_>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 取当前分支上最后一条带文字的助手消息，作为「发生了什么」的摘要 */
function lastAssistantSummary(ctx: ExtensionContext, max: number): string | undefined {
  const branch = ctx.sessionManager.getBranch();
  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i];
    if (entry.type !== "message" || entry.message.role !== "assistant") continue;
    const content = entry.message.content;
    if (!Array.isArray(content)) return undefined;
    const text = cleanText(
      content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join(" "),
    );
    if (!text) return undefined;
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }
  return undefined;
}

const PROMPT_LABEL: Record<string, string> = {
  select: "选一个选项",
  confirm: "确认一下",
  input: "补充一行输入",
  editor: "编辑内容",
  custom: "需要你的操作",
};

export default function notifyExtension(pi: ExtensionAPI) {
  function configFor(ctx: ExtensionContext): NotifyConfig | undefined {
    if (ctx.mode !== "tui") return undefined; // 打印 / JSON / RPC 模式不弹桌面通知
    const config = loadConfig();
    return config.enabled ? config : undefined;
  }

  // 一轮完整跑完（不会自动重试 / 继续），此时才真的在等你
  pi.on("agent_settled", async (event, ctx) => {
    const config = configFor(ctx);
    if (!config?.onComplete || event.aborted) return;
    const summary = lastAssistantSummary(ctx, config.summaryLength);
    sendToast("Pi 已完成", summary ?? "已完成，等待你的指示", config.skipWhenFocused);
  });

  // 弹出选择 / 确认 / 输入框，卡在等你点
  pi.on("ui_prompt_start", async (event, ctx) => {
    const config = configFor(ctx);
    if (!config?.onPrompt) return;
    const label = PROMPT_LABEL[event.kind] ?? "需要你的操作";
    sendToast("Pi 等待你的回复", event.title ? `${label}：${event.title}` : label, config.skipWhenFocused);
  });

  pi.registerCommand("notify", {
    description: "桌面通知：查看状态 / on / off / test",
    handler: async (args, ctx) => {
      const cmd = args.trim().toLowerCase();
      const config = loadConfig();
      if (cmd === "on" || cmd === "off") {
        config.enabled = cmd === "on";
        saveConfig(config);
        ctx.ui.notify(`桌面通知已${config.enabled ? "开启" : "关闭"}`, "info");
        return;
      }
      if (cmd === "test") {
        sendToast("Pi 通知测试", "看到这条通知就说明配置生效", false);
        ctx.ui.notify("已发送测试通知（忽略前台判定）", "info");
        return;
      }
      ctx.ui.notify(
        `通知${config.enabled ? "开" : "关"}｜任务结束${config.onComplete ? "通知" : "静默"}` +
          `｜等待选择${config.onPrompt ? "通知" : "静默"}｜前台静默${config.skipWhenFocused ? "开" : "关"}`,
        "info",
      );
    },
  });
}
