# planning-with-files: 会话补全脚本（PowerShell）
# 分析上一次会话，在最后一次 planning 文件更新之后，提取尚未同步到文件的上下文。
# 设计用于 SessionStart hook。
# 用法: .\session-catchup.ps1 [project-path]

param(
    [string]$ProjectPath = (Get-Location).Path
)

$TaskDir = 'Task'
$PlanningFiles = @('task_plan.md', 'progress.md', 'findings.md')
$PlanningFilePaths = @('Task/task_plan.md', 'Task/progress.md', 'Task/findings.md')

function Get-ClaudeDir {
    return Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
}

function Get-ProjectDir {
    param(
        [string]$InputPath
    )

    $sanitized = $InputPath -replace '[\\/:_]', '-'
    return Join-Path (Join-Path (Get-ClaudeDir) 'projects') $sanitized
}

function Get-SessionsSorted {
    param(
        [string]$ProjectDir
    )

    if (-not (Test-Path $ProjectDir)) {
        return @()
    }

    return @(Get-ChildItem -Path $ProjectDir -File -Filter '*.jsonl' -ErrorAction SilentlyContinue |
        Where-Object { -not $_.Name.StartsWith('agent-') } |
        Sort-Object LastWriteTime -Descending)
}

function Parse-SessionMessages {
    param(
        [string]$SessionFile
    )

    $messages = New-Object System.Collections.Generic.List[object]
    $lineNumber = 0

    Get-Content -Path $SessionFile -Encoding UTF8 -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            $data = $_ | ConvertFrom-Json -ErrorAction Stop
            Add-Member -InputObject $data -MemberType NoteProperty -Name '_line_num' -Value $lineNumber -Force
            $messages.Add($data)
        } catch {
            # 忽略无法解析的行
        }

        $lineNumber += 1
    }

    return $messages
}

function Find-LastPlanningUpdate {
    param(
        [System.Collections.Generic.List[object]]$Messages
    )

    $lastUpdateLine = -1
    $lastUpdateFile = $null

    foreach ($msg in $Messages) {
        if ($msg.type -ne 'assistant') {
            continue
        }

        $content = $msg.message.content
        if (-not ($content -is [System.Array])) {
            continue
        }

        foreach ($item in $content) {
            if ($item.type -ne 'tool_use') {
                continue
            }

            $toolName = [string]$item.name
            $toolInput = $item.input

            if ($toolName -notin @('Write', 'Edit')) {
                continue
            }

            $filePath = [string]$toolInput.file_path
            foreach ($planningFile in $PlanningFiles) {
                if ($filePath.EndsWith($planningFile)) {
                    $lastUpdateLine = $msg._line_num
                    $lastUpdateFile = $planningFile
                }
            }
        }
    }

    return @($lastUpdateLine, $lastUpdateFile)
}

function Get-ShortText {
    param(
        [string]$Text,
        [int]$MaxLength
    )

    if ([string]::IsNullOrEmpty($Text)) {
        return ''
    }

    if ($Text.Length -le $MaxLength) {
        return $Text
    }

    return $Text.Substring(0, $MaxLength)
}

