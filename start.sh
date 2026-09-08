#!/usr/bin/env bash
set -euo pipefail

# Start backend services in the background, then the Vite frontend.
# The preview environment exposes the frontend port; /api is reverse-proxied.

npm run dev:ai &
AI_PID=$!

npm run dev:api &
API_PID=$!

cleanup() {
  kill "${AI_PID}" "${API_PID}" 2>/dev/null || true
}
trap cleanup EXIT

npm run dev:web
