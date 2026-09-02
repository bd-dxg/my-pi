# check-updates.ps1
# skill-monitor 自动检查脚本（供 Windows 计划任务或手动调用）
# 读取 ~/.skill-monitor/monitor.json，对每条 watch 用 GitHub API 对比 blob sha，
# 发现变化则下载新版本、生成变更摘要报告（reports/<日期>/<watch-id>.md），
# 并更新 monitor.json 中的 sha 记录。
#
# 用法: powershell -NoProfile -ExecutionPolicy Bypass -File check-updates.ps1

$ErrorActionPreference = 'Stop'
$DataDir    = Join-Path $env:USERPROFILE '.skill-monitor'
$Manifest   = Join-Path $DataDir 'monitor.json'
$ReportsDir = Join-Path $DataDir 'reports'
$LogsDir    = Join-Path $DataDir 'logs'

# 日志路径：logs/check-<日期>.log
New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null
$LogFile = Join-Path $LogsDir ("check-" + (Get-Date -Format 'yyyy-MM-dd') + ".log")

function Log-Write {
    param([string]$Msg)
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Msg"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    Write-Host $Msg
}

if (-not (Test-Path $Manifest)) {
    Log-Write "monitor.json 不存在（$Manifest），跳过检查"
    exit 0
}

# 确保报告目录存在
New-Item -ItemType Directory -Force -Path $ReportsDir | Out-Null

Log-Write '=== skill-monitor 检查开始 ==='

