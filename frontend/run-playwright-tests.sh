#!/bin/bash

# Enhanced script to load .env.local and run playwright tests with organized output

# Record the start time (epoch seconds)
SCRIPT_START_TIME=$(date +%s)

# Function to print elapsed time
print_elapsed_time() {
  SCRIPT_END_TIME=$(date +%s)
  ELAPSED=$((SCRIPT_END_TIME - SCRIPT_START_TIME))
  printf "⏱️  Script running time: %02d:%02d:%02d\n" $((ELAPSED/3600)) $(( (ELAPSED%3600)/60 )) $((ELAPSED%60))
}

# Get the absolute path of this script
THIS_SCRIPT_ABS_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
echo "Running script: $THIS_SCRIPT_ABS_PATH"

# Get the directory containing this script
FRONTEND_DIR_ABS_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "frontend directory: $FRONTEND_DIR_ABS_PATH"

# Bind the directory one level up as TOP_REPO_ABS_PATH
TOP_REPO_ABS_PATH="$(cd "$FRONTEND_DIR_ABS_PATH/.." && pwd)"
echo "top-level repo directory: $TOP_REPO_ABS_PATH"

# Bind playwright-output directory to PLAYWRIGHT_OUTPUT_DIR
export PLAYWRIGHT_OUTPUT_DIR_ABS_PATH="$FRONTEND_DIR_ABS_PATH/playwright-output"
echo "PLAYWRIGHT_OUTPUT_DIR: $PLAYWRIGHT_OUTPUT_DIR_ABS_PATH"

# Function to cleanup background processes on exit
cleanup() {
  echo ""
  echo "🧹 Cleaning up background processes..."
  
  # Kill any remaining FastAPI servers
  pkill -f "uvicorn.*main:app" 2>/dev/null || true

  "$FRONTEND_DIR_ABS_PATH"/kill_backend_3000_servers.sh
  
  # Kill any remaining playwright processes (but not the test runner itself)
  # pkill -f "playwright test-server" 2>/dev/null || true
  
  # Don't kill all node playwright processes - they might be the test runner
  
  echo "🧹 Cleanup complete"
  print_elapsed_time
  exit 1
}

# Set up signal handlers for graceful cleanup
trap cleanup SIGINT SIGTERM

cp "$TOP_REPO_ABS_PATH"/tunetrees_test_clean.sqlite3 "$TOP_REPO_ABS_PATH"/tunetrees_test.sqlite3

# Create playwright-output directory if it doesn't exist
mkdir -p "$PLAYWRIGHT_OUTPUT_DIR_ABS_PATH"

# Generate timestamp for unique folder naming
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Determine output subdirectory name
if [ $# -eq 0 ]; then
  # No arguments - use timestamp only
  OUTPUT_DIR="$PLAYWRIGHT_OUTPUT_DIR_ABS_PATH/run_${TIMESTAMP}"
  TEST_FILE_ARG=""
  PLAYWRIGHT_ARGS=""
else
  # Use first argument as test name, remaining as additional playwright args
  TEST_NAME="$1"
  shift  # Remove first argument
  # Sanitize test name for directory (replace problematic chars)
  SAFE_TEST_NAME=$(echo "$TEST_NAME" | sed 's/[^a-zA-Z0-9_-]/_/g')
  OUTPUT_DIR="$PLAYWRIGHT_OUTPUT_DIR_ABS_PATH/${SAFE_TEST_NAME}_${TIMESTAMP}"
  TEST_FILE_ARG="$TEST_NAME"
  PLAYWRIGHT_ARGS="$@"  # Remaining arguments
fi

echo "🎭 Running Playwright tests..."
echo "📁 Output directory: $OUTPUT_DIR"

# Create the output directory
mkdir -p "$OUTPUT_DIR"

export PLAYWRIGHT_HTML_REPORT="$OUTPUT_DIR/html-report"

# Set custom log paths for frontend and backend logs
export TUNETREES_FRONTEND_LOG="$OUTPUT_DIR/frontend.log"
export TUNETREES_FASTAPI_LOG="$OUTPUT_DIR/fastapi.log"

# Check if --reporter is already specified in arguments
REPORTER_SPECIFIED=false
for arg in "$@"; do
  if [[ "$arg" == --reporter* ]]; then
    REPORTER_SPECIFIED=true
    break
  fi
done

# Use list reporter by default (better for CI/terminal viewing), but allow HTML override
if [ "$REPORTER_SPECIFIED" = false ]; then
  REPORTER_ARG="--reporter=list"
else
  REPORTER_ARG=""
fi

echo "Using reporter: $REPORTER_ARG"
echo "Test file argument: $TEST_FILE_ARG"
echo "Playwright arguments: $PLAYWRIGHT_ARGS"

echo "NEXTAUTH_SECRET before unset: $NEXTAUTH_SECRET"

# npx dotenv -f -e .env.local -- bash -c 'echo "NEXTAUTH_SECRET before unset, with dotenv: $NEXTAUTH_SECRET"'

# Unset the AUTH_SECRET and NEXTAUTH_SECRET to be extra careful they haven't been defined elsewhere.
unset AUTH_SECRET
unset NEXTAUTH_SECRET

# npx dotenv -f -e .env.local -- bash -c 'echo "NEXTAUTH_SECRET after unset, with dotenv: $NEXTAUTH_SECRET"'

# Run Playwright tests with environment variables loaded
# Make sure we're not running in NODE_ENV=production and that we have mock email confirmation enabled
cd "$FRONTEND_DIR_ABS_PATH"
npx dotenv -f .env.local -- bash -c '
NODE_ENV=development \
NEXT_PUBLIC_MOCK_EMAIL_CONFIRMATION=true \
npx playwright test '"$REPORTER_ARG"' '"$TEST_FILE_ARG"' '"$PLAYWRIGHT_ARGS"' \
| tee "'"$OUTPUT_DIR"'/playwright.log"
'

# Capture the exit code from playwright
PLAYWRIGHT_EXIT_CODE=$?

# Always cleanup before exiting (even on successful runs)
echo "🧹 Performing final cleanup..."
pkill -f "uvicorn.*main:app" 2>/dev/null || true
"$FRONTEND_DIR_ABS_PATH"/kill_backend_3000_servers.sh

# pkill -f "playwright test-server" 2>/dev/null || true
# Don't kill the main playwright test process here

# Check if tests ran successfully
if [ $PLAYWRIGHT_EXIT_CODE -eq 0 ]; then
  echo "✅ Tests completed successfully!"
else
  echo "❌ Tests failed or were interrupted"
fi

echo "📊 Results saved to: $OUTPUT_DIR"
echo "🔍 To view HTML report: npx playwright show-report $OUTPUT_DIR/html-report"
echo "🔍 To view traces: npx playwright show-trace $OUTPUT_DIR/test-results/*/trace.zip"
echo "� Frontend logs: $OUTPUT_DIR/test-results/frontend.log"
echo "📋 Backend logs: $OUTPUT_DIR/test-results/fastapi.log"
echo "�💡 For HTML report: add --reporter=html to command"

print_elapsed_time

# Exit with the same code as playwright
exit $PLAYWRIGHT_EXIT_CODE
