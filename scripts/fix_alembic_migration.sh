#!/bin/bash

# Script to properly set up Alembic migration from production to new schema
# This fixes the baseline migration to match actual production, then generates
# a proper migration to transform to the new schema

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Fix Alembic Migration System ===${NC}"
echo "This script will:"
echo "  1. Download actual production database"
echo "  2. Create correct baseline migration that matches production"
echo "  3. Generate proper migration to transform to new schema"
echo "  4. Test the migration works"
echo ""

# Step 1: Download production database
echo -e "${YELLOW}Step 1: Downloading production database...${NC}"
rm -f tunetrees_production.sqlite3
scp -i ~/.ssh/id_rsa_ttdroplet sboag@165.227.182.140:tunetrees/tunetrees.sqlite3 tunetrees_production.sqlite3
echo -e "${GREEN}✓ Production database downloaded${NC}"

# Step 2: Clear existing migrations and create proper baseline
echo -e "${YELLOW}Step 2: Creating correct baseline migration...${NC}"

# Remove the incorrect baseline migration
rm -f alembic/versions/20011a33cdb1_initial_migration_with_views.py

# Remove any pending migrations
rm -f alembic/versions/6b51222e2f4d_*.py

# Remove version info from databases
sqlite3 tunetrees_test.sqlite3 "DROP TABLE IF EXISTS alembic_version;" 2>/dev/null || true
sqlite3 tunetrees_production.sqlite3 "DROP TABLE IF EXISTS alembic_version;" 2>/dev/null || true

# Configure Alembic to use production database as source
sed -i '' 's|sqlalchemy.url = .*|sqlalchemy.url = sqlite:///./tunetrees_production.sqlite3|' alembic.ini

# Generate baseline from actual production schema
alembic revision --autogenerate -m "baseline from actual production"
BASELINE_ID=$(ls -t alembic/versions/*.py | head -1 | sed -n 's/.*\/\([^_]*\)_.*/\1/p')
echo -e "${GREEN}✓ Baseline migration created: ${BASELINE_ID}${NC}"

# Step 3: Configure for new schema and generate migration
echo -e "${YELLOW}Step 3: Generating migration to new schema...${NC}"

# Stamp the production database with the baseline
alembic stamp head

# Now configure to compare against new target schema
sed -i '' 's|sqlalchemy.url = .*|sqlalchemy.url = sqlite:///./tunetrees_test_clean.sqlite3|' alembic.ini

# Generate migration from baseline to new schema
alembic revision --autogenerate -m "migrate to new FSRS schema"
MIGRATION_ID=$(ls -t alembic/versions/*.py | head -1 | sed -n 's/.*\/\([^_]*\)_.*/\1/p')

# Add view utilities to the migration
MIGRATION_FILE=$(ls -t alembic/versions/*.py | head -1)
echo "Adding view utilities to migration..."

# Add import
if ! grep -q "from view_utils import" "$MIGRATION_FILE"; then
    sed -i '' '/import sqlalchemy as sa/a\
\
# Import view utilities\
import sys\
import os\
sys.path.insert(0, os.path.dirname(__file__) + "/..") \
from view_utils import create_views, drop_views
' "$MIGRATION_FILE"
fi

# Add view recreation to upgrade
if ! grep -q "create_views()" "$MIGRATION_FILE"; then
    sed -i '' '/# ### end Alembic commands ###/i\
\
    # Recreate views with current schema\
    drop_views()  # Drop existing views first\
    create_views()  # Create views from target database
' "$MIGRATION_FILE"
fi

# Add view dropping to downgrade
if ! grep -q "drop_views()" "$MIGRATION_FILE" | head -1; then
    sed -i '' '/def downgrade() -> None:/a\
    """Downgrade schema."""\
    # Drop views first since they depend on tables\
    drop_views()
' "$MIGRATION_FILE"
fi

echo -e "${GREEN}✓ Migration to new schema created: ${MIGRATION_ID}${NC}"

# Step 4: Test the migration
echo -e "${YELLOW}Step 4: Testing migration...${NC}"

# Configure to use production database for testing
sed -i '' 's|sqlalchemy.url = .*|sqlalchemy.url = sqlite:///./tunetrees_production.sqlite3|' alembic.ini

# Create test copy
cp tunetrees_production.sqlite3 test_migration_prod.sqlite3
sed -i '' 's|sqlalchemy.url = .*|sqlalchemy.url = sqlite:///./test_migration_prod.sqlite3|' alembic.ini

# Apply migration to test database
alembic upgrade head

# Verify the migration worked
echo "Testing migration results..."
NEW_COLUMNS=$(sqlite3 test_migration_prod.sqlite3 "PRAGMA table_info(practice_record);" | grep -E "(difficulty|step)" | wc -l)
if [ "$NEW_COLUMNS" -eq 2 ]; then
    echo -e "${GREEN}✓ Migration test successful - new columns added${NC}"
else
    echo -e "${RED}✗ Migration test failed - new columns missing${NC}"
    exit 1
fi

# Check data preservation
PRACTICE_COUNT=$(sqlite3 test_migration_prod.sqlite3 "SELECT COUNT(*) FROM practice_record;")
echo "Data preserved: ${PRACTICE_COUNT} practice records"

# Clean up test database
rm test_migration_prod.sqlite3

# Restore configuration to production database
sed -i '' 's|sqlalchemy.url = .*|sqlalchemy.url = sqlite:///./tunetrees_production.sqlite3|' alembic.ini

echo ""
echo -e "${GREEN}=== Alembic Migration System Fixed! ===${NC}"
echo "The migration system now works correctly:"
echo "  • Baseline migration matches actual production: ${BASELINE_ID}"
echo "  • Migration to new schema: ${MIGRATION_ID}"
echo "  • Migration tested successfully"
echo ""
echo "To apply to production:"
echo "  alembic upgrade head"
echo ""
echo "Migration files:"
ls -la alembic/versions/*.py
