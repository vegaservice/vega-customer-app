# VEGA Build & Submit — All 4 Apps
# Double-click this file to build and submit all apps to Play Store + App Store

$BASE = "C:\Users\MaheshPappala\Desktop\My Business"

$APPS = @(
    @{ name = "VEGA Customer";    path = "$BASE\Vega-app";             androidKey = "./google-play-key.json" },
    @{ name = "VEGA Worker";      path = "$BASE\VEGA-Worker-App";      androidKey = "./google-play-key.json" },
    @{ name = "VEGA Admin";       path = "$BASE\Vega-admin";           androidKey = "./google-play-key.json" },
    @{ name = "VEGA Hub Manager"; path = "$BASE\VEGA-HubManager-App";  androidKey = "./google-play-key.json" }
)

# Upgrade EAS CLI first
Write-Host "Upgrading EAS CLI..." -ForegroundColor Cyan
npm install -g eas-cli@latest

# Login check
Write-Host "Checking EAS login..." -ForegroundColor Green
eas whoami
if ($LASTEXITCODE -ne 0) {
    eas login
}

# Pull latest code for all apps
foreach ($app in $APPS) {
    if (Test-Path $app.path) {
        Write-Host "Pulling latest code for $($app.name)..." -ForegroundColor Yellow
        Set-Location $app.path
        git pull origin claude/fix-github-access-awbra
    }
}

# Build all apps
$built = @()
foreach ($app in $APPS) {
    if (-not (Test-Path $app.path)) {
        Write-Host "SKIP: folder not found — $($app.path)" -ForegroundColor Red
        continue
    }
    Set-Location $app.path
    Write-Host ""
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host " Building: $($app.name)" -ForegroundColor Cyan
    Write-Host "======================================" -ForegroundColor Cyan

    Write-Host "-> Android build..." -ForegroundColor Yellow
    eas build --platform android --profile production --non-interactive
    $androidOk = $LASTEXITCODE -eq 0

    Write-Host "-> iOS build..." -ForegroundColor Yellow
    eas build --platform ios --profile production --non-interactive
    $iosOk = $LASTEXITCODE -eq 0

    $built += @{ app = $app; androidOk = $androidOk; iosOk = $iosOk }
}

# Submit all
Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host " Submitting to stores..." -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green

foreach ($item in $built) {
    $app = $item.app
    Set-Location $app.path

    if ($item.androidOk) {
        Write-Host "-> Submitting $($app.name) to Play Store..." -ForegroundColor Yellow
        eas submit --platform android --profile production --latest --non-interactive
    }

    if ($item.iosOk) {
        Write-Host "-> Submitting $($app.name) to App Store..." -ForegroundColor Yellow
        eas submit --platform ios --profile production --latest --non-interactive
    }
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host " ALL DONE!" -ForegroundColor Green
Write-Host " Check App Store Connect and" -ForegroundColor Green
Write-Host " Google Play Console for status." -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
pause
