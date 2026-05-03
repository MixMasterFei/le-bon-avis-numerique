# enrich-loop.ps1 — PowerShell version of the enrichment loop, mirrors
# scripts/enrich-loop.sh. Use this on Windows where Git Bash + curl + jq
# can choke on encoding / line-endings. Invoke-RestMethod is native to
# PowerShell and parses JSON cleanly without any of those pitfalls.
#
# Usage:
#   bash scripts/enrich-loop.ps1                 # default — type=all, 5 per batch
#   .\scripts\enrich-loop.ps1                    # PowerShell native invocation
#   .\scripts\enrich-loop.ps1 -Type manga -Limit 10
#
# Reads CRON_SECRET from .env in the current directory. Stops cleanly
# when the server returns processed=0 (no more items). Ctrl+C is safe —
# onlyMissing=true means resuming picks up exactly where it left off.

param(
    [string]$Type = "all",
    [int]$Limit = 5,
    [int]$SleepSecs = 3,
    [string]$SiteUrl = "https://totemavise.com"
)

# Make any error terminating + visible so the script can't exit silently.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Write-Host "[debug] script started, params loaded"

$envFile = ".env"
if (-not (Test-Path $envFile)) {
    Write-Error "$envFile not found. Run this from the repo root."
    exit 1
}
Write-Host "[debug] .env exists"

# Parse CRON_SECRET out of .env (strips optional surrounding quotes).
$cronLine = Get-Content $envFile | Where-Object { $_ -match '^CRON_SECRET=' }
if (-not $cronLine) {
    Write-Error "CRON_SECRET missing from .env. Run: npx vercel env pull .env --environment=production"
    exit 1
}
$cron = ($cronLine -replace '^CRON_SECRET=', '' -replace '^"|"$', '').Trim()
if (-not $cron) {
    Write-Error "CRON_SECRET in .env is empty."
    exit 1
}
Write-Host "[debug] CRON_SECRET parsed, length=$($cron.Length)"

$headers = @{ Authorization = "Bearer $cron" }

Write-Host "[debug] preflight starting against $SiteUrl/api/admin/enrich"

# Preflight - get the starting backlog so we can show real progress.
try {
    $preflight = Invoke-RestMethod -Uri "$SiteUrl/api/admin/enrich" -Headers $headers
    Write-Host "[debug] preflight ok"
    $backlogStart = [int]$preflight.enrichment.withoutMetrics
    Write-Host "[debug] backlogStart=$backlogStart"
}
catch {
    $statusCode = $null
    if ($_.Exception.Response) { $statusCode = $_.Exception.Response.StatusCode.value__ }
    if ($statusCode -eq 401) {
        Write-Error "Auth failed (401). CRON_SECRET in .env doesn't match Vercel."
        Write-Error "Fix: npx vercel env pull .env --environment=production"
    }
    else {
        Write-Error "Preflight failed: $($_.Exception.Message)"
    }
    exit 1
}

Write-Host "Enriching from $SiteUrl  type=$Type  limit=$Limit"
if ($backlogStart -eq 0) {
    Write-Host "Backlog: 0. Everything is already enriched. Nothing to do."
    exit 0
}
Write-Host "Backlog: $backlogStart items to enrich."
Write-Host "Press Ctrl+C to stop. onlyMissing=true means resuming is safe."
Write-Host ""

$batch = 0
$totalEnriched = 0
$totalErrors = 0
$startTime = Get-Date

while ($true) {
    $batch++
    $body = @{ type = $Type; limit = $Limit; onlyMissing = $true } | ConvertTo-Json

    try {
        $resp = Invoke-RestMethod `
            -Uri "$SiteUrl/api/admin/enrich" `
            -Method POST `
            -Body $body `
            -ContentType "application/json" `
            -Headers $headers `
            -TimeoutSec 320
    }
    catch {
        $statusCode = $null
        if ($_.Exception.Response) {
            $statusCode = $_.Exception.Response.StatusCode.value__
        }

        if ($statusCode -eq 401 -or $statusCode -eq 403) {
            Write-Error "Auth failed mid-loop ($statusCode). CRON_SECRET stopped working."
            exit 1
        }
        if ($statusCode -eq 429) {
            Write-Host "$(Get-Date -Format 'HH:mm:ss')  Rate-limited (429). Sleeping 60s..."
            Start-Sleep 60
            continue
        }

        Write-Host "$(Get-Date -Format 'HH:mm:ss')  batch ${batch}: ERROR $($_.Exception.Message). Sleeping 10s..."
        Start-Sleep 10
        continue
    }

    $enriched = if ($null -ne $resp.result.enriched) { [int]$resp.result.enriched } else { 0 }
    $errors = if ($null -ne $resp.result.errors) { [int]$resp.result.errors } else { 0 }
    $processed = if ($null -ne $resp.result.processed) { [int]$resp.result.processed } else { 0 }
    $bailed = if ($resp.bailedOnTime -eq $true) { " (server bailed)" } else { "" }

    $totalEnriched += $enriched
    $totalErrors += $errors
    $ts = Get-Date -Format 'HH:mm:ss'

    # Progress against starting backlog (capped — late imports during the
    # run aren't part of the original promise, so we show 100% when reached).
    $done = [Math]::Min($totalEnriched, $backlogStart)
    $pct = [Math]::Round(($done * 100) / $backlogStart, 1)

    # ETA from observed pace.
    $elapsed = (Get-Date) - $startTime
    $etaNote = ""
    if ($totalEnriched -gt 0 -and $elapsed.TotalSeconds -gt 0) {
        $remaining = $backlogStart - $done
        if ($remaining -gt 0) {
            $secsPerItem = $elapsed.TotalSeconds / $totalEnriched
            $etaSecs = [int]($secsPerItem * $remaining)
            $etaMin = [int]($etaSecs / 60)
            $etaS = $etaSecs % 60
            $etaNote = if ($etaMin -gt 0) { ", ETA ~${etaMin}m${etaS}s" } else { ", ETA ~${etaS}s" }
        }
    }

    Write-Host "${ts}  batch ${batch}: +${enriched} enriched, ${errors} errors -- ${done}/${backlogStart} (${pct}%)${etaNote}${bailed}"

    if ($processed -eq 0) {
        Write-Host ""
        $totalElapsed = (Get-Date) - $startTime
        $em = [int]$totalElapsed.TotalMinutes
        $es = [int]($totalElapsed.TotalSeconds % 60)
        Write-Host "Done in ${em}m${es}s. Total enriched: ${totalEnriched} (with ${totalErrors} errors)."
        break
    }

    Start-Sleep -Seconds $SleepSecs
}
