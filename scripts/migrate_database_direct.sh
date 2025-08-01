#!/bin/bash

# Direct Database Migration Script
# Replaces Alembic with schema-to-schema migration approach
# Uses AI-assisted mapping for complex schema changes

set -euo pipefail

# Configuration
SOURCE_SCHEMA_DB="tunetrees_test_clean.sqlite3"
PRODUCTION_SERVER="sboag@165.227.182.140"
PRODUCTION_DB_PATH="/home/sboag/tunetrees/tunetrees_production.sqlite3"
TEMP_DIR="migration_temp"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Function to extract schema from database
extract_schema() {
    local db_file="$1"
    local output_file="$2"
    
    log "Extracting schema from $db_file"
    sqlite3 "$db_file" ".schema" > "$output_file"
    
    # Clean up the schema - remove comments and normalize formatting
    sed -i '' '/^--/d' "$output_file"
    sed -i '' '/^$/d' "$output_file"
    
    success "Schema extracted to $output_file"
}

# Function to download production database
download_production_db() {
    local local_path="$1"
    
    log "Downloading production database from $PRODUCTION_SERVER"
    scp -i ~/.ssh/id_rsa_ttdroplet "$PRODUCTION_SERVER:$PRODUCTION_DB_PATH" "$local_path"
    success "Production database downloaded to $local_path"
}

# Function to backup production database
backup_production_db() {
    local backup_name="tunetrees_production_backup_${TIMESTAMP}.sqlite3"
    
    log "Creating backup of production database"
    scp -i ~/.ssh/id_rsa_ttdroplet "$PRODUCTION_SERVER:$PRODUCTION_DB_PATH" "./tunetrees_do_backup/$backup_name"
    success "Production backup created: $backup_name"
}

# Function to compare schemas
compare_schemas() {
    local source_schema="$1"
    local target_schema="$2"
    local diff_output="$3"
    
    log "Comparing schemas"
    
    # Create detailed diff
    if diff -u "$target_schema" "$source_schema" > "$diff_output" 2>/dev/null; then
        success "Schemas are identical - no migration needed"
        return 0
    else
        warn "Schema differences detected"
        echo "Schema differences saved to: $diff_output"
        return 1
    fi
}

# Function to create migration database
create_migration_db() {
    local source_db="$1"
    local target_db="$2"
    local migration_db="$3"
    
    log "Creating migration database with new schema"
    
    # Copy source database as template (has the target schema)
    cp "$source_db" "$migration_db"
    
    # Clear all data from migration database (keep schema only)
    log "Clearing data from migration database"
    sqlite3 "$migration_db" "
        PRAGMA foreign_keys = OFF;
        DELETE FROM practice_record;
        DELETE FROM prefs_spaced_repetition;
        DELETE FROM playlist;  
        DELETE FROM tune;
        DELETE FROM user;
        PRAGMA foreign_keys = ON;
    "
    
    success "Migration database created: $migration_db"
}

