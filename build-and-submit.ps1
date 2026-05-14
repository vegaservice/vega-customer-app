# VEGA — Build and Submit All 4 Apps
# Android + iOS — Play Store + App Store
# Run: powershell -ExecutionPolicy Bypass -File ".\build-and-submit.ps1"

$BASE = "C:\Users\MaheshPappala\Desktop\My Business"

$APPS = @(
    @{ name="Customer App"; path="$BASE\Vega-app";            android="preview"; ios="production" },
    @{ name="Admin App";    path="$BASE\Vega-admin";          android="preview"; ios="production" },
    @{ name="Worker App";   path="$BASE\VEGA-Worker-App";     android="preview"; ios="production" },
    @{ name="Hub Manager";  path="$BASE\VEGA-HubManager-App"; android="preview"; ios="production" }
)

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "   VEGA — Build and Submit All Apps   " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Update EAS CLI
Write-Host "Updating EAS CLI..." -ForegroundColor Yellow
npm install -g eas-cli | Out-Null
Write-Host "EAS CLI ready" -ForegroundColor Green
Write-Host ""

# Login to Expo
Write-Host "Logging in to Expo (mahesh1331)..." -ForegroundColor Yellow
eas login
Write-Host ""

# Build Android for all 4 apps
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  STEP 1 — Android Builds             " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

foreach ($app in $APPS) {
    Write-Host ""
    Write-Host "Building Android: $($app.name)" -ForegroundColor Yellow
    Set-Location $app.path
    eas build --platform android --profile $app.android --non-interactive
    Write-Host "Android build submitted: $($app.name)" -ForegroundColor Green
}

# Build iOS for all 4 apps
Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  STEP 2 — iOS Builds                 " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

foreach ($app in $APPS) {
    Write-Host ""
    Write-Host "Building iOS: $($app.name)" -ForegroundColor Yellow
    Set-Location $app.path
    eas build --platform ios --profile $app.ios --non-interactive
    Write-Host "iOS build submitted: $($app.name)" -ForegroundColor Green
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  STEP 3 — Submit to Stores           " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "All builds submitted to EAS servers." -ForegroundColor Green
Write-Host "Builds take 10-15 minutes each." -ForegroundColor Yellow
Write-Host ""
Write-Host "After builds complete, submit to stores:" -ForegroundColor Yellow
Write-Host ""

foreach ($app in $APPS) {
    Write-Host "Submit $($app.name):" -ForegroundColor Cyan
    Write-Host "  cd `"$($app.path)`"" -ForegroundColor White
    Write-Host "  eas submit --platform android --latest" -ForegroundColor White
    Write-Host "  eas submit --platform ios --latest" -ForegroundColor White
    Write-Host ""
}

Write-Host "======================================" -ForegroundColor Green
Write-Host "  JAI VEGA! JAI VINAYAKA! JAI VIZAG!  " -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
