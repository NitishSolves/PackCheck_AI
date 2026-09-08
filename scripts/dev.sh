#!/usr/bin/env bash
set -euo pipefail

# Start API, AI service, and web. The Vite port is the preview entry.
# API requests under /api are reverse-proxied to the backend.

npm run dev:ai &
AI_PID=$!

npm run dev:api &
API_PID=$!

cleanup() {
  kill "${AI_PID}" "${API_PID}" 2>/dev/null || true
}
trap cleanup EXIT

npm run dev:web
