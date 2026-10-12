#!/bin/bash
cd "$(dirname "$0")"
source .venv/bin/activate
export PYTHONUNBUFFERED=1

PORT=8765
echo "Stopping old process on :$PORT (if any)..."
lsof -tiTCP:$PORT -sTCP:LISTEN | xargs kill -9 2>/dev/null || true
sleep 1

echo "Starting validation UI on http://127.0.0.1:$PORT/"
echo "Keep this Terminal window open."
echo ""

# open browser after short delay
(sleep 2 && open "http://127.0.0.1:$PORT/") &

exec uvicorn server.app:app --host 127.0.0.1 --port "$PORT"
