@echo off
title Stop ChurnGuard
echo Stopping ChurnGuard services on ports 8000 and 5173...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING 2^>nul') do (
    echo   Terminating backend process PID %%a...
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING 2^>nul') do (
    echo   Terminating frontend process PID %%a...
    taskkill /F /PID %%a >nul 2>&1
)

echo ChurnGuard services stopped.
timeout /t 2 /nobreak >nul

