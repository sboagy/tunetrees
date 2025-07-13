#!/bin/bash

# Script to establish correct Alembic baseline from actual production database
# This should be run ONCE to set up the migration system correctly

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Establish Alembic Baseline from Production ===${NC}"
echo "This script will:"
echo "  1. Download actual production database from Digital Ocean"
echo "  2. Create correct baseline migration from production schema"
echo "  3. Set up migration system to work from real production baseline"
echo ""

# Step 1: Download actual production database
echo -e "${YELLOW}Step 1: Downloading production database from Digital Ocean...${NC}"

# Remove any existing production copy
rm -f tunetrees_production_baseline.sqlite3

# Download current production database
scp -i ~/.ssh/id_rsa_ttdroplet sboag@165.227.182.140:tunetrees/tunetrees.sqlite3 tunetrees_production_baseline.sqlite3

echo -e "${GREEN}✓ Production database downloaded as baseline${NC}"

# Step 2: Verify this is different from current baseline
echo -e "${YELLOW}Step 2: Checking if baseline migration needs updating...${NC}"

# Check if current baseline matches production
if [ -f "alembic/versions/20011a33cdb1_initial_migration_with_views.py" ]; then
    echo "Current baseline migration exists"
    
    # Test if current baseline creates the same schema as production
    cp tunetrees_production_baseline.sqlite3 test_baseline_match.sqlite3
    
    # Remove alembic version table from production copy
    sqlite3 test_baseline_match.sqlite3 "DROP TABLE IF EXISTS alembic_version;" 2>/dev/null || true
    
    # Try applying current baseline to see if it matches
    echo "Testing if current baseline matches production schema..."
    
    # Configure Alembic to use test database
    ORIGINAL_URL=$(grep "sqlalchemy.url" alembic.ini)
    sed -i '' 's|sqlalchemy.url = .*|sqlalchemy.url = sqlite:///./test_baseline_match.sqlite3|' alembic.ini
    
    # Create empty database and apply baseline
    rm -f test_empty_baseline.sqlite3
    touch test_empty_baseline.sqlite3
    sed -i '' 's|sqlalchemy.url = .*|sqlalchemy.url = sqlite:///./test_empty_baseline.sqlite3|' alembic.ini
    
    # Try to apply baseline
    if alembic upgrade 20011a33cdb1 2>/dev/null; then
        echo "Baseline migration applied successfully"
        
        # Compare schemas
        PROD_SCHEMA=$(sqlite3 test_baseline_match.sqlite3 ".schema" | grep -v "CREATE TABLE alembic_version" | sort)
        BASE_SCHEMA=$(sqlite3 test_empty_baseline.sqlite3 ".schema" | grep -v "CREATE TABLE alembic_version" | sort)
        
        if [ "$PROD_SCHEMA" = "$BASE_SCHEMA" ]; then
            echo -e "${GREEN}✓ Current baseline matches production schema - no update needed${NC}"
            # Restore original alembic.ini
            sed -i '' "s|sqlalchemy.url = .*|${ORIGINAL_URL}|" alembic.ini
            rm -f test_baseline_match.sqlite3 test_empty_baseline.sqlite3
            exit 0
        else
            echo -e "${YELLOW}⚠ Current baseline does not match production schema${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ Current baseline migration has issues${NC}"
    fi
    
    # Clean up test files
    rm -f test_baseline_match.sqlite3 test_empty_baseline.sqlite3
    
    # Restore original alembic.ini
    sed -i '' "s|sqlalchemy.url = .*|${ORIGINAL_URL}|" alembic.ini
else
    echo "No baseline migration found"
fi

# Step 3: Create new baseline from production
echo -e "${YELLOW}Step 3: Creating new baseline from actual production schema...${NC}"

