#!/bin/bash

echo "This script only holds snippets, and is not meant to be run"
exit 1

DEBUG=pw:browser*,webServer npx playwright test tests/test-2.spec.ts

npm outdated

lsof -i :3000

lsof -i :8000

kill -9 <PID>

pkill -f 'uvicorn'
