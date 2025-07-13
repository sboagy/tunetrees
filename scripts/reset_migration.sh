#!/bin/bash

# Automated Migration Reset Script
# This script resets the current migration and generates a fresh one
# Usage: ./scripts/reset_migration.sh

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
if [ "$PWD" = "$SCRIPT_DIR" ]; then
    cd ..
fi

if [ ! -f "tunetrees.sqlite3" ]; then
    echo "ERROR: current directory must be the root of the tunetrees repo"
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== TuneTrees Migration Reset Script ===${NC}"
echo "This script will:"
echo "  1. Reset Alembic configuration to test database"
echo "  2. Find the latest migration ID"
echo "  3. Remove the pending migration file"
echo "  4. Reset database version to baseline"
echo "  5. Generate a fresh migration"
echo "  6. Test the new migration"
echo ""

# Step 0: Reset alembic.ini to use test database
echo -e "${YELLOW}Step 0: Resetting Alembic configuration...${NC}"
sed -i '' 's|sqlalchemy.url = .*|sqlalchemy.url = sqlite:///./tunetrees_test.sqlite3|' alembic.ini
echo -e "${GREEN}✓ Alembic configured to use tunetrees_test.sqlite3${NC}"

# Step 1: Find the latest migration ID
echo -e "${YELLOW}Step 1: Finding latest migration ID...${NC}"
LATEST_MIGRATION=$(alembic heads --resolve-dependencies | grep -o '^[a-f0-9]\{12\}' | head -1)

if [ -z "$LATEST_MIGRATION" ]; then
    echo -e "${RED}ERROR: Could not find current migration head${NC}"
    exit 1
fi

echo -e "Current migration head: ${BLUE}$LATEST_MIGRATION${NC}"

# Step 2: Remove the pending migration file
echo -e "${YELLOW}Step 2: Removing pending migration...${NC}"
MIGRATION_FILE="alembic/versions/${LATEST_MIGRATION}_*.py"
MIGRATION_REMOVED="false"

# Check if this is the baseline migration - if so, there might not be anything to remove
if [ "$LATEST_MIGRATION" = "20011a33cdb1" ]; then
    echo -e "${BLUE}Already at baseline migration (20011a33cdb1)${NC}"
    echo "Looking for any non-baseline migrations to remove..."
    
    # Look for any migrations that are NOT the baseline
    NON_BASELINE_MIGRATIONS=$(ls alembic/versions/*.py 2>/dev/null | grep -v "20011a33cdb1_initial_migration_with_views.py" || true)
    
    if [ -n "$NON_BASELINE_MIGRATIONS" ]; then
        echo "Found non-baseline migrations to remove:"
        echo "$NON_BASELINE_MIGRATIONS"
        rm $NON_BASELINE_MIGRATIONS
        MIGRATION_REMOVED="true"
        echo -e "${GREEN}✓ Non-baseline migration files removed${NC}"
    else
        echo -e "${BLUE}No non-baseline migrations found to remove${NC}"
    fi
else
    # Normal case - remove the current head migration
    if ls $MIGRATION_FILE 1> /dev/null 2>&1; then
        ACTUAL_FILE=$(ls $MIGRATION_FILE)
        echo "Removing: $ACTUAL_FILE"
        rm $MIGRATION_FILE
        MIGRATION_REMOVED="true"
        echo -e "${GREEN}✓ Migration file removed${NC}"
    else
        echo -e "${YELLOW}No migration file found matching: $MIGRATION_FILE${NC}"
    fi
fi

# Step 3: Verify back to baseline
echo -e "${YELLOW}Step 3: Verifying baseline state...${NC}"
BASELINE_CHECK=$(alembic heads --resolve-dependencies)
echo "Current state: $BASELINE_CHECK"

# Check if we need to reset the alembic version table
if echo "$BASELINE_CHECK" | grep -q "20011a33cdb1"; then
    echo -e "${GREEN}✓ Back to baseline migration${NC}"
else
    echo -e "${YELLOW}⚠ Warning: May not be at expected baseline${NC}"
fi

# Always check and fix the database version if we removed migrations or have issues
echo -e "${YELLOW}Step 4: Checking database version consistency...${NC}"

# Check if alembic_version table exists and what it contains
DB_VERSION=$(sqlite3 tunetrees_test.sqlite3 "SELECT version_num FROM alembic_version;" 2>/dev/null || echo "no_table")

if [ "$DB_VERSION" = "no_table" ]; then
    echo "No alembic_version table found - database needs initialization"
    echo "Stamping database with baseline migration..."
    alembic stamp 20011a33cdb1
    echo -e "${GREEN}✓ Database stamped with baseline migration${NC}"
elif [ "$DB_VERSION" != "20011a33cdb1" ]; then
    echo "Database version ($DB_VERSION) doesn't match baseline"
    echo "Updating database version to baseline..."
    sqlite3 tunetrees_test.sqlite3 "UPDATE alembic_version SET version_num = '20011a33cdb1';"
    echo -e "${GREEN}✓ Database version reset to baseline${NC}"
else
    echo -e "${GREEN}✓ Database version is correct (20011a33cdb1)${NC}"
fi

# Step 4: Generate fresh migration
echo -e "${YELLOW}Step 5: Generating fresh migration...${NC}"
if [ -f "./scripts/generate_migration.sh" ]; then
    ./scripts/generate_migration.sh
    echo -e "${GREEN}✓ Fresh migration generated${NC}"
else
    echo -e "${RED}ERROR: generate_migration.sh script not found${NC}"
    exit 1
fi

# Step 5: Test the new migration
echo -e "${YELLOW}Step 6: Testing new migration...${NC}"
if [ -f "./scripts/test_migration.sh" ]; then
    ./scripts/test_migration.sh
    echo -e "${GREEN}✓ Migration test completed${NC}"
else
    echo -e "${YELLOW}⚠ Warning: test_migration.sh script not found - skipping test${NC}"
fi

echo ""
echo -e "${GREEN}=== Migration Reset Complete! ===${NC}"
echo "Next steps:"
echo "  • Review the generated migration in alembic/versions/"
echo "  • When ready to deploy: ./scripts/migrate_prod_with_alembic.sh"
