#!/bin/bash

# This script fixes the migration system once and for all
# It creates a proper baseline that matches actual production schema

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
if [ "$PWD" = "$SCRIPT_DIR" ]; then
    cd ..
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Fixing TuneTrees Migration System ===${NC}"
echo "This script will:"
echo "  1. Download current production database"
echo "  2. Create a proper baseline migration from actual production schema" 
echo "  3. Generate a migration from production to target schema"
echo "  4. Test the complete migration system"
echo ""

# Step 1: Download production database
echo -e "${YELLOW}Step 1: Downloading production database...${NC}"
if [ -f tunetrees_production.sqlite3 ]; then
    rm tunetrees_production.sqlite3
fi

scp -i ~/.ssh/id_rsa_ttdroplet sboag@165.227.182.140:tunetrees/tunetrees.sqlite3 tunetrees_production.sqlite3
echo -e "${GREEN}✓ Production database downloaded${NC}"

# Step 2: Remove broken migrations and create proper baseline
echo -e "${YELLOW}Step 2: Creating proper baseline migration...${NC}"

# Remove all current migrations
rm -f alembic/versions/*.py

# Remove version info from all databases
sqlite3 tunetrees_test.sqlite3 "DROP TABLE IF EXISTS alembic_version;" 2>/dev/null || true
sqlite3 tunetrees_production.sqlite3 "DROP TABLE IF EXISTS alembic_version;" 2>/dev/null || true

# Configure Alembic to use production database as baseline
sed -i '' 's|sqlalchemy.url = .*|sqlalchemy.url = sqlite:///./tunetrees_production.sqlite3|' alembic.ini

# Generate baseline migration from actual production schema
echo "Generating baseline migration from production schema..."
alembic revision --autogenerate -m "baseline from actual production schema"

# Rename the baseline migration to have the expected ID
baseline_file=$(ls -t alembic/versions/*.py | head -1)
baseline_id=$(basename "$baseline_file" | cut -d'_' -f1)

# Create the proper baseline migration file
cat > "alembic/versions/20011a33cdb1_baseline_from_production.py" << 'EOF'
"""baseline from production

Revision ID: 20011a33cdb1
Revises: 
Create Date: 2025-07-11 22:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# Import view utilities from the local directory
import sys
import os
sys.path.insert(0, os.path.dirname(__file__) + "/..")
from view_utils import create_views, drop_views

# revision identifiers, used by Alembic.
revision: str = '20011a33cdb1'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None
EOF

# Copy the upgrade/downgrade functions from the generated baseline
echo "" >> "alembic/versions/20011a33cdb1_baseline_from_production.py"
sed -n '/def upgrade/,/def downgrade/p' "$baseline_file" | head -n -1 >> "alembic/versions/20011a33cdb1_baseline_from_production.py"

# Add view creation to upgrade function
cat >> "alembic/versions/20011a33cdb1_baseline_from_production.py" << 'EOF'

    # Create views after tables are created
    create_views()


def downgrade() -> None:
    """Downgrade schema."""
    # Drop views first since they depend on tables
    drop_views()
EOF

# Add the downgrade function from generated migration
sed -n '/def downgrade/,$p' "$baseline_file" | tail -n +2 >> "alembic/versions/20011a33cdb1_baseline_from_production.py"

# Remove the temporary generated baseline
rm "$baseline_file"

echo -e "${GREEN}✓ Proper baseline migration created${NC}"

# Step 3: Generate migration from production to target
echo -e "${YELLOW}Step 3: Generating production-to-target migration...${NC}"

# Configure Alembic to use target schema for comparison  
sed -i '' 's|sqlalchemy.url = .*|sqlalchemy.url = sqlite:///./tunetrees_test_clean.sqlite3|' alembic.ini

# Generate the actual migration needed
alembic revision --autogenerate -m "migrate production to target schema"

# Add view utilities to the new migration
migration_file=$(ls -t alembic/versions/*.py | head -1)
echo "Adding view utilities to migration..."

# Add imports
sed -i '' '/import sqlalchemy as sa/a\
\
# Import view utilities from the local directory\
import sys\
import os\
sys.path.insert(0, os.path.dirname(__file__) + "/..") \
from view_utils import create_views, drop_views
' "$migration_file"

# Add view recreation to upgrade function
sed -i '' '/# ### end Alembic commands ###/i\
\
    # Recreate views with current schema\
    drop_views()  # Drop existing views first\
    create_views()  # Create views from target database
' "$migration_file"

# Add view dropping to downgrade function
sed -i '' '/def downgrade() -> None:/a\
    """Downgrade schema."""\
    # Drop views first since they depend on tables\
    drop_views()
' "$migration_file"

echo -e "${GREEN}✓ Production-to-target migration created${NC}"

# Step 4: Test the migration system
echo -e "${YELLOW}Step 4: Testing migration system...${NC}"

# Configure test database to use baseline
sed -i '' 's|sqlalchemy.url = .*|sqlalchemy.url = sqlite:///./tunetrees_test.sqlite3|' alembic.ini

# Stamp test database with baseline
alembic stamp 20011a33cdb1
echo -e "${GREEN}✓ Test database stamped with baseline${NC}"

# Test the migration
echo "Testing migration from baseline to target..."
./scripts/test_migration.sh

echo -e "${GREEN}=== Migration System Fixed Successfully! ===${NC}"
echo ""
echo "The migration system is now properly configured:"
echo "• Baseline migration matches actual production schema"
echo "• Migration generated to transform production to target"
echo "• All scripts properly configure database URLs"
echo ""
echo "Next steps:"
echo "  ./scripts/migrate_prod_with_alembic.sh   # Apply to production"
