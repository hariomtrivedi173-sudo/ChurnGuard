@echo off
setlocal enabledelayedexpansion
title ChurnGuard Launcher

echo =====================================================================
echo                 CHURNGUARD LOCAL DEVELOPMENT LAUNCHER
echo =====================================================================
echo.

cd /d "%~dp0"

:: 1. Terminate any previous processes on ports 8000 and 5173
echo [1/5] Checking and clearing ports 8000 and 5173...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING 2^>nul') do (
    echo   Stopping old backend process PID %%a...
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING 2^>nul') do (
    echo   Stopping old frontend process PID %%a...
    taskkill /F /PID %%a >nul 2>&1
)

:: 2. Identify Python virtual environment
echo [2/5] Locating Python environment...
set "PYTHON_EXE="
if exist "%~dp0backend\venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
    set "UVICORN_EXE=%~dp0backend\venv\Scripts\uvicorn.exe"
) else if exist "%~dp0venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0venv\Scripts\python.exe"
    set "UVICORN_EXE=%~dp0venv\Scripts\uvicorn.exe"
) else (
    echo [ERROR] No Python virtual environment found.
    pause
    exit /b 1
)
echo   Using Python: !PYTHON_EXE!

:: 3. Start Backend
echo [3/5] Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "ChurnGuard Backend (Port 8000)" cmd /k "cd /d "%~dp0backend" && "!PYTHON_EXE!" -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload --reload-dir "%~dp0backend" --reload-exclude venv --reload-exclude __pycache__"

:: 4. Start Frontend
echo [4/5] Starting React / Vite Frontend on http://127.0.0.1:5173 ...
start "ChurnGuard Frontend (Port 5173)" cmd /k "cd /d "%~dp0frontend" && npm run dev -- --host 127.0.0.1 --port 5173"

:: 5. Health Check
echo [5/5] Waiting for services to initialize...
timeout /t 5 /nobreak >nul

powershell -NoProfile -Command "try { $b = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 10; Write-Host '  [OK] Backend Health:' $b.status '- DB:' $b.database.status } catch { Write-Host '  [WAIT] Backend is still starting up...' }"
powershell -NoProfile -Command "try { $f = Invoke-WebRequest -Uri 'http://127.0.0.1:5173' -TimeoutSec 10; Write-Host '  [OK] Frontend status code:' $f.StatusCode } catch { Write-Host '  [WAIT] Frontend is still compiling...' }"

echo.
echo =====================================================================
echo   ChurnGuard is now running!
echo   Frontend: http://127.0.0.1:5173
echo   Backend : http://127.0.0.1:8000
echo   API Docs: http://127.0.0.1:8000/docs
echo =====================================================================
echo.
echo Opening browser...
start http://127.0.0.1:5173
pause

