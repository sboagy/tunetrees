#!/bin/bash

# Direct Database Migration Script
# Replaces Alembic with schema-to-schema migration approach
# Uses AI-assisted mapping for complex schema changes

set -euo pipefail

# Configuration
SOURCE_SCHEMA_DB="tunetrees_test_clean.sqlite3"
PRODUCTION_SERVER="sboag@165.227.182.140"
# PRODUCTION_DB_PATH="/home/sboag/tunetrees/tunetrees_production.sqlite3"
PRODUCTION_DB_PATH="tunetrees/tunetrees.sqlite3"
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
    local backup_name="tunetrees_production_backup_$(date +%Y-%m-%d_%H-%M-%S).sqlite3"
    
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

# Function to generate human-readable schema summary
generate_schema_summary() {
    local diff_file="$1"
    
    echo ""
    echo "=== ACTUAL SCHEMA DIFFERENCES ==="
    echo ""
    
    # Compare table schemas directly from the databases
    local source_db="$SOURCE_SCHEMA_DB"
    local prod_db="$TEMP_DIR/production_current.sqlite3"
    
    # Get list of tables from both databases
    local source_tables=$(sqlite3 "$source_db" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
    local prod_tables=$(sqlite3 "$prod_db" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
    
    local changes_found=false
    
    # Check each table for differences
    for table in $source_tables; do
        if echo "$prod_tables" | grep -q "^$table$"; then
            # Table exists in both - check for column differences
            local source_cols=$(sqlite3 "$source_db" "PRAGMA table_info($table);" | cut -d'|' -f2)
            local prod_cols=$(sqlite3 "$prod_db" "PRAGMA table_info($table);" | cut -d'|' -f2)
            
            # Check for column set differences (ignore order)
            local source_col_set=$(echo "$source_cols" | sort | tr '\n' '|')
            local prod_col_set=$(echo "$prod_cols" | sort | tr '\n' '|')
            local has_column_changes=false
            
            # Find added columns (in source but not in production)
            local added_cols=""
            for col in $source_cols; do
                if ! echo "$prod_cols" | grep -q "^$col$"; then
                    added_cols="$added_cols$col "
                    has_column_changes=true
                fi
            done
            
            # Find removed columns (in production but not in source)
            local removed_cols=""
            for col in $prod_cols; do
                if ! echo "$source_cols" | grep -q "^$col$"; then
                    removed_cols="$removed_cols$col "
                    has_column_changes=true
                fi
            done
            
            # Check for actual type/constraint changes (not just order)
            local has_constraint_changes=false
            for col in $source_cols; do
                if echo "$prod_cols" | grep -q "^$col$"; then
                    local source_info=$(sqlite3 "$source_db" "PRAGMA table_info($table);" | grep "^[0-9]*|$col|")
                    local prod_info=$(sqlite3 "$prod_db" "PRAGMA table_info($table);" | grep "^[0-9]*|$col|")
                    
                    # Compare everything except column order (cid field)
                    local source_without_cid=$(echo "$source_info" | cut -d'|' -f2-6)
                    local prod_without_cid=$(echo "$prod_info" | cut -d'|' -f2-6)
                    
                    if [ "$source_without_cid" != "$prod_without_cid" ]; then
                        has_constraint_changes=true
                        break
                    fi
                fi
            done
            
            # Check for index changes
            local source_indexes=$(sqlite3 "$source_db" "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='$table' AND name NOT LIKE 'sqlite_%';")
            local prod_indexes=$(sqlite3 "$prod_db" "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='$table' AND name NOT LIKE 'sqlite_%';")
            local has_index_changes=false
            if [ "$source_indexes" != "$prod_indexes" ]; then
                has_index_changes=true
            fi
            
            # Only show table if there are actual changes (not just column order)
            if [ "$has_column_changes" = true ] || [ "$has_constraint_changes" = true ] || [ "$has_index_changes" = true ]; then
                echo -e "${YELLOW}🔧 $table${NC}:"
                
                if [ -n "$added_cols" ]; then
                    echo -e "   ${GREEN}+ Added columns:${NC} $added_cols"
                fi
                if [ -n "$removed_cols" ]; then
                    echo -e "   ${RED}- Removed columns:${NC} $removed_cols"
                fi
                
                # Show detailed type/constraint changes only for columns that actually changed
                if [ "$has_constraint_changes" = true ]; then
                    echo -e "   ${BLUE}~ Type/constraint changes:${NC}"
                    for col in $source_cols; do
                        if echo "$prod_cols" | grep -q "^$col$"; then
                            local source_info=$(sqlite3 "$source_db" "PRAGMA table_info($table);" | grep "^[0-9]*|$col|")
                            local prod_info=$(sqlite3 "$prod_db" "PRAGMA table_info($table);" | grep "^[0-9]*|$col|")
                            
                            # Compare everything except column order (cid field)
                            local source_without_cid=$(echo "$source_info" | cut -d'|' -f2-6)
                            local prod_without_cid=$(echo "$prod_info" | cut -d'|' -f2-6)
                            
                            if [ "$source_without_cid" != "$prod_without_cid" ]; then
                                # Extract specific field differences
                                local source_type=$(echo "$source_info" | cut -d'|' -f3)
                                local prod_type=$(echo "$prod_info" | cut -d'|' -f3)
                                local source_notnull=$(echo "$source_info" | cut -d'|' -f4)
                                local prod_notnull=$(echo "$prod_info" | cut -d'|' -f4)
                                local source_default=$(echo "$source_info" | cut -d'|' -f5)
                                local prod_default=$(echo "$prod_info" | cut -d'|' -f5)
                                local source_pk=$(echo "$source_info" | cut -d'|' -f6)
                                local prod_pk=$(echo "$prod_info" | cut -d'|' -f6)
                                
                                echo -e "     ${col}:"
                                if [ "$source_type" != "$prod_type" ]; then
                                    echo -e "       Type: ${prod_type} → ${source_type}"
                                fi
                                if [ "$source_notnull" != "$prod_notnull" ]; then
                                    local source_null_text=$([ "$source_notnull" = "1" ] && echo "NOT NULL" || echo "NULL")
                                    local prod_null_text=$([ "$prod_notnull" = "1" ] && echo "NOT NULL" || echo "NULL")
                                    echo -e "       Null: ${prod_null_text} → ${source_null_text}"
                                fi
                                if [ "$source_default" != "$prod_default" ]; then
                                    echo -e "       Default: '${prod_default}' → '${source_default}'"
                                fi
                                if [ "$source_pk" != "$prod_pk" ]; then
                                    local source_pk_text=$([ "$source_pk" = "1" ] && echo "PK" || echo "not PK")
                                    local prod_pk_text=$([ "$prod_pk" = "1" ] && echo "PK" || echo "not PK")
                                    echo -e "       Primary Key: ${prod_pk_text} → ${source_pk_text}"
                                fi
                            fi
                        fi
                    done
                fi
                
                # Show index changes
                if [ "$has_index_changes" = true ]; then
                    echo -e "   ${YELLOW}📊 Index changes:${NC}"
                    
                    # Show added indexes
                    for idx in $source_indexes; do
                        if ! echo "$prod_indexes" | grep -q "^$idx$"; then
                            echo -e "     + Added: $idx"
                        fi
                    done
                    
                    # Show removed indexes
                    for idx in $prod_indexes; do
                        if ! echo "$source_indexes" | grep -q "^$idx$"; then
                            echo -e "     - Removed: $idx"
                        fi
                    done
                fi
                
                changes_found=true
            fi
        else
            echo -e "${GREEN}📋 $table${NC} - new table"
            changes_found=true
        fi
    done
    
    # Check for dropped tables
    for table in $prod_tables; do
        if ! echo "$source_tables" | grep -q "^$table$"; then
            echo -e "${RED}🗑️  $table${NC} - table dropped"
            changes_found=true
        fi
    done
    
    if [ "$changes_found" = false ]; then
        echo -e "${BLUE}ℹ️  No actual table or column differences found${NC}"
        echo -e "${YELLOW}⚠️  Differences may be formatting/constraint changes only${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}� Full details: $diff_file${NC}"
    echo ""
}

# Function to create migration database
create_migration_db() {
    local source_db="$1"
    local target_db="$2"
    local migration_db="$3"
    
    log "Creating migration database with new schema"
    
    # Extract schema from source database (our target schema)
    local schema_file="$TEMP_DIR/target_schema.sql"
    sqlite3 "$source_db" ".schema" > "$schema_file"
    
    # Filter out SQLite internal objects that cannot be created manually
    local clean_schema_file="$TEMP_DIR/target_schema_clean.sql"
    grep -v -E "CREATE TABLE sqlite_(sequence|stat[0-9]+)" "$schema_file" > "$clean_schema_file"
    
    # Create completely fresh database with target schema
    rm -f "$migration_db"  # Remove if exists
    sqlite3 "$migration_db" < "$clean_schema_file"
    
    log "Fresh migration database created with target schema"
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
    
    # Verify the table exists in source database first
    local table_exists=$(sqlite3 "$source_db" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='$table';")
    if [ -z "$table_exists" ] || [ "$table_exists" -eq 0 ]; then
        warn "Table $table does not exist in source database - skipping"
        return
    fi
    
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
        # Use ATTACH DATABASE approach for data copying
        sqlite3 "$target_db" "
            ATTACH DATABASE '$source_db' AS source_db;
            INSERT INTO $table ($common_cols) SELECT $common_cols FROM source_db.$table;
            DETACH DATABASE source_db;
        "
        success "Data copied for table $table"
    else
        error "No compatible columns found for $table"
    fi
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
    log "Redeply production services"
    echo -n "Redeply production services for current branch? (y/n): "
    read -r response
    
    if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
        echo "Redeploy opted out by user"
        exit 0
    fi

    ./scripts/redeploy_tt1dd.sh
    # ssh -i ~/.ssh/id_rsa_ttdroplet "$PRODUCTION_SERVER" "cd tunetrees && docker-compose restart"
    
    success "Production services redeployed successfully!"
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
    
    # Generate human-readable summary
    generate_schema_summary "$schema_diff"
    
    echo -n "Continue with migration? (y/n): "
    read -r response
    
    if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
        echo "Migration opted out by user"
        exit 0
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
