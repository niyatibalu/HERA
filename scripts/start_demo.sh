#!/usr/bin/env bash
# Start every HERA service for the demo. Anything that can't start is skipped with a
# warning: the frontend and map fall back to synthetic data on their own.
#
#   ./scripts/start_demo.sh            # backend + map + frontend
#   HERA_DEMO_MODE=1 ./scripts/start_demo.sh   # map fully offline (no backend calls)
#
# Logs go to .demo-logs/. Stop everything with Ctrl-C.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGS="$ROOT/.demo-logs"
mkdir -p "$LOGS"
PIDS=()
cleanup() { for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null; done; }
trap cleanup EXIT INT TERM

# Backend (FastAPI). Needs backend/.venv with requirements installed.
if [ -x "$ROOT/backend/.venv/bin/uvicorn" ]; then
  (cd "$ROOT/backend" && exec .venv/bin/uvicorn app.main:app --port 8000) >"$LOGS/backend.log" 2>&1 &
  PIDS+=($!)
  echo "backend   http://127.0.0.1:8000   (log: .demo-logs/backend.log)"
  BACKEND_URL="http://127.0.0.1:8000"
else
  echo "backend   SKIPPED: create it with: cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  BACKEND_URL=""
fi

# Access map (stdlib only, always starts).
(cd "$ROOT/map" && HERA_API_URL="${HERA_API_URL:-$BACKEND_URL}" exec python3 -m hera_map.server) >"$LOGS/map.log" 2>&1 &
PIDS+=($!)
echo "map       http://127.0.0.1:8001/map/   (log: .demo-logs/map.log)"

# Frontend (Vite). Needs frontend/node_modules.
if [ -f "$ROOT/frontend/package.json" ] && [ -d "$ROOT/frontend/node_modules" ]; then
  (cd "$ROOT/frontend" && VITE_HERA_API_URL="${BACKEND_URL}" VITE_HERA_MAP_URL="http://127.0.0.1:8001" exec npx vite --port 5173 --strictPort) >"$LOGS/frontend.log" 2>&1 &
  PIDS+=($!)
  echo "frontend  http://localhost:5173   (log: .demo-logs/frontend.log)"
else
  echo "frontend  SKIPPED: run 'cd frontend && npm ci' first (or frontend not merged yet)"
fi

# Wait (up to 30s) for services to answer. A fresh clone's first start is slower.
wait_for() {
  for _ in $(seq 1 30); do curl -s -o /dev/null "$1" && return 0; sleep 1; done
  echo "warning: $1 did not respond within 30s"
}
[ -n "$BACKEND_URL" ] && wait_for "$BACKEND_URL/health"
wait_for "http://127.0.0.1:8001/health"
python3 "$ROOT/map/tools/preflight.py" || true
echo
echo "Running. Ctrl-C to stop."
wait
