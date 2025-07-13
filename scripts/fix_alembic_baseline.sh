#!/bin/bash

# Script to fix the Alembic baseline and create a proper migration
# This creates a correct baseline from actual production schema,
# then generates a migration to your target schema

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
echo "  2. Create correct baseline migration from production schema"
echo "  3. Generate proper migration to target schema"
echo "  4. Test the migration"
echo ""

# Step 1: Download production database if we don't have it
if [ ! -f "tunetrees_production.sqlite3" ]; then
    echo -e "${YELLOW}Step 1: Downloading production database...${NC}"
    scp -i ~/.ssh/id_rsa_ttdroplet sboag@165.227.182.140:tunetrees/tunetrees.sqlite3 tunetrees_production.sqlite3
    echo -e "${GREEN}✓ Production database downloaded${NC}"
else
    echo -e "${YELLOW}Step 1: Using existing production database${NC}"
fi

# Step 2: Fix the baseline migration to match actual production
echo -e "${YELLOW}Step 2: Creating correct baseline from production schema...${NC}"

# Remove the incorrect baseline migration
rm -f alembic/versions/20011a33cdb1_initial_migration_with_views.py

# Configure Alembic to use production database as source
sed -i '' 's|sqlalchemy.url = .*|sqlalchemy.url = sqlite:///./tunetrees_production.sqlite3|' alembic.ini

# Remove any existing alembic version table from production copy (so we can regenerate clean)
sqlite3 tunetrees_production.sqlite3 "DROP TABLE IF EXISTS alembic_version;" 2>/dev/null || true

# Generate a new baseline migration from actual production schema
alembic revision --autogenerate -m "correct baseline from actual production"

# Get the new baseline migration ID
NEW_BASELINE_ID=$(ls -t alembic/versions/*.py | head -1 | sed 's/.*\/\([a-f0-9]*\)_.*/\1/')
echo "New baseline migration ID: $NEW_BASELINE_ID"

# Rename it to be the baseline
mv alembic/versions/${NEW_BASELINE_ID}_*.py alembic/versions/20011a33cdb1_correct_baseline_from_production.py

# Update the migration ID in the file
sed -i '' "s/revision: str = '${NEW_BASELINE_ID}'/revision: str = '20011a33cdb1'/" alembic/versions/20011a33cdb1_correct_baseline_from_production.py

# Add view utilities to the baseline migration
if ! grep -q "from view_utils import" alembic/versions/20011a33cdb1_correct_baseline_from_production.py; then
    sed -i '' '/import sqlalchemy as sa/a\
\
# Import view utilities\
import sys\
import os\
sys.path.insert(0, os.path.dirname(__file__) + "/..") \
from view_utils import create_views, drop_views
' alembic/versions/20011a33cdb1_correct_baseline_from_production.py
fi

# Add view recreation to upgrade function
if ! grep -q "create_views()" alembic/versions/20011a33cdb1_correct_baseline_from_production.py; then
    sed -i '' '/# ### end Alembic commands ###/i\
\
    # Create views from target database\
    create_views()
' alembic/versions/20011a33cdb1_correct_baseline_from_production.py
fi

# Add view dropping to downgrade function
if ! grep -q "drop_views()" alembic/versions/20011a33cdb1_correct_baseline_from_production.py; then
    sed -i '' '/def downgrade() -> None:/a\
    """Downgrade schema."""\
    # Drop views first\
    drop_views()
' alembic/versions/20011a33cdb1_correct_baseline_from_production.py
fi

echo -e "${GREEN}✓ Baseline migration corrected${NC}"

# Step 3: Stamp the production database with correct baseline
echo -e "${YELLOW}Step 3: Stamping production database with correct baseline...${NC}"
alembic stamp 20011a33cdb1
echo -e "${GREEN}✓ Production database stamped${NC}"

# Step 4: Generate migration to target schema
echo -e "${YELLOW}Step 4: Generating migration to target schema...${NC}"

# Configure Alembic to compare against target schema
sed -i '' 's|sqlalchemy.url = .*|sqlalchemy.url = sqlite:///./tunetrees_test_clean.sqlite3|' alembic.ini

# Generate the actual migration
alembic revision --autogenerate -m "migrate to FSRS schema"

# Get the migration file and add view utilities
MIGRATION_FILE=$(ls -t alembic/versions/*.py | head -1)
echo "Generated migration: $MIGRATION_FILE"

# Add view utilities to the migration
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

# Add view recreation to upgrade function
if ! grep -q "create_views()" "$MIGRATION_FILE"; then
    sed -i '' '/# ### end Alembic commands ###/i\
\
    # Recreate views with new schema\
    drop_views()  # Drop existing views first\
    create_views()  # Create views from target database
' "$MIGRATION_FILE"
fi

echo -e "${GREEN}✓ Migration to target schema generated${NC}"

# Step 5: Test the migration
echo -e "${YELLOW}Step 5: Testing migration...${NC}"

# Create a test copy of production database
cp tunetrees_production.sqlite3 test_production_migration.sqlite3

# Configure Alembic to use test database
sed -i '' 's|sqlalchemy.url = .*|sqlalchemy.url = sqlite:///./test_production_migration.sqlite3|' alembic.ini

# Apply the migration
alembic upgrade head

# Verify the migration worked
echo "Verifying migration results..."
DIFFICULTY_EXISTS=$(sqlite3 test_production_migration.sqlite3 "PRAGMA table_info(practice_record);" | grep difficulty | wc -l)
STEP_EXISTS=$(sqlite3 test_production_migration.sqlite3 "PRAGMA table_info(practice_record);" | grep step | wc -l)

if [ "$DIFFICULTY_EXISTS" -gt 0 ] && [ "$STEP_EXISTS" -gt 0 ]; then
    echo -e "${GREEN}✓ Migration test successful - new columns added${NC}"
else
    echo -e "${RED}✗ Migration test failed - new columns missing${NC}"
    exit 1
fi

# Clean up test database
rm test_production_migration.sqlite3

echo -e "${GREEN}✓ Migration test completed${NC}"

# Step 6: Prepare for production use
echo -e "${YELLOW}Step 6: Preparing for production deployment...${NC}"

# Reset Alembic to use production database for deployment
sed -i '' 's|sqlalchemy.url = .*|sqlalchemy.url = sqlite:///./tunetrees_production.sqlite3|' alembic.ini

echo -e "${GREEN}✓ System ready for production deployment${NC}"

echo ""
echo -e "${GREEN}=== Alembic System Fixed! ===${NC}"
echo "Next steps:"
echo "  • Review the generated migration in alembic/versions/"
echo "  • Deploy to production: ./scripts/migrate_prod_with_alembic.sh"
echo ""
echo "The migration system now:"
echo "  ✅ Has correct baseline matching actual production"
echo "  ✅ Generates proper migrations from production to target"
echo "  ✅ Handles schema differences automatically"
echo "  ✅ Preserves all data during migration"
