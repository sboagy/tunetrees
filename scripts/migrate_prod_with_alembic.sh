#!/bin/bash

# Enhanced migration script using Alembic instead of manual SQL
# This replaces the manual migrate_from_prod_db.sh script

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
NC='\033[0m' # No Color

echo -e "${GREEN}=== TuneTrees Production Database Migration with Alembic ===${NC}"

# Check if Alembic is available
if ! command -v alembic &> /dev/null; then
    echo -e "${RED}ERROR: Alembic is not installed. Run: pip install alembic${NC}"
    exit 1
fi

# Check if we need to update local schema first
echo -e "${YELLOW}Step 1: Schema Preparation${NC}"
echo "Your current workflow:"
echo "  1. Make schema changes in tunetrees_test_clean.sqlite3"
echo "  2. Copy it to tunetrees.sqlite3 to get the target schema"
echo "  3. Migrate production data to the new schema"
echo ""

read -p "Have you updated tunetrees_test_clean.sqlite3 with your schema changes? (y/n): " schema_ready
if [[ "$schema_ready" != "y" && "$schema_ready" != "Y" ]]; then
    echo -e "${RED}Please update tunetrees_test_clean.sqlite3 first, then run this script again.${NC}"
    exit 1
fi

read -p "Copy tunetrees_test_clean.sqlite3 to tunetrees.sqlite3 for target schema? (y/n): " copy_schema
if [[ "$copy_schema" == "y" || "$copy_schema" == "Y" ]]; then
    echo "Copying tunetrees_test_clean.sqlite3 to tunetrees.sqlite3..."
    cp tunetrees_test_clean.sqlite3 tunetrees.sqlite3
    echo -e "${GREEN}✓ Target schema ready${NC}"
else
    echo -e "${YELLOW}Using existing tunetrees.sqlite3 as target schema${NC}"
fi

# Generate new migration if models have changed
echo -e "${YELLOW}Step 2: Generate Migration (if needed)${NC}"
echo "Checking for model changes..."
alembic revision --autogenerate -m "Auto-generated migration $(date +%Y%m%d_%H%M%S)" || {
    echo -e "${YELLOW}No new migrations needed or generation failed${NC}"
}

# Create backup directories if they don't exist
mkdir -p tunetrees_do_backup
mkdir -p tunetrees_local_backup

# Get the current date for backup files
backup_date=$(date +%b_%d)
backup_file="./tunetrees_do_backup/backup_practice_${backup_date}.sqlite3"

echo -e "${YELLOW}Step 3: Download Production Database${NC}"
echo "Downloading production database from Digital Ocean..."

# Copy the remote database to a local backup file
scp -i ~/.ssh/id_rsa_ttdroplet sboag@165.227.182.140:tunetrees/tunetrees.sqlite3 "$backup_file"
echo -e "${GREEN}✓ Backup saved to: $backup_file${NC}"

# Copy the production DB to working file
scp -i ~/.ssh/id_rsa_ttdroplet sboag@165.227.182.140:tunetrees/tunetrees.sqlite3 "tunetrees_production.sqlite3"
echo -e "${GREEN}✓ Production DB downloaded as: tunetrees_production.sqlite3${NC}"

# Create local backup of current schema
cp tunetrees.sqlite3 "tunetrees_local_backup/tunetrees_${backup_date}.sqlite3"
echo -e "${GREEN}✓ Local backup saved to: tunetrees_local_backup/tunetrees_${backup_date}.sqlite3${NC}"

echo -e "${YELLOW}Step 4: Handle Known Issues & View Migration${NC}"
# Handle the view_playlist_joined issue that caused problems in your old script
echo "Checking for problematic views in production database..."

# Check if view_playlist_joined exists and might cause issues
sqlite3 tunetrees_production.sqlite3 "SELECT sql FROM sqlite_master WHERE type='view' AND name='view_playlist_joined';" > /tmp/view_check.sql 2>/dev/null || true

if [ -s /tmp/view_check.sql ]; then
    echo -e "${YELLOW}Found view_playlist_joined in production DB. This may cause migration issues.${NC}"
    read -p "Drop view_playlist_joined from production DB before migration? (recommended: y/n): " drop_view
    if [[ "$drop_view" == "y" || "$drop_view" == "Y" ]]; then
        sqlite3 tunetrees_production.sqlite3 "DROP VIEW IF EXISTS view_playlist_joined;"
        echo -e "${GREEN}✓ Dropped problematic view${NC}"
    fi
