#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "[1/3] Checking Bun..."
if ! command -v bun &>/dev/null; then
  echo "[ERROR] Bun is not installed or not in PATH."
  echo "Install from: https://bun.sh/"
  exit 1
fi

echo "[2/3] Checking dependencies..."
if [ ! -d "node_modules" ]; then
  echo "node_modules not found, running bun install..."
  bun install
fi

echo "[3/3] Starting launcher panel..."
bun run launcher
