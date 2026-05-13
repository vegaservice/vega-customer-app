# VEGA Build & Submit — All 4 Apps
# Double-click this file to build and submit all apps to Play Store + App Store
# First time: EAS will ask for your Apple password and 2FA code — enter them once, saved forever after

$BASE = "C:\Users\MaheshPappala\Desktop\My Business"

$APPS = @(
    @{ name = "VEGA Customer";    path = "$BASE\Vega-app" },
    @{ name = "VEGA Worker";      path = "$BASE\VEGA-Worker-App" },
    @{ name = "VEGA Admin";       path = "$BASE\Vega-admin" },
    @{ name = "VEGA Hub Manager"; path = "$BASE\VEGA-HubManager-App" }
)

function Run-Build($app) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host " Building: $($app.name)" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    Set-Location $app.path

    Write-Host "-> Android build..." -ForegroundColor Yellow
    eas build --platform android --profile production --non-interactive
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Android build FAILED for $($app.name)" -ForegroundColor Red
        return $false
    }

    Write-Host "-> iOS build..." -ForegroundColor Yellow
    eas build --platform ios --profile production --non-interactive
    if ($LASTEXITCODE -ne 0) {
        Write-Host "iOS build FAILED for $($app.name)" -ForegroundColor Red
        return $false
    }

    return $true
}

function Run-Submit($app) {
    Set-Location $app.path

    Write-Host ""
    Write-Host "-> Submitting $($app.name) to Play Store..." -ForegroundColor Yellow
    eas submit --platform android --profile production --non-interactive

    Write-Host "-> Submitting $($app.name) to App Store..." -ForegroundColor Yellow
    eas submit --platform ios --profile production --non-interactive
}

# Login check
Write-Host "Checking EAS login..." -ForegroundColor Green
eas whoami
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in. Logging in now..." -ForegroundColor Yellow
    eas login
}

# Build all apps
$built = @()
foreach ($app in $APPS) {
    $ok = Run-Build $app
    if ($ok) { $built += $app }
}

# Submit all successfully built apps
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " All builds done. Submitting to stores..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

foreach ($app in $built) {
    Run-Submit $app
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " DONE! Check App Store Connect and" -ForegroundColor Green
Write-Host " Google Play Console for status." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
pause
