#!/bin/bash

# Enhanced script to load .env.local and run playwright tests with organized output

cp ../tunetrees_test_clean.sqlite3 ../tunetrees_test.sqlite3

# Create playwright-output directory if it doesn't exist
mkdir -p ../playwright-output

# Generate timestamp for unique folder naming
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Determine output subdirectory name
if [ $# -eq 0 ]; then
    # No arguments - use timestamp only
    OUTPUT_DIR="../playwright-output/run_${TIMESTAMP}"
else
    # Use first argument as test name, remaining as playwright args
    TEST_NAME="$1"
    shift
    # Sanitize test name for directory (replace problematic chars)
    SAFE_TEST_NAME=$(echo "$TEST_NAME" | sed 's/[^a-zA-Z0-9_-]/_/g')
    OUTPUT_DIR="../playwright-output/${SAFE_TEST_NAME}_${TIMESTAMP}"
fi

echo "🎭 Running Playwright tests..."
echo "📁 Output directory: $OUTPUT_DIR"

# Create the output directory
mkdir -p "$OUTPUT_DIR"

# Load environment variables and run playwright with custom output directory
# Set PLAYWRIGHT environment variables for custom output paths
export PLAYWRIGHT_TEST_RESULTS_DIR="$OUTPUT_DIR/test-results"
export PLAYWRIGHT_HTML_REPORT="$OUTPUT_DIR/html-report"

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

dotenv -f .env.local run npx playwright test \
    $REPORTER_ARG \
    "$@"

# Check if tests ran successfully
if [ $? -eq 0 ]; then
    echo "✅ Tests completed successfully!"
else
    echo "❌ Tests failed or were interrupted"
fi

echo "📊 Results saved to: $OUTPUT_DIR"
echo "🔍 To view HTML report: npx playwright show-report $OUTPUT_DIR/html-report"
echo "🔍 To view traces: npx playwright show-trace $OUTPUT_DIR/test-results/*/trace.zip"
echo "💡 For HTML report: add --reporter=html to command"

