@echo off
chcp 65001 >nul
title Trader Dashboard - Build

echo.
echo ==========================================
echo   Trader Correlation Dashboard - Build
echo ==========================================
echo.

:: ตรวจสอบ Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] ไม่พบ Node.js กรุณาติดตั้งก่อน: https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js: พร้อมใช้งาน

:: ตรวจสอบ npm
npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] ไม่พบ npm
    pause
    exit /b 1
)

:: สร้างโฟลเดอร์ release
if not exist release mkdir release
if not exist release\ea mkdir release\ea

echo.
echo [1/5] ติดตั้ง Backend dependencies...
cd backend
call npm install
if errorlevel 1 ( echo [ERROR] npm install backend ล้มเหลว & cd .. & pause & exit /b 1 )

echo.
echo [2/5] Compile TypeScript...
call npm run build
if errorlevel 1 ( echo [ERROR] TypeScript compile ล้มเหลว & cd .. & pause & exit /b 1 )

echo.
echo [3/5] สร้าง backend.exe...
call npm run build:exe
if errorlevel 1 ( echo [ERROR] pkg compile ล้มเหลว & cd .. & pause & exit /b 1 )

cd ..
echo.
echo [4/5] ติดตั้ง Frontend dependencies...
cd frontend
call npm install
if errorlevel 1 ( echo [ERROR] npm install frontend ล้มเหลว & cd .. & pause & exit /b 1 )

echo.
echo [5/5] Build Frontend (static export)...
call npm run build
if errorlevel 1 ( echo [ERROR] Next.js build ล้มเหลว & cd .. & pause & exit /b 1 )

cd ..

:: Copy ไฟล์เข้า release/
echo.
echo Copying files to release/...
if exist release\frontend rmdir /s /q release\frontend
mkdir release\frontend
xcopy /E /Y /Q frontend\out\* release\frontend\

:: Copy EA
xcopy /Y /Q ea\MT5_DashboardFeeder.mq5 release\ea\
if exist ea\MT4_DashboardFeeder.mq4 xcopy /Y /Q ea\MT4_DashboardFeeder.mq4 release\ea\

:: Copy config และ scripts
if not exist release\.env copy .env.example release\.env >nul
copy start.bat release\start.bat >nul
copy README.txt release\README.txt >nul

echo.
echo ==========================================
echo   BUILD สำเร็จ!
echo   ไฟล์ทั้งหมดอยู่ใน: release\
echo ==========================================
echo.
echo โครงสร้างไฟล์:
echo   release\
echo   ├── backend.exe      (รัน server)
echo   ├── frontend\        (หน้าเว็บ)
echo   ├── ea\              (MT5 Expert Advisor)
echo   ├── .env             (ตั้งค่า)
echo   ├── start.bat        (เปิดโปรแกรม)
echo   └── README.txt       (คู่มือ)
echo.
echo ส่ง ZIP ของโฟลเดอร์ release\ ให้เพื่อนได้เลย!
echo.
pause
