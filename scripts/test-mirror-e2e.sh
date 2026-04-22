#!/usr/bin/env bash
# Phase 3.2 — End-to-end smoke for /mirror with default demo GLB.
# Starts dev server, runs the targeted Playwright spec, then tears down.
set -euo pipefail

cd "$(dirname "$0")/.."

LOG_DIR="$(pwd)/.e2e-logs"
mkdir -p "$LOG_DIR"
SERVER_LOG="$LOG_DIR/dev-server.log"
PID_FILE="$LOG_DIR/dev.pid"

cleanup() {
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE" || true)
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
      kill "$PID" 2>/dev/null || true
      sleep 1
      kill -9 "$PID" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi
}
trap cleanup EXIT

echo "→ starting next dev server (logs: $SERVER_LOG)"
npm run dev > "$SERVER_LOG" 2>&1 &
echo $! > "$PID_FILE"

# Wait until the dev server responds on :3000 (default Next.js port).
DEADLINE=$(( $(date +%s) + 60 ))
until curl -sf http://localhost:3000 > /dev/null; do
  if [ "$(date +%s)" -gt "$DEADLINE" ]; then
    echo "✗ dev server failed to start within 60s"
    tail -40 "$SERVER_LOG" || true
    exit 1
  fi
  sleep 1
done
echo "✓ dev server up"

echo "→ running Playwright spec: e2e/mirror-3d-default.spec.ts"
npx playwright test e2e/mirror-3d-default.spec.ts --reporter=list
