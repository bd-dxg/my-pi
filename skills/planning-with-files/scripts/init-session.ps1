# Initialize planning files for a new session
# Usage: .\init-session.ps1 [project-name]

param(
    [string]$ProjectName = "project"
)

$DATE = Get-Date -Format "yyyy-MM-dd"
$TaskDir = "Task"
$TaskPlanPath = Join-Path $TaskDir "task_plan.md"
$FindingsPath = Join-Path $TaskDir "findings.md"
$ProgressPath = Join-Path $TaskDir "progress.md"

Write-Host "Initializing planning files for: $ProjectName"

if (-not (Test-Path $TaskDir)) {
    New-Item -ItemType Directory -Path $TaskDir | Out-Null
    Write-Host "Created Task directory"
}

# Create Task/task_plan.md if it doesn't exist
if (-not (Test-Path $TaskPlanPath)) {
    @"
# Task Plan: [Brief Description]

## Goal
[One sentence describing the end state]

## Current Phase
Phase 1

## Phases

### Phase 1: Requirements & Discovery
- [ ] Understand user intent
- [ ] Identify constraints
- [ ] Document in Task/findings.md
- **Status:** in_progress

### Phase 2: Planning & Structure
- [ ] Define approach
- [ ] Create project structure
- **Status:** pending

### Phase 3: Implementation
- [ ] Execute the plan
- [ ] Write to files before executing
- **Status:** pending

### Phase 4: Testing & Verification
- [ ] Verify requirements met
- [ ] Document test results
- **Status:** pending

### Phase 5: Delivery
- [ ] Review outputs
- [ ] Deliver to user
- **Status:** pending

## Decisions Made
| Decision | Rationale |
|----------|-----------|

## Errors Encountered
| Error | Resolution |
|-------|------------|
"@ | Out-File -FilePath $TaskPlanPath -Encoding UTF8
    Write-Host "Created Task/task_plan.md"
} else {
    Write-Host "Task/task_plan.md already exists, skipping"
}

# Create Task/findings.md if it doesn't exist
if (-not (Test-Path $FindingsPath)) {
    @"
# Findings & Decisions

## Requirements
-

## Research Findings
-

## Technical Decisions
| Decision | Rationale |
|----------|-----------|

## Issues Encountered
| Issue | Resolution |
|-------|------------|

## Resources
-
"@ | Out-File -FilePath $FindingsPath -Encoding UTF8
    Write-Host "Created Task/findings.md"
} else {
    Write-Host "Task/findings.md already exists, skipping"
}

# Create Task/progress.md if it doesn't exist
if (-not (Test-Path $ProgressPath)) {
    @"
# Progress Log

## Session: $DATE

### Current Status
- **Phase:** 1 - Requirements & Discovery
- **Started:** $DATE

### Actions Taken
-

### Test Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|

### Errors
| Error | Resolution |
|-------|------------|
"@ | Out-File -FilePath $ProgressPath -Encoding UTF8
    Write-Host "Created Task/progress.md"
} else {
    Write-Host "Task/progress.md already exists, skipping"
}

Write-Host ""
Write-Host "Planning files initialized!"
Write-Host "Files: Task/task_plan.md, Task/findings.md, Task/progress.md"
