#!/bin/bash
# Keep draining pending step2 until none left (chunked, resilient).
set -u
cd "$(dirname "$0")/.."
source .venv/bin/activate
LOG=/tmp/ai-val-step2.log
echo "==== step2 batch start $(date) ====" >> "$LOG"

while true; do
  PENDING=$(python - <<'PY'
from dotenv import load_dotenv
import os, psycopg
load_dotenv('.env', override=True)
c = psycopg.connect(
  host=os.getenv('DB_HOST'), port=int(os.getenv('DB_PORT')),
  dbname=os.getenv('DB_NAME'), user=os.getenv('DB_USERNAME'),
  password=os.getenv('DB_PASSWORD'),
)
print(c.execute("select count(*) from ai_model_validation where worth_use is null").fetchone()[0])
PY
)
  echo "[$(date +%H:%M:%S)] pending=$PENDING" >> "$LOG"
  if [ "$PENDING" -le 0 ]; then
    echo "==== all done $(date) ====" >> "$LOG"
    break
  fi
  # 2 workers × 20 per chunk ≈ manageable memory
  python -u scripts/step2_classify.py --limit 20 --workers 2 --sleep 0.1 >> "$LOG" 2>&1 || true
  sleep 1
done
