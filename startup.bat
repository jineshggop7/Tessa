@echo off
title My System Startup Script

echo ===================================================
echo        Starting My System Project Services         
echo ===================================================
echo.

:: Get script root directory
set "ROOT_DIR=%~dp0"

:: 1. Start MongoDB database
echo [1/3] Starting MongoDB database service...
start "MongoDB Database" cmd /k "cd /d "%ROOT_DIR%" && "%ROOT_DIR%mongodb-win32-x86_64-windows-8.2.1\bin\mongod.exe" --dbpath="%ROOT_DIR%db""

:: Brief pause to allow MongoDB to initialize
timeout /t 2 /nobreak >nul

:: 2. Start Backend (FastAPI - My System)
echo [2/3] Starting Backend server (FastAPI)...
start "Backend (FastAPI)" cmd /k "cd /d "%ROOT_DIR%Backend" && call venv\Scripts\activate.bat && python main.py"

:: Brief pause before launching Frontend
timeout /t 1 /nobreak >nul

:: 3. Start Frontend (Angular - My System)
echo [3/3] Starting Frontend server (Angular)...
start "Frontend (Angular)" cmd /k "cd /d "%ROOT_DIR%Frontend\test-smart" && npx ng serve"

echo.
echo ===================================================
echo  All services launched in separate terminal windows!
echo ===================================================
pause
