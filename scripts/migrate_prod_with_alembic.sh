#!/bin/bash

# Enhanced migration script using Alembic instead of manual SQL
# This replaces the manual migrate_from_prod_db.sh script

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
if [ "$PWD" = "$SCRIPT_DIR" ]; then
    cd ..
fi

# Check we're in the tunetrees repo root by looking for key files
if [ ! -f "tunetrees_test_clean.sqlite3" ] || [ ! -f "alembic.ini" ] || [ ! -d "tunetrees" ]; then
    echo "ERROR: current directory must be the root of the tunetrees repo"
    echo "Expected files: tunetrees_test_clean.sqlite3, alembic.ini, tunetrees/ directory"
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== TuneTrees Production Database Migration with Alembic ===${NC}"

# Check if there's a recent successful deployment
DEPLOYMENT_LOG="./migration_deployments.log"
CURRENT_HEAD=$(alembic heads --resolve-dependencies | head -n1 | awk '{print $1}')

if [ -f "$DEPLOYMENT_LOG" ]; then
    LAST_DEPLOYED=$(tail -n1 "$DEPLOYMENT_LOG" | awk '{print $3}')
    if [ "$LAST_DEPLOYED" = "$CURRENT_HEAD" ]; then
        echo -e "${YELLOW}⚠️  Current migrations ($CURRENT_HEAD) already deployed to production!${NC}"
        echo "Last deployment: $(tail -n1 "$DEPLOYMENT_LOG")"
        echo ""
        read -p "Continue anyway? This will re-download and re-apply the same migrations (y/n): " force_continue
        if [[ "$force_continue" != "y" && "$force_continue" != "Y" ]]; then
            echo "Migration cancelled."
            exit 0
        fi
        echo ""
    fi
fi

# Check if Alembic is available
if ! command -v alembic &> /dev/null; then
    echo -e "${RED}ERROR: Alembic is not installed. Run: pip install alembic${NC}"
    exit 1
fi

# Check if we have pending migrations to apply
echo -e "${YELLOW}Step 1: Migration Preparation${NC}"
echo "This script will:"
echo "  1. Download the production database (old schema + real data)"
echo "  2. Apply Alembic migrations to transform it to the new schema"
echo "  3. Upload the migrated database back to production"
echo ""

# Check for pending migrations
echo "Checking for pending migrations..."
pending_migrations=$(alembic heads | wc -l)
if [ "$pending_migrations" -eq 0 ]; then
    echo -e "${RED}ERROR: No migrations found. Generate a migration first with ./scripts/generate_migration.sh${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Found migrations ready to apply${NC}"

# Create backup directories if they don't exist
mkdir -p tunetrees_do_backup
mkdir -p tunetrees_local_backup

# Get the current date for backup files
backup_date=$(date +%b_%d)
backup_file="./tunetrees_do_backup/backup_practice_${backup_date}.sqlite3"

echo -e "${YELLOW}Step 2: Download Production Database${NC}"
echo "Downloading production database from Digital Ocean..."

# Copy the remote database to a local backup file
scp -i ~/.ssh/id_rsa_ttdroplet sboag@165.227.182.140:tunetrees/tunetrees.sqlite3 "$backup_file"
echo -e "${GREEN}✓ Backup saved to: $backup_file${NC}"

# Remove any existing production database copy to ensure fresh download
if [ -f "tunetrees_production.sqlite3" ]; then
    echo "Removing existing tunetrees_production.sqlite3 for fresh download..."
    rm "tunetrees_production.sqlite3"
fi

# Copy the production DB to working file for migration
scp -i ~/.ssh/id_rsa_ttdroplet sboag@165.227.182.140:tunetrees/tunetrees.sqlite3 "tunetrees_production.sqlite3"
echo -e "${GREEN}✓ Production DB downloaded as: tunetrees_production.sqlite3${NC}"

echo -e "${YELLOW}Step 3: Handle Known Issues & View Migration${NC}"
# Drop all views automatically - they will be recreated by the migration
echo "Dropping all views from production database (they will be recreated)..."

# Get list of all views and drop them
sqlite3 tunetrees_production.sqlite3 "SELECT name FROM sqlite_master WHERE type='view';" | while read view_name; do
    if [ -n "$view_name" ]; then
        echo "  Dropping view: $view_name"
        sqlite3 tunetrees_production.sqlite3 "DROP VIEW IF EXISTS \"$view_name\";"
    fi
done

echo -e "${GREEN}✓ All views dropped (will be recreated by migration)${NC}"

echo -e "${YELLOW}Step 4: Apply Alembic Migrations${NC}"
echo "Applying migrations to production database..."

