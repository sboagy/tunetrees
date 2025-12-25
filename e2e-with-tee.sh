#!/usr/bin/env bash
set -euo pipefail

SHOW_REPORT=false
while getopts "r" opt; do
    case "$opt" in
        r) SHOW_REPORT=true ;;
        *) ;;
    esac
done
shift $((OPTIND - 1))

mkdir -p logs

LOG_FILE="logs/test-e2e-chromium-both-html.log"
rm -f "$LOG_FILE"

npm run test:e2e:chromium:both:html -- "$@" 2>&1 | tee "$LOG_FILE"

echo "logs are in $LOG_FILE"

if command -v code >/dev/null 2>&1; then
    if [ -n "${VSCODE_IPC_HOOK_CLI:-}" ] || [ "${TERM_PROGRAM:-}" = "vscode" ]; then
        code --reuse-window "$LOG_FILE" >/dev/null 2>&1 || true
    fi
fi

if [ "$SHOW_REPORT" = true ]; then
    npx playwright show-report
fi

