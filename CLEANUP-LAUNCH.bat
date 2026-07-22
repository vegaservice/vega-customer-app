@echo off
cd /d "%~dp0"
echo ==================================================
echo    VEGA LAUNCH - CLEAN SLATE
echo ==================================================
echo This PERMANENTLY deletes ALL:
echo   - orders/bookings   (revenue resets to 0)
echo   - workers           (re-add your 3 real ones after)
echo   - customers/users   (real ones sign up fresh)
echo   - test notifications, bug reports, etc.
echo.
echo KEPT (safe): your LIVE Razorpay config + admin login.
echo.
echo THIS CANNOT BE UNDONE.
echo ==================================================
echo.
set /p ok="Type  YES  and press Enter to wipe all test data: "
if /i not "%ok%"=="YES" ( echo. & echo Cancelled - nothing deleted. & echo. & pause & exit /b )
echo.
node cleanup-for-launch.js
echo.
pause
