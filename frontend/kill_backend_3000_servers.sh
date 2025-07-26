#!/bin/bash
# kill_backend_3000_servers.sh
# Kills all processes listening on port 3000 (commonly used by Next.js dev server)

set -euo pipefail

PORT=3000

echo "Searching for processes listening on port $PORT..."

PIDS=$(lsof -ti tcp:$PORT || true)

if [ -z "${PIDS:-}" ]; then
  echo "No processes found on port $PORT."
  exit 0
fi

echo "Killing processes with PIDs: $PIDS"
kill -9 $PIDS

echo "All processes on port $PORT have been killed."