# Verify alembic.ini points to the correct database
current_db_url=$(grep "sqlalchemy.url" alembic.ini)
echo "Using database: $current_db_url"

# Check if the production database has alembic_version table
echo "Checking production database migration state..."
if ! sqlite3 tunetrees_production.sqlite3 "SELECT name FROM sqlite_master WHERE type='table' AND name='alembic_version';" | grep -q "alembic_version"; then
    echo "Production database needs to be stamped with baseline migration..."
    alembic stamp baseline
    echo -e "${GREEN}✓ Production database stamped with baseline migration${NC}"
else
    current_version=$(sqlite3 tunetrees_production.sqlite3 "SELECT version_num FROM alembic_version LIMIT 1;" 2>/dev/null || echo "none")
    echo "Production database is at migration: $current_version"
fi

# Apply migrations to the production database
alembic upgrade head

echo -e "${GREEN}✓ Migration completed successfully!${NC}"

echo -e "${YELLOW}Step 5: Verification${NC}"
echo "Checking migration results..."

# Quick verification - check table count and basic structure against clean schema
prod_tables=$(sqlite3 tunetrees_production.sqlite3 "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
clean_tables=$(sqlite3 tunetrees_test_clean.sqlite3 "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")

# Check view count too
prod_views=$(sqlite3 tunetrees_production.sqlite3 "SELECT COUNT(*) FROM sqlite_master WHERE type='view';")
clean_views=$(sqlite3 tunetrees_test_clean.sqlite3 "SELECT COUNT(*) FROM sqlite_master WHERE type='view';")

echo "Migration verification:"
echo "  Tables  - Migrated: $prod_tables, Expected (clean): $clean_tables"
echo "  Views   - Migrated: $prod_views, Expected (clean): $clean_views"

if [ "$prod_tables" -eq "$clean_tables" ] && [ "$prod_views" -eq "$clean_views" ]; then
    echo -e "${GREEN}✓ Table and view counts match clean schema perfectly!${NC}"
elif [ "$prod_tables" -eq "$clean_tables" ]; then
    echo -e "${GREEN}✓ Table counts match clean schema!${NC}"
    if [ "$prod_views" -ne "$clean_views" ]; then
        echo -e "${YELLOW}⚠ View counts differ from clean schema - this may be expected${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Table counts differ from clean schema - please review${NC}"
fi

# List the views that were created
echo "Views in migrated database:"
sqlite3 tunetrees_production.sqlite3 "SELECT '  - ' || name FROM sqlite_master WHERE type='view' ORDER BY name;"

echo -e "${YELLOW}Step 6: Critical Schema Validation${NC}"
echo "Performing final schema comparison before upload..."

# Function to extract schema in normalized format for comparison
extract_schema_for_comparison() {
    local db_file="$1"
    local temp_file="$2"
    
    # Extract schemas with proper formatting and organization
    {
        echo "-- ===== TABLES ====="
        sqlite3 "$db_file" "SELECT '-- Table: ' || name || CHAR(10) || sql || CHAR(10) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'alembic_version' ORDER BY name;"
        echo ""
        
        echo "-- ===== INDEXES ====="
        sqlite3 "$db_file" "SELECT '-- Index: ' || name || CHAR(10) || sql || CHAR(10) FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY name;"
        echo ""
        
        echo "-- ===== VIEWS ====="
        sqlite3 "$db_file" "SELECT '-- View: ' || name || CHAR(10) || sql || CHAR(10) FROM sqlite_master WHERE type='view' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
        echo ""
        
        echo "-- ===== TRIGGERS ====="
        sqlite3 "$db_file" "SELECT '-- Trigger: ' || name || CHAR(10) || sql || CHAR(10) FROM sqlite_master WHERE type='trigger' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
    } > "$temp_file"
    
    # Clean up any empty sections
    sed -i.bak '/^-- ===== [A-Z]* =====$/,/^-- ===== [A-Z]* =====$/{
        /^-- ===== [A-Z]* =====$/!{
            /^-- ===== [A-Z]* =====$/!{
                /^$/d
            }
        }
    }' "$temp_file" 2>/dev/null || true
    rm -f "$temp_file.bak" 2>/dev/null || true
}

# Create temporary files for schema comparison
TEMP_MIGRATED_SCHEMA=$(mktemp)
TEMP_CLEAN_SCHEMA=$(mktemp)

# Ensure cleanup on exit
cleanup_temp_files() {
    rm -f "$TEMP_MIGRATED_SCHEMA" "$TEMP_CLEAN_SCHEMA"
}
trap cleanup_temp_files EXIT