fi

# Important: The migration system will automatically recreate views from tunetrees.sqlite3
# This ensures views are always up-to-date with your schema changes
echo -e "${GREEN}✓ Views will be automatically updated from target schema${NC}"

echo -e "${YELLOW}Step 5: Apply Alembic Migrations${NC}"
echo "Applying migrations to production database..."

# Run Alembic migrations on the production database
export ALEMBIC_DB_URL="sqlite:///$(pwd)/tunetrees_production.sqlite3"
alembic -x db_url="$ALEMBIC_DB_URL" upgrade head

echo -e "${GREEN}✓ Migration completed successfully!${NC}"

echo -e "${YELLOW}Step 6: Verification${NC}"
echo "Checking migration results..."

# Quick verification - check table count and basic structure
prod_tables=$(sqlite3 tunetrees_production.sqlite3 "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
target_tables=$(sqlite3 tunetrees.sqlite3 "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")

# Check view count too
prod_views=$(sqlite3 tunetrees_production.sqlite3 "SELECT COUNT(*) FROM sqlite_master WHERE type='view';")
target_views=$(sqlite3 tunetrees.sqlite3 "SELECT COUNT(*) FROM sqlite_master WHERE type='view';")

echo "Migration verification:"
echo "  Tables  - Production: $prod_tables, Target: $target_tables"
echo "  Views   - Production: $prod_views, Target: $target_views"

if [ "$prod_tables" -eq "$target_tables" ] && [ "$prod_views" -eq "$target_views" ]; then
    echo -e "${GREEN}✓ Table and view counts match perfectly!${NC}"
elif [ "$prod_tables" -eq "$target_tables" ]; then
    echo -e "${GREEN}✓ Table counts match!${NC}"
    if [ "$prod_views" -ne "$target_views" ]; then
        echo -e "${YELLOW}⚠ View counts differ - this may be expected if view schema changed${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Table counts differ - this may be expected if schema changed${NC}"
fi

# List the views that were created
echo "Views in migrated database:"
sqlite3 tunetrees_production.sqlite3 "SELECT '  - ' || name FROM sqlite_master WHERE type='view' ORDER BY name;"

echo -e "${YELLOW}Step 7: Upload to Production${NC}"
echo "Migration completed successfully!"
echo ""
echo "Migrated database is ready: tunetrees_production.sqlite3"
echo ""
echo -e "${RED}IMPORTANT: Review the migrated database before uploading!${NC}"
echo ""

read -p "Upload migrated database to production server? (y/n): " upload_confirm
if [[ "$upload_confirm" == "y" || "$upload_confirm" == "Y" ]]; then
    echo "Uploading migrated database to Digital Ocean..."
    scp -i ~/.ssh/id_rsa_ttdroplet tunetrees_production.sqlite3 sboag@165.227.182.140:tunetrees/tunetrees.sqlite3
    echo -e "${GREEN}✓ Database uploaded to production!${NC}"
    echo -e "${GREEN}✓ Migration process complete!${NC}"
else
    echo -e "${YELLOW}Upload skipped. You can upload manually later with:${NC}"
    echo "scp -i ~/.ssh/id_rsa_ttdroplet tunetrees_production.sqlite3 sboag@165.227.182.140:tunetrees/tunetrees.sqlite3"
fi

echo ""
echo -e "${GREEN}=== Migration Summary ===${NC}"
echo "✓ Downloaded production DB to: $backup_file"
echo "✓ Created local backup: tunetrees_local_backup/tunetrees_${backup_date}.sqlite3"
echo "✓ Applied Alembic migrations to: tunetrees_production.sqlite3"
if [[ "$upload_confirm" == "y" || "$upload_confirm" == "Y" ]]; then
    echo "✓ Uploaded to production server"
else
    echo "• Upload pending (manual step required)"
fi
echo ""
echo -e "${GREEN}Migration completed successfully!${NC}"

# Cleanup
rm -f /tmp/view_check.sql