# ---------- 网络就绪检测 ----------
# 计划任务可能开机后立即运行而网络未就绪；探测失败则每 60 秒重试，最多 6 次（约 5 分钟）
function Wait-NetworkReady {
    $maxAttempts = 6
    $attempt = 0
    while ($attempt -lt $maxAttempts) {
        try {
            # PS 5.1 非交互模式下 Invoke-WebRequest 会抛空引用异常，改用 Invoke-RestMethod
            Invoke-RestMethod -Uri 'https://api.github.com' `
                -Headers @{ 'User-Agent' = 'skill-monitor' } -TimeoutSec 10 | Out-Null
            return $true
        }
        catch {
            # 有 Response 说明服务器已响应（如 403 限速），视为网络通；无 Response 才是网络不通
            if ($_.Exception.Response) { return $true }
            $attempt++
            if ($attempt -lt $maxAttempts) {
                Log-Write "网络未就绪（第 $attempt 次尝试失败），60 秒后重试..."
                Start-Sleep -Seconds 60
            }
        }
    }
    Log-Write '网络探测失败，跳过本次检查'
    return $false
}

# ---------- GitHub API 辅助函数 ----------

function Invoke-GitHubApi {
    param([string]$Url)
    $headers = @{ 'User-Agent' = 'skill-monitor'; 'Accept' = 'application/vnd.github+json' }
    # 优先用 gh 的 token（限速更高），gh 未登录/未安装时匿名调用
    $gh = Get-Command gh -ErrorAction SilentlyContinue
    if ($gh) {
        $token = & gh auth token 2>$null
        if ($LASTEXITCODE -eq 0 -and $token) {
            $headers['Authorization'] = "Bearer $token"
        }
    }
    return Invoke-RestMethod -Uri $Url -Headers $headers -Method Get
}

# 递归列出仓库中某目录下的所有文件，返回 @{ relative_path = blob_sha }
function Get-RemoteFiles {
    param(
        [string]$Repo,
        [string]$Path,
        [string]$Ref,
        [string]$Base  # 相对路径前缀（递归用，初始为空）
    )
    $result = @{}
    # 注意：PowerShell 5.1 中 `?` 是变量名合法字符，$Path?ref= 会被误解析为变量名，所有后跟 `?` 的变量都必须用 $() 隔离
    $url = "https://api.github.com/repos/$Repo/contents/$($Path)?ref=$($Ref)"
    $items = Invoke-GitHubApi -Url $url
    foreach ($item in $items) {
        $rel = if ($Base) { "$Base/$($item.name)" } else { $item.name }
        if ($item.type -eq 'dir') {
            $sub = Get-RemoteFiles -Repo $Repo -Path $item.path -Ref $Ref -Base $rel
            foreach ($k in $sub.Keys) { $result[$k] = $sub[$k] }
        }
        else {
            $result[$rel] = $item.sha
        }
    }
    return $result
}

# 下载 raw 文件
function Get-RawFile {
    param([string]$Repo, [string]$Ref, [string]$FilePath, [string]$OutPath)
    $url = "https://raw.githubusercontent.com/$Repo/$($Ref)/$FilePath"
    $headers = @{ 'User-Agent' = 'skill-monitor' }
    $gh = Get-Command gh -ErrorAction SilentlyContinue
    if ($gh) {
        $token = & gh auth token 2>$null
        if ($LASTEXITCODE -eq 0 -and $token) {
            $headers['Authorization'] = "Bearer $token"
        }
    }
    Invoke-WebRequest -Uri $url -Headers $headers -OutFile $OutPath
}

# 用 git diff --no-index 提取变更统计与节选
function Get-DiffSummary {
    param([string]$OldPath, [string]$NewPath)
    $git = Get-Command git -ErrorAction SilentlyContinue
    if (-not $git) { return @{ stat = ''; sample = '（本机未安装 git，无法生成 diff 节选）' } }

    # 用 cmd /c 包裹：PowerShell 5.1 在 $ErrorActionPreference=Stop 时会把原生命令 stderr 当错误抛出
    # （git 的 LF/CRLF 警告即走 stderr），cmd 的 2>nul 可彻底丢弃 stderr；git diff 有差异时退出码为 1，不影响
    $cmdLine = "git diff --no-index --unified=2 -- `"$OldPath`" `"$NewPath`" 2>nul"
    $diff = & cmd /c $cmdLine | Out-String

    # 行统计：+ 新增行 / - 删除行（排除 diff 头与 +++/--- 标记行）
    $added   = ($diff -split "`n" | Where-Object { $_ -match '^\+[^+]' }).Count
    $removed = ($diff -split "`n" | Where-Object { $_ -match '^-[^-]' }).Count

    # 节选：变更行（+/- 开头），每行截断到 120 字符，最多 30 行
    $sample = ($diff -split "`n" | Where-Object { $_ -match '^[+-][^+-]' } |
        Select-Object -First 30 | ForEach-Object {
            if ($_.Length -gt 120) { $_.Substring(0, 120) + ' …' } else { $_ }
        }) -join "`n"

    return @{ stat = "+$added -$removed"; sample = $sample }
}

# ---------- 主流程 ----------

# @() 强制数组：PowerShell 5.1 的 ConvertFrom-Json 会把单元素数组解包成对象
# 网络未就绪则退出（脚本被计划任务在开机后调用时网络可能还没好）
if (-not (Wait-NetworkReady)) { exit 1 }

$watches = @((Get-Content $Manifest -Raw | ConvertFrom-Json).watches)
$today   = Get-Date -Format 'yyyy-MM-dd'
$reportLines = @()   # 本次所有 watch 的汇总（stdout 用）
$changed     = $false

foreach ($w in $watches) {
    $id   = $w.id
    $repo = $w.repo
    $path = $w.path
    $ref  = $w.ref
    $localDir = $w.local_dir

    Log-Write "==> 检查 $id ($repo/$path)"
    try {
        $remote = Get-RemoteFiles -Repo $repo -Path $path -Ref $ref
    }
    catch {
        Log-Write "    获取远端文件失败: $($_.Exception.Message)"
        continue
    }

    # 对比 sha：modified / added / deleted
    $modified = @(); $added = @(); $deleted = @()
    foreach ($file in $remote.Keys) {
        if ($w.files.PSObject.Properties.Name -contains $file) {
            if ($w.files.$file -ne $remote[$file]) { $modified += $file }
        }
        else { $added += $file }
    }
    foreach ($file in $w.files.PSObject.Properties.Name) {
        if (-not $remote.ContainsKey($file)) { $deleted += $file }
    }

    if ($modified.Count -eq 0 -and $added.Count -eq 0 -and $deleted.Count -eq 0) {
        Log-Write "    无更新"
        continue
    }

    $changed = $true
    Log-Write "    发现更新: 修改 $($modified.Count) / 新增 $($added.Count) / 删除 $($deleted.Count)"

    # 下载新版本到临时目录
    $tmpDir = Join-Path $env:TEMP "skill-monitor-$id-$(Get-Random)"
    New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
    $newLocal = @{}   # 相对路径 -> 临时目录中的新版文件路径
    foreach ($file in ($modified + $added)) {
        $out = Join-Path $tmpDir ($file -replace '/', '\')
        New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
        Get-RawFile -Repo $repo -Ref $ref -FilePath "$path/$file" -OutPath $out
        $newLocal[$file] = $out
    }

    # 生成变更摘要报告
    $report = @()
    $report += "# 更新摘要：$id（$today）"
    $report += "来源: https://github.com/$repo/tree/$ref/$path"
    $report += "本地: $localDir"
    $report += ""
    $report += "## 变更列表"
    foreach ($f in $modified) { $report += "- [修改] $f" }
    foreach ($f in $added)    { $report += "- [新增] $f" }
    foreach ($f in $deleted)  { $report += "- [删除] $f" }
    $report += ""
    $report += "## 变更详情"
    foreach ($f in $modified) {
        $localOld = Join-Path $localDir ($f -replace '/', '\')
        $sum = Get-DiffSummary -OldPath $localOld -NewPath $newLocal[$f]
        $report += "### $f（$($sum.stat)）"
        if ($sum.sample) {
            $report += '```diff'
            $report += $sum.sample
            $report += '```'
        }
        $report += ""
    }
    foreach ($f in $added) {
        $report += "### $f（新增文件）"
        $report += '```'
        $report += Get-Content $newLocal[$f] -TotalCount 30 -ErrorAction SilentlyContinue
        $report += '```'
        $report += ""
    }
    foreach ($f in $deleted) {
        $report += "### $f（远端已删除）"
        $report += ""
    }

    # 写入报告文件
    $reportPath = Join-Path $ReportsDir $today
    New-Item -ItemType Directory -Force -Path $reportPath | Out-Null
    $reportFile = Join-Path $reportPath "$id.md"
    [System.IO.File]::WriteAllLines($reportFile, $report, [System.Text.Encoding]::UTF8)
    Log-Write "    报告已生成: $reportFile"

    # 更新 sha 记录并写回 manifest（无人值守：同一更新只报告一次）
    $w.files = [ordered]@{}
    foreach ($file in $remote.Keys) { $w.files[$file] = $remote[$file] }
    # 显式用 watches 数组包裹写回，避免单元素时丢失数组结构
    $manifestObj = [ordered]@{ watches = @($watches) }
    $manifestObj | ConvertTo-Json -Depth 6 | Set-Content -Path $Manifest -Encoding UTF8

    # 清理临时文件
    Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
}

if (-not $changed) {
    Log-Write "所有监控项均无更新（$today）"
}

Log-Write '=== 检查完成 ==='
