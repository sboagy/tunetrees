#!/usr/bin/env bash
set -euo pipefail

# This script runs a minimal Playwright login test that saves cookies
# into frontend/test-scripts/storageStateSboagyLogin.json. It is intended
# to be used in CI before running the full test suite.

cd "$(dirname "$0")/.."

export SAVE_COOKIES=true

# Ensure required env vars are present (NextAuth credentials)
if [[ -z "${TEST1_LOGIN_USER_EMAIL:-}" || -z "${TEST1_LOGIN_USER_PASSWORD:-}" ]]; then
  echo "TEST1_LOGIN_USER_EMAIL/TEST1_LOGIN_USER_PASSWORD not set" >&2
  exit 1
fi

# restore the DB
pwd
cp ../tunetrees_test_clean.sqlite3 ../tunetrees_test.sqlite3

mkdir -p test-results

# Run only the login test and tee output to a log file for CI artifacts
npx playwright test --project=chromium --reporter=list tests/test-login-1.spec.ts 2>&1 | tee test-results/playwright-phase1.log
# npm run test:ui:single tests/test-login-1.spec.ts 2>&1 | tee test-results/playwright-phase1.log

echo "Saved storage state at test-scripts/storageStateSboagyLogin.json"