function Extract-MessagesAfter {
    param(
        [System.Collections.Generic.List[object]]$Messages,
        [int]$AfterLine
    )

    $result = New-Object System.Collections.Generic.List[object]

    foreach ($msg in $Messages) {
        if ($msg._line_num -le $AfterLine) {
            continue
        }

        $msgType = [string]$msg.type
        $isMeta = $false
        if ($null -ne $msg.isMeta) {
            $isMeta = [bool]$msg.isMeta
        }

        if ($msgType -eq 'user' -and -not $isMeta) {
            $content = $msg.message.content

            if ($content -is [System.Array]) {
                $contentText = ''
                foreach ($item in $content) {
                    if ($item -is [object] -and $item.type -eq 'text') {
                        $contentText = [string]$item.text
                        break
                    }
                }
                $content = $contentText
            }

            if (($content -is [string]) -and -not [string]::IsNullOrEmpty($content)) {
                if ($content.StartsWith('<local-command') -or $content.StartsWith('<command-') -or $content.StartsWith('<task-notification')) {
                    continue
                }

                if ($content.Length -gt 20) {
                    $result.Add([pscustomobject]@{
                        role    = 'user'
                        content = $content
                        line    = $msg._line_num
                    })
                }
            }

            continue
        }

        if ($msgType -ne 'assistant') {
            continue
        }

        $msgContent = $msg.message.content
        $textContent = ''
        $toolUses = New-Object System.Collections.Generic.List[string]

        if ($msgContent -is [string]) {
            $textContent = $msgContent
        } elseif ($msgContent -is [System.Array]) {
            foreach ($item in $msgContent) {
                if ($item.type -eq 'text') {
                    $textContent = [string]$item.text
                    continue
                }

                if ($item.type -ne 'tool_use') {
                    continue
                }

                $toolName = [string]$item.name
                $toolInput = $item.input

                if ($toolName -eq 'Edit') {
                    $toolUses.Add('Edit: ' + [string]$toolInput.file_path)
                } elseif ($toolName -eq 'Write') {
                    $toolUses.Add('Write: ' + [string]$toolInput.file_path)
                } elseif ($toolName -eq 'Bash') {
                    $command = Get-ShortText -Text ([string]$toolInput.command) -MaxLength 80
                    $toolUses.Add('Bash: ' + $command)
                } else {
                    $toolUses.Add($toolName)
                }
            }
        }

        if (-not [string]::IsNullOrEmpty($textContent) -or $toolUses.Count -gt 0) {
            $result.Add([pscustomobject]@{
                role    = 'assistant'
                content = (Get-ShortText -Text $textContent -MaxLength 600)
                tools   = @($toolUses)
                line    = $msg._line_num
            })
        }
    }

    return $result
}

$hasPlanningFiles = $false
foreach ($planningFile in $PlanningFiles) {
    if (Test-Path (Join-Path (Join-Path $ProjectPath $TaskDir) $planningFile)) {
        $hasPlanningFiles = $true
        break
    }
}

if (-not $hasPlanningFiles) {
    exit 0
}

$projectDir = Get-ProjectDir -InputPath $ProjectPath
if (-not (Test-Path $projectDir)) {
    exit 0
}

$sessions = Get-SessionsSorted -ProjectDir $projectDir
if ($sessions.Count -lt 1) {
    exit 0
}

$targetSession = $null
foreach ($session in $sessions) {
    if ($session.Length -gt 5000) {
        $targetSession = $session
        break
    }
}

if ($null -eq $targetSession) {
    exit 0
}

$messages = Parse-SessionMessages -SessionFile $targetSession.FullName
$lastPlanningUpdate = Find-LastPlanningUpdate -Messages $messages
$lastUpdateLine = [int]$lastPlanningUpdate[0]
$lastUpdateFile = $lastPlanningUpdate[1]

if ($lastUpdateLine -lt 0) {
    exit 0
}

$messagesAfter = Extract-MessagesAfter -Messages $messages -AfterLine $lastUpdateLine
if ($messagesAfter.Count -eq 0) {
    exit 0
}

Write-Output ''
Write-Output '[planning-with-files] SESSION CATCHUP DETECTED'
Write-Output ('Previous session: ' + [System.IO.Path]::GetFileNameWithoutExtension($targetSession.Name))
Write-Output ('Last planning update: ' + $lastUpdateFile + ' at message #' + $lastUpdateLine)
Write-Output ('Unsynced messages: ' + $messagesAfter.Count)
Write-Output ''
Write-Output '--- UNSYNCED CONTEXT ---'

$recentMessages = @($messagesAfter | Select-Object -Last 15)
foreach ($msg in $recentMessages) {
    if ($msg.role -eq 'user') {
        Write-Output ('USER: ' + (Get-ShortText -Text ([string]$msg.content) -MaxLength 300))
        continue
    }

    if (-not [string]::IsNullOrEmpty([string]$msg.content)) {
        Write-Output ('CLAUDE: ' + (Get-ShortText -Text ([string]$msg.content) -MaxLength 300))
    }

    if ($msg.tools.Count -gt 0) {
        $toolSummary = @($msg.tools | Select-Object -First 4) -join ', '
        Write-Output ('  Tools: ' + $toolSummary)
    }
}

Write-Output ''
Write-Output '--- RECOMMENDED ---'
Write-Output '1. Run: git diff --stat'
Write-Output '2. Read: Task/task_plan.md, Task/progress.md, Task/findings.md'
Write-Output '3. Update planning files based on above context'
Write-Output '4. Continue with task'
