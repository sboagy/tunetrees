#!/bin/bash

# Test script to verify Alembic migrations work locally
# This creates a test database and applies migrations to verify they work

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
if [ "$PWD" = "$SCRIPT_DIR" ]; then
    cd ..
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Alembic Migration Test ===${NC}"

# Check if Alembic is available
if ! command -v alembic &> /dev/null; then
    echo -e "${RED}ERROR: Alembic is not installed. Run: pip install alembic${NC}"
    exit 1
fi

# Create a test database
TEST_DB="test_migration.sqlite3"
echo "Creating test database: $TEST_DB"

# Remove old test database if it exists
rm -f "$TEST_DB"

# Create empty database
touch "$TEST_DB"

echo -e "${YELLOW}Testing migration on empty database...${NC}"

# Apply all migrations to test database
alembic -x db_url="sqlite:///$(pwd)/$TEST_DB" upgrade head

echo -e "${GREEN}✓ Migrations applied successfully!${NC}"

# Show the resulting schema
echo -e "${YELLOW}Tables created:${NC}"
sqlite3 "$TEST_DB" "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

echo ""
echo -e "${YELLOW}Migration history:${NC}"
alembic -x db_url="sqlite:///$(pwd)/$TEST_DB" history

echo ""
echo -e "${GREEN}✓ Migration test completed successfully!${NC}"
echo "Test database: $TEST_DB"
echo ""
echo "You can inspect the test database with:"
echo "  sqlite3 $TEST_DB"
echo ""
echo "Clean up test database:"
echo "  rm $TEST_DB"
