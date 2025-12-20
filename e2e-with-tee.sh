#!/usr/bin/env bash
set -euo pipefail

mkdir -p logs

LOG_FILE="logs/test-e2e-chromium-both-html.log"
rm -f "$LOG_FILE"

npm run test:e2e:chromium:both:html -- "$@" 2>&1 | tee "$LOG_FILE"

echo logs are in "$LOG_FILE"

npx playwright show-report