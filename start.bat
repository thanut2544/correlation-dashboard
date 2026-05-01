@echo off
chcp 65001 >nul
title Trader Correlation Dashboard

:: โหลด config จาก .env ถ้ามี
if exist .env (
    for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
        if not "%%A"=="" if not "%%A:~0,1%"=="#" set "%%A=%%B"
    )
)

:: ตั้งค่า default port
if "%PORT%"=="" set PORT=4000

echo.
echo ==========================================
echo   Trader Correlation Dashboard
echo ==========================================
echo.
echo   Dashboard: http://localhost:%PORT%
echo.
echo   ขั้นตอน:
echo   1. รัน MT5 และเปิด EA ก่อน
echo   2. รอสักครู่ให้ระบบรับข้อมูลจาก MT5
echo   3. Browser จะเปิดอัตโนมัติ
echo.
echo   กด Ctrl+C เพื่อหยุดโปรแกรม
echo ==========================================
echo.

:: รอ 2 วินาทีแล้วเปิด browser
timeout /t 2 /nobreak >nul
start http://localhost:%PORT%

:: รัน backend
backend.exe