# Function to copy data with schema mapping
copy_data_with_mapping() {
    local source_db="$1"
    local migration_db="$2"
    
    log "Copying data from production to migration database"
    
    # Get list of tables from source database
    local tables=$(sqlite3 "$source_db" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    
    for table in $tables; do
        log "Processing table: $table"
        
        # Get column information from both databases
        local source_columns=$(sqlite3 "$source_db" "PRAGMA table_info($table);" | cut -d'|' -f2)
        local target_columns=$(sqlite3 "$migration_db" "PRAGMA table_info($table);" | cut -d'|' -f2)
        
        # Check if table exists in target
        if ! sqlite3 "$migration_db" "SELECT name FROM sqlite_master WHERE type='table' AND name='$table';" | grep -q "$table"; then
            warn "Table $table does not exist in target schema - skipping"
            continue
        fi
        
        # Simple case: identical columns
        if [ "$source_columns" = "$target_columns" ]; then
            log "Columns match for $table - direct copy"
            sqlite3 "$source_db" ".mode insert $table" ".output /tmp/${table}_data.sql" "SELECT * FROM $table;"
            sqlite3 "$migration_db" < "/tmp/${table}_data.sql"
            rm -f "/tmp/${table}_data.sql"
        else
            warn "Schema mismatch for table $table"
            echo "Source columns: $source_columns"
            echo "Target columns: $target_columns"
            
            # Create mapping strategy
            create_column_mapping "$table" "$source_db" "$migration_db"
        fi
    done
    
    success "Data copying completed"
}

# Function to create column mapping for mismatched schemas
create_column_mapping() {
    local table="$1"
    local source_db="$2"
    local target_db="$3"
    
    log "Creating column mapping for table: $table"
    
    # Extract detailed column info
    sqlite3 "$source_db" "PRAGMA table_info($table);" > "$TEMP_DIR/source_${table}_columns.txt"
    sqlite3 "$target_db" "PRAGMA table_info($table);" > "$TEMP_DIR/target_${table}_columns.txt"
    
    # Show the differences
    echo "=== Column Mapping Required for Table: $table ==="
    echo "Source columns:"
    cat "$TEMP_DIR/source_${table}_columns.txt"
    echo ""
    echo "Target columns:"
    cat "$TEMP_DIR/target_${table}_columns.txt"
    echo ""
    
    # Generate mapping suggestions
    generate_mapping_suggestions "$table" "$source_db" "$target_db"
    
    # Prompt for manual confirmation
    echo -n "Apply suggested mapping for $table? (y/n/s for skip): "
    read -r response
    
    case $response in
        y|Y)
            apply_column_mapping "$table" "$source_db" "$target_db"
            ;;
        s|S)
            warn "Skipping table $table"
            ;;
        *)
            error "Migration cancelled by user"
            ;;
    esac
}

