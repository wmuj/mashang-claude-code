@echo off
setlocal
chcp 65001 >nul

cd /d "%~dp0"

echo [1/3] Checking Bun...
where bun >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Bun is not installed or not in PATH.
  echo Install from: https://bun.sh/
  pause
  exit /b 1
)

echo [2/3] Checking dependencies...
if not exist "node_modules" (
  echo node_modules not found, running bun install...
  bun install
  if errorlevel 1 (
    echo [ERROR] bun install failed
    pause
    exit /b 1
  )
)

echo [3/3] Starting launcher panel...
bun run launcher

pause
