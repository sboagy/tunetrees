#!/bin/bash

# Helper script to generate new Alembic migrations when you update your models
# This should be run after you make changes to your SQLAlchemy models

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
if [ "$PWD" = "$SCRIPT_DIR" ]; then
    cd ..
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== TuneTrees Schema Migration Generator ===${NC}"

# Check if Alembic is available
if ! command -v alembic &> /dev/null; then
    echo "ERROR: Alembic is not installed. Run: pip install alembic"
    exit 1
fi

echo -e "${YELLOW}This script generates a new Alembic migration based on your model changes.${NC}"
echo ""
echo "Before running this:"
echo "1. Make sure you've updated your SQLAlchemy models in tunetrees/models/"
echo "2. Test your changes locally"
echo ""

read -p "Have you made and tested your model changes? (y/n): " changes_ready
if [[ "$changes_ready" != "y" && "$changes_ready" != "Y" ]]; then
    echo "Please make your model changes first, then run this script again."
    exit 1
fi

# Prompt for migration message
echo ""
read -p "Enter a brief description of your changes: " migration_msg

if [ -z "$migration_msg" ]; then
    migration_msg="Schema update $(date +%Y%m%d_%H%M%S)"
fi

echo ""
echo "Generating migration: $migration_msg"

# Configure Alembic to use target database (tunetrees_test_clean.sqlite3) 
# This represents the schema we want to achieve
echo "Configuring Alembic to compare against target schema..."
sed -i '' 's|sqlalchemy.url = .*|sqlalchemy.url = sqlite:///./tunetrees_test_clean.sqlite3|' alembic.ini

# Generate the migration - this will compare current baseline against target schema
alembic revision --autogenerate -m "$migration_msg"

# Get the most recent migration file
migration_file=$(ls -t alembic/versions/*.py | head -1)

echo -e "${YELLOW}Adding automatic view recreation to migration...${NC}"

# Add view imports to the migration file
if ! grep -q "from view_utils import" "$migration_file"; then
    # Add the import after the sqlalchemy import
    sed -i '' '/import sqlalchemy as sa/a\
\
# Import view utilities from the local directory\
import sys\
import os\
sys.path.insert(0, os.path.dirname(__file__) + "/..") \
from view_utils import create_views, drop_views
' "$migration_file"
fi

# Add view recreation to upgrade function (if not already there)
if ! grep -q "create_views()" "$migration_file"; then
    # Add create_views() before the end of the upgrade function
    sed -i '' '/# ### end Alembic commands ###/i\
\
    # Recreate views with current schema\
    drop_views()  # Drop existing views first\
    create_views()  # Create views from target database
' "$migration_file"
fi

# Add view dropping to downgrade function (if not already there)  
if ! grep -q "drop_views()" "$migration_file" | head -1; then
    # Add drop_views() after the downgrade function starts
    sed -i '' '/def downgrade() -> None:/a\
    """Downgrade schema."""\
    # Drop views first since they depend on tables\
    drop_views()
' "$migration_file"
    
    # Remove duplicate docstring if it exists
    sed -i '' '/"""Downgrade schema."""/{N;s/"""Downgrade schema."""\n    """Downgrade schema."""/"""Downgrade schema."""/}' "$migration_file"
fi

echo -e "${GREEN}✓ View recreation added to migration!${NC}"

echo -e "${GREEN}✓ Migration generated successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Review the generated migration file in alembic/versions/"
echo "2. Edit the migration if needed (add data migrations, etc.)"
echo "3. Test the migration locally:"
echo "   alembic upgrade head"
echo "4. When ready, run the production migration:"
echo "   ./scripts/migrate_prod_with_alembic.sh"
echo ""
echo -e "${YELLOW}Note: Migration files are excluded from linting as they contain auto-generated code${NC}"
echo ""
echo -e "${YELLOW}Generated migration files:${NC}"
ls -la alembic/versions/*.py | tail -1
