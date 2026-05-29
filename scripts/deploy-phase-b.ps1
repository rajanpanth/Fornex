<#
.SYNOPSIS
    One-shot Phase B deploy wrapper for Fornex on Solana devnet.

.DESCRIPTION
    Builds and upgrades the Fornex Anchor program, then initializes the new
    v0.4 PDAs (AgentReputation, VaultStrategy) and verifies the public site
    is reachable. Idempotent end-to-end — re-running this script after a
    successful run only re-confirms state, it doesn't double-init.

    What it does, in order:
      1. anchor build
      2. anchor upgrade (devnet, same program id)
      3. npx ts-node agent/scripts/init-phase-b.ts (idempotent)
      4. (optional) Vercel redeploy via vercel --prod
      5. HTTPS reachability check on /, /app, /proof, /judges

    Requires:
      - solana, anchor (anchor-cli), npx, vercel (for step 4) on PATH
      - agent/.env populated with FORNEX_ADMIN_KEYPAIR + VAULT_ADDRESS
      - ANCHOR_WALLET pointing at the deployer keypair (or
        ~/.config/solana/id.json by default)

.PARAMETER ProgramId
    Anchor program id. Defaults to the live devnet deployment.

.PARAMETER SkipVercel
    Skip the Vercel redeploy step (e.g. if you push via Git instead).

.PARAMETER SkipUpgrade
    Skip anchor build + upgrade (e.g. when only re-running PDA init or the
    site reachability check).

.PARAMETER StrategyMode
    Strategy mode to initialize (0 = Momentum, 1 = MeanRevert, 2 = RangeDCA).
    Defaults to 0.

.PARAMETER SiteBase
    Base URL to verify after deploy. Defaults to https://fornexlab.vercel.app.

.EXAMPLE
    powershell -File scripts/deploy-phase-b.ps1

.EXAMPLE
    powershell -File scripts/deploy-phase-b.ps1 -SkipUpgrade -StrategyMode 1

.NOTES
    This wrapper is intentionally conservative: any non-zero exit from a
    step halts the script. Re-run after the failure is fixed.
#>

[CmdletBinding()]
param(
    [string]$ProgramId = "H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf",
    [switch]$SkipVercel,
    [switch]$SkipUpgrade,
    [ValidateRange(0, 2)]
    [int]$StrategyMode = 0,
    [string]$SiteBase = "https://fornexlab.vercel.app"
)

$ErrorActionPreference = "Stop"

function Write-Step([string]$Label) {
    Write-Host ""
    Write-Host "==> $Label" -ForegroundColor Cyan
}

function Require-Tool([string]$Name) {
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $cmd) {
        Write-Error "Required tool '$Name' is not on PATH. Install it and retry."
    }
}

# --- Pre-flight ---------------------------------------------------------------

Write-Step "Pre-flight"
Require-Tool "npx"
if (-not $SkipUpgrade) {
    Require-Tool "anchor"
    Require-Tool "solana"
}
if (-not $SkipVercel) {
    Require-Tool "vercel"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot
Write-Host "Repo root: $repoRoot"

# --- 1. anchor build ----------------------------------------------------------

if (-not $SkipUpgrade) {
    Write-Step "anchor build"
    & anchor build
    if ($LASTEXITCODE -ne 0) { Write-Error "anchor build failed" }
}

# --- 2. anchor upgrade --------------------------------------------------------

if (-not $SkipUpgrade) {
    Write-Step "anchor upgrade --provider.cluster devnet"
    $soPath = Join-Path $repoRoot "target\deploy\fornex.so"
    if (-not (Test-Path $soPath)) {
        Write-Error "Built artifact not found at $soPath. Did anchor build succeed?"
    }
    & anchor upgrade $soPath --program-id $ProgramId --provider.cluster devnet
    if ($LASTEXITCODE -ne 0) { Write-Error "anchor upgrade failed" }
}

# --- 3. init-phase-b ----------------------------------------------------------

Write-Step "Phase B init (AgentReputation + VaultStrategy)"
$initScript = Join-Path $repoRoot "agent\scripts\init-phase-b.ts"
if (-not (Test-Path $initScript)) {
    Write-Error "Missing init script at $initScript"
}
& npx ts-node $initScript --mode $StrategyMode
if ($LASTEXITCODE -ne 0) { Write-Error "init-phase-b failed" }

# --- 4. Vercel redeploy -------------------------------------------------------

if (-not $SkipVercel) {
    Write-Step "Vercel production deploy"
    & vercel --prod --yes
    if ($LASTEXITCODE -ne 0) { Write-Error "vercel deploy failed" }
} else {
    Write-Host "Skipping Vercel redeploy (-SkipVercel)" -ForegroundColor DarkGray
}

# --- 5. Site reachability -----------------------------------------------------

Write-Step "Verifying site reachability ($SiteBase)"
$paths = @("/", "/app", "/proof", "/judges")
foreach ($p in $paths) {
    $url = "$SiteBase$p"
    try {
        $resp = Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing -TimeoutSec 20
        if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 400) {
            Write-Host ("  OK  {0,-10} -> {1}" -f $resp.StatusCode, $url)
        } else {
            Write-Warning ("  {0,-10} -> {1}" -f $resp.StatusCode, $url)
        }
    } catch {
        Write-Warning ("  FAIL       -> $url ($($_.Exception.Message))")
    }
}

Write-Host ""
Write-Host "Phase B deploy complete." -ForegroundColor Green
Write-Host "Next steps:"
Write-Host "  - Open $SiteBase/judges to confirm the new tiles render."
Write-Host "  - Open $SiteBase/proof and watch the live pulse pill."
Write-Host "  - Run a force-close cycle to populate the reputation tile:"
Write-Host "      FORNEX_FORCE_CLOSE=1 FORNEX_SINGLE_CYCLE=1 npm run agent"