# Backup existing migrations
if [ -d "alembic/versions" ]; then
    echo "Backing up existing migrations..."
    mkdir -p alembic/versions_backup
    cp alembic/versions/*.py alembic/versions_backup/ 2>/dev/null || true
fi

# Remove existing migrations (we'll recreate the baseline)
rm -f alembic/versions/*.py

# Configure Alembic to use production database
sed -i '' 's|sqlalchemy.url = .*|sqlalchemy.url = sqlite:///./tunetrees_production_baseline.sqlite3|' alembic.ini

# Remove alembic version table so we can generate clean
sqlite3 tunetrees_production_baseline.sqlite3 "DROP TABLE IF EXISTS alembic_version;" 2>/dev/null || true

# Generate baseline migration from production schema
echo "Generating baseline migration from production schema..."
alembic revision --autogenerate -m "baseline from actual production schema"

# Get the generated migration file
BASELINE_FILE=$(ls alembic/versions/*.py)
BASELINE_ID=$(basename "$BASELINE_FILE" | cut -d'_' -f1)

# Rename to be the standard baseline ID
mv "$BASELINE_FILE" "alembic/versions/20011a33cdb1_baseline_from_production.py"

# Update the migration ID in the file
sed -i '' "s/revision: str = '${BASELINE_ID}'/revision: str = '20011a33cdb1'/" alembic/versions/20011a33cdb1_baseline_from_production.py

# Add view utilities to the baseline
echo "Adding view utilities to baseline migration..."

# Add imports
if ! grep -q "from view_utils import" alembic/versions/20011a33cdb1_baseline_from_production.py; then
    sed -i '' '/import sqlalchemy as sa/a\
\
# Import view utilities\
import sys\
import os\
sys.path.insert(0, os.path.dirname(__file__) + "/..") \
from view_utils import create_views, drop_views
' alembic/versions/20011a33cdb1_baseline_from_production.py
fi

# Add view creation to upgrade function
if ! grep -q "create_views()" alembic/versions/20011a33cdb1_baseline_from_production.py; then
    sed -i '' '/# ### end Alembic commands ###/i\
\
    # Create views from target database\
    create_views()
' alembic/versions/20011a33cdb1_baseline_from_production.py
fi

# Add view dropping to downgrade function
if ! grep -q "drop_views()" alembic/versions/20011a33cdb1_baseline_from_production.py; then
    sed -i '' '/def downgrade() -> None:/a\
    """Downgrade schema."""\
    # Drop views first\
    drop_views()
' alembic/versions/20011a33cdb1_baseline_from_production.py
fi

echo -e "${GREEN}✓ Baseline migration created from production schema${NC}"

# Step 4: Stamp the production database
echo -e "${YELLOW}Step 4: Stamping production database with baseline...${NC}"

# Stamp the production database with the baseline
alembic stamp 20011a33cdb1

echo -e "${GREEN}✓ Production database stamped with correct baseline${NC}"

# Step 5: Reset configuration for normal use
echo -e "${YELLOW}Step 5: Configuring system for normal use...${NC}"

# Reset alembic.ini to use test database for development
sed -i '' 's|sqlalchemy.url = .*|sqlalchemy.url = sqlite:///./tunetrees_test.sqlite3|' alembic.ini

echo -e "${GREEN}✓ System configured for development${NC}"

echo ""
echo -e "${GREEN}=== Baseline Established Successfully! ===${NC}"
echo ""
echo "Next steps:"
echo "1. Generate migration to your target schema:"
echo "   ./scripts/generate_migration.sh"
echo ""
echo "2. Test the migration:"
echo "   ./scripts/test_migration.sh"
echo ""
echo "3. Deploy to production:"
echo "   ./scripts/migrate_prod_with_alembic.sh"
echo ""
echo "Files created:"
echo "• tunetrees_production_baseline.sqlite3 - Copy of actual production database"
echo "• alembic/versions/20011a33cdb1_baseline_from_production.py - Correct baseline migration"
echo ""
echo "The migration system now has the correct baseline matching your actual production database!"