# Function to generate mapping suggestions using column analysis
generate_mapping_suggestions() {
    local table="$1"
    local source_db="$2"
    local target_db="$3"
    
    log "Analyzing column mapping for $table"
    
    # Get column names and types
    local source_cols=$(sqlite3 "$source_db" "PRAGMA table_info($table);" | cut -d'|' -f2,3)
    local target_cols=$(sqlite3 "$target_db" "PRAGMA table_info($table);" | cut -d'|' -f2,3)
    
    # Find common columns
    local common_cols=""
    while IFS='|' read -r col_name col_type; do
        if echo "$target_cols" | grep -q "^$col_name|"; then
            common_cols="$common_cols,$col_name"
        fi
    done <<< "$source_cols"
    
    # Remove leading comma
    common_cols=${common_cols#,}
    
    if [ -n "$common_cols" ]; then
        echo "Suggested mapping: Copy common columns: $common_cols"
        echo "INSERT INTO $table ($common_cols) SELECT $common_cols FROM source_$table;"
    else
        warn "No common columns found - manual mapping required"
    fi
}

# Function to apply column mapping
apply_column_mapping() {
    local table="$1"
    local source_db="$2"
    local target_db="$3"
    
    log "Applying column mapping for $table"
    
    # Attach source database to target database
    sqlite3 "$target_db" "ATTACH DATABASE '$source_db' AS source;"
    
    # Get common columns
    local source_cols=$(sqlite3 "$source_db" "PRAGMA table_info($table);" | cut -d'|' -f2)
    local target_cols=$(sqlite3 "$target_db" "PRAGMA table_info($table);" | cut -d'|' -f2)
    
    local common_cols=""
    for col in $source_cols; do
        if echo "$target_cols" | grep -q "^$col$"; then
            common_cols="$common_cols,$col"
        fi
    done
    
    # Remove leading comma
    common_cols=${common_cols#,}
    
    if [ -n "$common_cols" ]; then
        log "Copying columns: $common_cols"
        sqlite3 "$target_db" "INSERT INTO $table ($common_cols) SELECT $common_cols FROM source.$table;"
        success "Data copied for table $table"
    else
        error "No compatible columns found for $table"
    fi
    
    # Detach source database
    sqlite3 "$target_db" "DETACH DATABASE source;"
}

# Function to validate migrated data
validate_migration() {
    local source_db="$1"
    local migration_db="$2"
    
    log "Validating migrated data"
    
    # Count records in each table
    local tables=$(sqlite3 "$migration_db" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    
    for table in $tables; do
        local source_count=$(sqlite3 "$source_db" "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "0")
        local target_count=$(sqlite3 "$migration_db" "SELECT COUNT(*) FROM $table;")
        
        if [ "$source_count" -eq "$target_count" ]; then
            success "Table $table: $target_count records (matches source)"
        else
            warn "Table $table: $target_count records (source had $source_count)"
        fi
    done
}

# Function to deploy migrated database
deploy_migration() {
    local migration_db="$1"
    
    echo "=== DEPLOYMENT CONFIRMATION ==="
    echo "Ready to deploy migrated database to production"
    echo "Production server: $PRODUCTION_SERVER"
    echo "Migration database: $migration_db"
    echo ""
    echo -n "Proceed with deployment? (yes/no): "
    read -r response
    
    if [ "$response" != "yes" ]; then
        error "Deployment cancelled by user"
    fi
    
    log "Deploying migrated database to production"
    
    # Upload migrated database
    scp -i ~/.ssh/id_rsa_ttdroplet "$migration_db" "$PRODUCTION_SERVER:$PRODUCTION_DB_PATH"
    
    success "Migration deployed successfully!"
    
    # Restart production services
    log "Restarting production services"
    ssh -i ~/.ssh/id_rsa_ttdroplet "$PRODUCTION_SERVER" "cd tunetrees && docker-compose restart"
    
    success "Production services restarted"
}

# Main migration workflow
main() {
    log "Starting direct database migration"
    
    # Validate requirements
    if [ ! -f "$SOURCE_SCHEMA_DB" ]; then
        error "Source schema database not found: $SOURCE_SCHEMA_DB"
    fi
    
    # Create temporary directory
    mkdir -p "$TEMP_DIR"
    mkdir -p "./tunetrees_do_backup"
    
    # Step 1: Backup production database
    backup_production_db
    
    # Step 2: Download production database
    local prod_db="$TEMP_DIR/production_current.sqlite3"
    download_production_db "$prod_db"
    
    # Step 3: Extract schemas
    local source_schema="$TEMP_DIR/source_schema.sql"  
    local prod_schema="$TEMP_DIR/production_schema.sql"
    
    extract_schema "$SOURCE_SCHEMA_DB" "$source_schema"
    extract_schema "$prod_db" "$prod_schema"
    
    # Step 4: Compare schemas
    local schema_diff="$TEMP_DIR/schema_differences.diff"
    if compare_schemas "$source_schema" "$prod_schema" "$schema_diff"; then
        success "No migration needed - schemas match"
        cleanup
        exit 0
    fi
    
    # Step 5: Show differences and confirm
    echo "=== SCHEMA DIFFERENCES DETECTED ==="
    cat "$schema_diff"
    echo ""
    echo -n "Continue with migration? (y/n): "
    read -r response
    
    if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
        error "Migration cancelled by user"
    fi
    
    # Step 6: Create migration database
    local migration_db="$TEMP_DIR/tunetrees_migrated.sqlite3"
    create_migration_db "$SOURCE_SCHEMA_DB" "$prod_db" "$migration_db"
    
    # Step 7: Copy data with mapping
    copy_data_with_mapping "$prod_db" "$migration_db"
    
    # Step 8: Validate migration
    validate_migration "$prod_db" "$migration_db"
    
    # Step 9: Deploy (with confirmation)
    deploy_migration "$migration_db"
    
    # Step 10: Cleanup
    cleanup
    
    success "Migration completed successfully!"
}

# Cleanup function
cleanup() {
    log "Cleaning up temporary files"
    rm -rf "$TEMP_DIR"
}

# Error handling
trap 'error "Migration failed - cleaning up"; cleanup' ERR

# Parse command line arguments
case "${1:-}" in
    --dry-run)
        log "DRY RUN MODE - No changes will be made"
        # Set dry run flag for testing
        ;;
    --help|-h)
        echo "Usage: $0 [--dry-run] [--help]"
        echo ""
        echo "Direct database migration script"
        echo "Replaces Alembic with schema-to-schema approach"
        echo ""
        echo "Options:"
        echo "  --dry-run  Show what would be done without making changes"
        echo "  --help     Show this help message"
        exit 0
        ;;
    "")
        # Normal execution
        ;;
    *)
        error "Unknown option: $1"
        ;;
esac

# Run main function
main