echo "Extracting migrated database schema..."
extract_schema_for_comparison "tunetrees_production.sqlite3" "$TEMP_MIGRATED_SCHEMA"

echo "Extracting clean test schema..."
extract_schema_for_comparison "tunetrees_test_clean.sqlite3" "$TEMP_CLEAN_SCHEMA"

echo "Comparing schemas..."
if diff -q "$TEMP_CLEAN_SCHEMA" "$TEMP_MIGRATED_SCHEMA" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ SCHEMA VALIDATION PASSED: Migrated database schema matches clean test schema exactly!${NC}"
    echo ""
else
    echo -e "${RED}❌ SCHEMA VALIDATION FAILED: Migrated database schema differs from clean test schema!${NC}"
    echo ""
    echo -e "${YELLOW}Schema differences detected:${NC}"
    diff -u "$TEMP_CLEAN_SCHEMA" "$TEMP_MIGRATED_SCHEMA" | head -20
    echo ""
    echo -e "${RED}CRITICAL: Schema drift detected! Upload blocked for safety.${NC}"
    echo ""
    echo "This indicates the migration didn't produce the expected schema."
    echo "Possible causes:"
    echo "  - Migration script is incomplete or incorrect"
    echo "  - Production database had unexpected pre-existing changes"
    echo "  - Migration failed to apply completely"
    echo ""
    echo "To debug this:"
    echo "  1. Review the schema differences above"
    echo "  2. Check if migration scripts are complete"
    echo "  3. Ensure tunetrees_test_clean.sqlite3 represents the target schema"
    echo "  4. Re-run migration after fixing the issues"
    echo ""
    echo -e "${YELLOW}Migration aborted - database NOT uploaded to production.${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 7: Upload to Production${NC}"
echo "Migration completed successfully!"
echo ""
echo "Migrated database is ready: tunetrees_production.sqlite3"
echo -e "${GREEN}✓ Schema validation passed - safe to upload${NC}"
echo ""
echo -e "${RED}IMPORTANT: Final review before uploading to production!${NC}"
echo ""

read -p "Upload migrated database to production server? (y/n): " upload_confirm
if [[ "$upload_confirm" == "y" || "$upload_confirm" == "Y" ]]; then
    echo "Uploading migrated database to Digital Ocean..."
    scp -i ~/.ssh/id_rsa_ttdroplet tunetrees_production.sqlite3 sboag@165.227.182.140:tunetrees/tunetrees.sqlite3
    echo -e "${GREEN}✓ Database uploaded to production!${NC}"
    
    # Log successful deployment
    echo "$(date '+%Y-%m-%d %H:%M:%S') $CURRENT_HEAD $(whoami)" >> "$DEPLOYMENT_LOG"
    echo -e "${GREEN}✓ Deployment logged to $DEPLOYMENT_LOG${NC}"
    echo -e "${GREEN}✓ Migration process complete!${NC}"
else
    echo -e "${YELLOW}Upload skipped. You can upload manually later with:${NC}"
    echo "scp -i ~/.ssh/id_rsa_ttdroplet tunetrees_production.sqlite3 sboag@165.227.182.140:tunetrees/tunetrees.sqlite3"
    echo ""
    echo -e "${YELLOW}Note: To log manual deployment, add this line to $DEPLOYMENT_LOG:${NC}"
    echo "$(date '+%Y-%m-%d %H:%M:%S') $CURRENT_HEAD $(whoami)"
fi

# Update production baseline snapshot
echo ""
echo -e "${CYAN}Updating production baseline snapshot...${NC}"
if cp tunetrees_production.sqlite3 true_production_baseline.sqlite3; then
    echo -e "${GREEN}✓ Updated true_production_baseline.sqlite3 with migrated production state${NC}"
else
    echo -e "${RED}✗ Failed to update true_production_baseline.sqlite3${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}=== Migration Summary ===${NC}"
echo "✓ Downloaded production DB to: $backup_file"
echo "✓ Created local backup: tunetrees_local_backup/tunetrees_${backup_date}.sqlite3"
echo "✓ Applied Alembic migrations to: tunetrees_production.sqlite3"
echo "✓ Updated production baseline: true_production_baseline.sqlite3"
if [[ "$upload_confirm" == "y" || "$upload_confirm" == "Y" ]]; then
    echo "✓ Uploaded to production server"
else
    echo "• Upload pending (manual step required)"
fi
echo ""
echo -e "${GREEN}Migration completed successfully!${NC}"

# Cleanup
rm -f /tmp/view_check.sql
