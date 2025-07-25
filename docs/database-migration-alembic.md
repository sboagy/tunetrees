# Database Migration with Alembic

**Documentation Note**: This guide uses template variables for migration IDs:

- `{baseline_id}` = The baseline migration ID (currently "baseline")
- `{migration_id}` = A specific migration ID (12-character hash like "fa13683caff1")
- `{date}` = Timestamp format like "2025-07-13_08-28-03"

Replace these with actual values when running commands.

This document explains how to use the new Alembic-based database migration system that replaces the manual SQL migration process.

## Database-First Migration Workflow with Alembic

This system implements a **database-first approach** with Alembic, where schema changes are made directly in the database, then SQLAlchemy models are generated to match, and finally Alembic autogenerates the migration by comparing the current production state with your desired target state.

### How Database-First Works with Alembic

**The Workflow:**

1. **Make schema changes** directly in `tunetrees_test_clean.sqlite3` using database tools
2. **Generate SQLAlchemy models** from this modified schema using `sqlacodegen_v2`
3. **Run Alembic autogenerate** - it compares your new models against the current production baseline
4. **Alembic generates migration** with the exact steps needed to transform production → target schema
5. **Apply migration** to production database with all data preserved

**Key Insight**: Alembic tracks what it thinks the "current state" is (production baseline) and compares that against what your models define (target state), then generates the transformation steps automatically.

### Why This Works Better

- **Schema-First Development**: Make changes in database tools (DataGrip, etc.) where you can see the results immediately
- **Automatic Code Generation**: SQLAlchemy models stay perfectly in sync with database schema
- **Alembic Handles Complexity**: All the migration logic (column adds, type changes, constraint modifications) is auto-generated
- **Data Preservation**: Production data is preserved through all schema transformations
- **Professional Workflow**: Same pattern used by teams that start with database design then generate code

## Overview

The new migration system uses Alembic to automatically detect schema changes and generate migration scripts. This is much more robust than the previous manual SQL approach and handles schema evolution gracefully.

### How It Works Behind the Scenes

**The Core Problem**: Your production database in Digital Ocean has one schema, but you want to migrate it to a new schema defined in `tunetrees_test_clean.sqlite3`. Alembic needs to understand both schemas to generate the transformation.

**The Solution**: Alembic uses a "baseline migration" that represents what's currently in production, then generates migrations that transform from that baseline to your target schema.

**Key Components**:

1. **Baseline Migration** (`{baseline_id}`): Represents the current production schema
2. **Target Schema** (`tunetrees_test_clean.sqlite3`): Your desired new schema
3. **Migration Files**: Auto-generated transformations from baseline to target
4. **Production Database**: Real data in Digital Ocean that gets transformed

**The Process**:

1. **Establish Baseline**: Download actual production database and create baseline migration that matches it exactly
2. **Generate Migration**: Compare baseline vs target schema and auto-generate transformation steps
3. **Apply Migration**: Download production data, apply transformations, get new schema with preserved data

## What is Alembic?

Alembic is a database migration tool for SQLAlchemy that provides automated database schema versioning and evolution. Think of it as "Git for your database schema" - it tracks changes to your database structure over time and provides a controlled way to apply those changes to different environments.

**How Alembic Works Fundamentally:**

1. **Schema Reflection**: Alembic can examine your SQLAlchemy models and automatically detect differences between what your code defines and what actually exists in a database
2. **Migration Generation**: It creates Python scripts containing the exact SQLAlchemy operations needed to transform one schema into another (add columns, create tables, modify constraints, etc.)
3. **Version Tracking**: Each migration has a unique ID and knows which migrations came before it, creating a linear history of schema changes
4. **Controlled Application**: Migrations are applied in order, and Alembic tracks which ones have been applied to prevent duplicate execution
5. **Rollback Capability**: Each migration can define both upgrade and downgrade operations, allowing you to undo changes if needed

The key insight is that instead of manually writing SQL to change your database, you define your desired schema in a target database file (`tunetrees_test_clean.sqlite3`), and Alembic figures out the transformation steps automatically by comparing this target with your production baseline. SQLAlchemy models are automatically generated from this database to keep code and schema in sync. This eliminates human error and ensures consistent schema changes across development, testing, and production environments.

## Database Files in the Migration System

The TuneTrees project uses several SQLite database files that serve different purposes in the migration and development workflow. Understanding these files is crucial for working with the migration system effectively.

### Checked-in Database Files (Git Tracked)

**`tunetrees_test_clean.sqlite3`** - **Schema Source of Truth**

- Contains the **target schema** that represents your desired database structure
- Used as the source for auto-generating SQLAlchemy models via `sqlacodegen_v2`
- Alembic compares this schema against production to generate migrations
- Contains clean test data with known state for reproducible testing
- **Always tracked in git** - this is the authoritative definition of your schema
- **Schema changes are made directly in this file** using database tools

**`true_production_baseline.sqlite3`** - **Production Data Snapshot**

- Snapshot of actual production database at a specific point in time
- Contains real user data and represents the deployed production state at baseline
- Used by migration scripts to establish the baseline migration that matches production
- Used for testing migrations against real data to ensure data preservation
- **Tracked in git** - provides reproducible production reference for migration testing
- **Never modified directly** - replaced when new production snapshots are needed

### Working Database Files (Git Ignored)

The following database files are generated during development and migration operations. They are all ignored by git since they are transient working files:

**`tunetrees_production.sqlite3`** - **Downloaded Production Database**

- Downloaded from Digital Ocean during migration operations
- Contains live production data that will be migrated
- Temporarily modified during migration testing and application
- **The primary target for production migrations**

**`tunetrees.sqlite3`** - **Main Development Database**

- Default database used by the backend application during development
- Referenced in `tunetrees/app/database.py` as the default location
- Working copy that can be freely modified during development
- Often copied from `tunetrees_test_clean.sqlite3` for local development

**`tunetrees_test.sqlite3`** - **Test Runtime Database**

- Copied from `tunetrees_test_clean.sqlite3` for each test run
- Used by test suites to avoid modifying the clean test database
- Automatically cleaned and recreated for each test session

**Other Temporary Files:**

- `*_temp_*.sqlite3` - Temporary files created during migration processes
- `test_migration.sqlite3` - Used by migration testing scripts
- `production_baseline.sqlite3` - Generated baseline schema reference files

### Database File Workflow in Migrations

**Schema Development:**

1. Make schema changes directly in `tunetrees_test_clean.sqlite3` using database tools
2. Auto-generate SQLAlchemy models: `sqlacodegen_v2 sqlite:///tunetrees_test_clean.sqlite3 > tunetrees/models/tunetrees.py`
3. Test changes locally using `tunetrees.sqlite3` (copied from clean version)

**Migration Generation:**

1. Scripts download production database to `tunetrees_production.sqlite3`
2. Alembic compares `tunetrees_test_clean.sqlite3` (target) vs production baseline (current state)
3. Migration scripts are auto-generated with transformation steps

**Migration Testing:**

1. Use `true_production_baseline.sqlite3` to simulate realistic data scenarios
2. Apply migrations to temporary copies to verify data preservation
3. Test rollback capabilities if implemented

**Production Deployment:**

1. Download live production database to `tunetrees_production.sqlite3`
2. Apply migrations directly to this file (preserving real data)
3. Upload migrated database back to Digital Ocean

### Alembic Configuration and Database URLs

The `alembic.ini` file contains a `sqlalchemy.url` setting, but **this is largely a fallback value**. Most migration operations override this URL programmatically:

- **Migration scripts use `-x db_url="<path>"` command line arguments** to specify exact database files
- **Different operations use different databases** depending on the migration phase
- **The alembic.ini URL is only used when no override is specified**

Examples of URL overrides in migration scripts:

```bash
# Test migration on specific database
alembic -x db_url="sqlite:///$(pwd)/test_migration.sqlite3" upgrade head

# Scripts also temporarily modify alembic.ini during operations
sed -i 's|sqlalchemy.url = .*|sqlalchemy.url = sqlite:///./tunetrees_production.sqlite3|' alembic.ini
```

This design allows the same Alembic configuration to work with multiple database files depending on the specific migration operation being performed.

## Migration Workflow

### 0. One-Time Setup: Establish Correct Baseline

**⚠️ IMPORTANT**: Before generating any migrations, you must establish the correct baseline from your actual production database.

```bash
./scripts/establish_baseline.sh
```

**What this does behind the scenes**:

1. **Downloads actual production database** from Digital Ocean via `scp`
2. **Analyzes the real production schema** - what tables and columns actually exist
3. **Generates a new baseline migration** that exactly matches production (replaces any incorrect baseline)
4. **Stamps the production database** with this baseline so Alembic knows the starting point
5. **Configures the system** for normal development workflow

**Why this is critical**: If the baseline migration doesn't match what's actually in production, Alembic will try to alter columns that don't exist, leading to `KeyError` failures during migration.

### 1. Making Schema Changes

When you need to change the database schema or views:

**Recommended Workflow:**

1. **Update your target schema** directly in `tunetrees_test_clean.sqlite3`
   - Use a database editor like DataGrip, DBCode, DBeaver, or SQLite Browser to modify the schema
   - Make table structure changes AND view changes directly in the database
2. **Regenerate SQLAlchemy models** (recommended):
   ```bash
   sqlacodegen_v2 sqlite:///tunetrees_test_clean.sqlite3 > tunetrees/models/tunetrees.py
   ```
   - This keeps your Python code synchronized with the database schema
   - SQLAlchemy models should never be modified by hand

**Why this workflow works:**

- The migration system compares against `tunetrees_test_clean.sqlite3` (not the Python models)
- SQLAlchemy models are auto-generated from the database, keeping them in sync
- Table schema and view definitions will be automatically detected and migrated

**After making changes:** 3. **Test your changes locally** to make sure they work 4. **Generate a migration** using the provided script

### 2. Generate Migration Script

After updating your schema, run:

```bash
./scripts/generate_migration.sh
```

**What this does behind the scenes**:

1. **Configures Alembic** to compare baseline (production) vs target (`tunetrees_test_clean.sqlite3`)
2. **Auto-detects differences**: New columns, changed types, new tables, etc.
3. **Generates transformation code**: SQLAlchemy operations to transform schema
4. **Adds view management**: Automatically includes view recreation utilities
5. **Creates batch operations**: SQLite-compatible column alterations

This will:

- Compare your target schema in `tunetrees_test_clean.sqlite3` against the current baseline schema
- Auto-detect table AND view changes from your target database
- Generate an Alembic migration file in `alembic/versions/`
- Include view updates automatically using dynamic view extraction
- Show you the next steps

### 3. Review and Test Migration

1. **Review the generated migration** in `alembic/versions/`
2. **Test locally** by running:
   ```bash
   ./scripts/test_migration.sh
   ```

**What the test does behind the scenes**:

1. **Creates empty test database**
2. **Applies baseline migration** to create production-like schema
3. **Applies your new migration** to transform to target schema
4. **Verifies transformation** worked correctly
5. **Reports success/failure** with details

6. **Edit the migration if needed** (add data migrations, etc.)

### 4. Apply to Production

When ready to migrate production:

```bash
./scripts/migrate_prod_with_alembic.sh
```

**What this does behind the scenes**:

1. **Downloads production database** from Digital Ocean (real data, old schema)
2. **Creates timestamped backups** both locally and on the remote server
3. **Configures Alembic** to use the production database
4. **Checks migration state** - stamps database with baseline if needed
5. **Applies pending migrations** that transform old schema → new schema
6. **Preserves all data** during schema transformation
7. **Recreates views** with new schema
8. **Verifies migration success**
9. **Provides instructions** for uploading back to Digital Ocean

This script will:

- Download the production database from Digital Ocean
- Create timestamped backups (both remote and local)
- Handle known issues (like the `view_playlist_joined` problem)
- Apply Alembic migrations to the production data
- Verify the migration
- Optionally upload the migrated database back to production

## Migration Reset Workflow

If you need to start over with a clean migration (common during development):

### Quick Reset Process

**Automated Reset (Recommended):**

```bash
# One command does everything automatically
./scripts/reset_migration.sh
```

This script automatically:

- ✅ Finds the latest migration ID
- ✅ Removes the pending migration file
- ✅ Verifies you're back to baseline
- ✅ Generates a fresh migration
- ✅ Tests the new migration

**Manual Reset (if needed):**

**Finding the Latest Migration ID:**

```bash
# Show the current head migration
alembic heads
# Output: {migration_id} (head)
#         ^^^^^^^^^^^^^ This is your migration ID
```

**Reset Commands:**

```bash
# 1. Find the latest migration ID
alembic heads  # Shows current head migration ID (e.g., {migration_id})

# 2. Remove the pending migration (replace with actual ID from step 1)
rm alembic/versions/{migration_id}_*.py

# 3. Verify you're back to baseline
alembic heads  # Should show only the initial migration

# 4. Generate fresh migration
./scripts/generate_migration.sh

# 5. Test the new migration
./scripts/test_migration.sh
```

**Note:** You don't need to manually remove `tunetrees_production.sqlite3` - the migration script automatically removes any existing copy before downloading fresh data from production.

### When to Reset

- **Development phase**: When refining schema changes before deployment
- **Error fixes**: When encountering SQLite compatibility issues
- **Clean generation**: When you want the script to add view utilities automatically

⚠️ **IMPORTANT**: Only use reset **before** deploying to production. Once you've deployed a migration with `./scripts/migrate_prod_with_alembic.sh`, always use `./scripts/generate_migration.sh` for new changes instead of resetting.

### What Gets Reset

- ✅ **Migration files**: Removed and regenerated
- ✅ **View utilities**: Automatically added by generation script
- ✅ **Batch operations**: Proper SQLite-compatible operations generated
- ❌ **Your target schema**: Your changes in `tunetrees_test_clean.sqlite3` remain intact
- ❌ **Database data**: No data loss during reset

This workflow is safe during development but should not be used once migrations are deployed to production.

## Development vs Production Workflow

### **During Development (Pre-Deployment)**

```bash
# Iterate freely - reset as much as needed
./scripts/reset_migration.sh    # ✅ Safe to repeat
# Make more changes...
./scripts/reset_migration.sh    # ✅ Still safe
```

### **After Production Deployment**

```bash
# Once you deploy to production:
./scripts/migrate_prod_with_alembic.sh   # 🚨 DEPLOYMENT BOUNDARY

# For future changes, use generate (NOT reset):
./scripts/generate_migration.sh          # ✅ Creates migration #2
./scripts/reset_migration.sh             # ❌ NEVER - breaks production!
```

**Key Rule**: Reset before deployment, generate after deployment.

## Key Files

- `alembic.ini` - Alembic configuration (database URL, etc.)
- `alembic/env.py` - Migration environment setup
- `alembic/versions/` - Generated migration scripts
- `tunetrees_test_clean.sqlite3` - **Target schema database** (source of truth for desired schema)
- `tunetrees/models/tunetrees.py` - **Auto-generated SQLAlchemy models** (generated from target database)
- `scripts/establish_baseline.sh` - **NEW**: One-time setup to create correct baseline
- `scripts/migrate_prod_with_alembic.sh` - Main production migration script
- `scripts/generate_migration.sh` - Helper to create new migrations
- `scripts/test_migration.sh` - Local migration testing
- `scripts/reset_migration.sh` - Automated migration reset (no manual steps)
- `scripts/check_deployment_status.sh` - Check what migrations have been deployed
- `migration_deployments.log` - **NEW**: Deployment tracking log (auto-created)

## Code Generation Workflow

The SQLAlchemy models are automatically generated from the target database:

```bash
# Regenerate models after updating tunetrees_test_clean.sqlite3
sqlacodegen_v2 sqlite:///tunetrees_test_clean.sqlite3 > tunetrees/models/tunetrees.py
```

**When to regenerate models:**

- ✅ After adding/modifying tables in `tunetrees_test_clean.sqlite3`
- ✅ When you want your Python code to have the latest table definitions
- ✅ **Recommended as standard practice** to keep code and database in sync
- ❌ Views don't need model regeneration (they're handled separately by the migration system)
- ❌ Not required for migration generation (migrations compare database schemas directly)

**Important**: SQLAlchemy models should never be modified by hand - always regenerate them from the database.

## Advantages over Manual SQL

1. **Automatic Detection**: Alembic automatically detects schema AND view changes
2. **Version Control**: All migrations are tracked and can be rolled back
3. **Data Preservation**: Production data is preserved during schema changes
4. **Error Handling**: Better error detection and recovery
5. **Consistency**: Same migration logic across environments
6. **Seamless Views**: Views are automatically updated from target schema
7. **No Manual Steps**: Complete automation from schema change to production

## Important Notes

### Backup Strategy

The migration script creates multiple backups:

- **Remote backup**: `tunetrees_do_backup/backup_practice_{date}.sqlite3`
- **Local backup**: `tunetrees_local_backup/tunetrees_{date}.sqlite3`

### Deployment Tracking & Idempotency

The system automatically tracks deployments to prevent accidental re-deployment:

- **Deployment log**: `migration_deployments.log` tracks what's been deployed when
- **Idempotency checking**: Script warns if you try to deploy the same migration twice
- **Status checking**: Use `./scripts/check_deployment_status.sh` to see deployment history
- **Safe re-running**: Test and migration scripts can be run repeatedly without risk

**Example deployment log entry:**

```
2025-07-13 08:28:03 {migration_id} username
```

Format: `date time migration_id username`

### View Migration

✅ **Views are now fully automatic!**

When you change `tunetrees_test_clean.sqlite3`:

- View changes are automatically detected and extracted from target database
- Views are dropped during migration (to avoid conflicts)
- Views are recreated automatically after schema changes using `view_utils`
- Migration system uses the exact SQL from your target database
- No manual steps required - views stay perfectly in sync with your schema

The system handles:

- New views
- Modified view definitions
- Removed views
- Complex view dependencies
- Automatic recreation after table schema changes

### Known Issues

The script automatically handles the `view_playlist_joined` issue that caused problems in the old manual migration process.

## ⚠️ CRITICAL WARNINGS

### Never Delete Baseline Migrations

**NEVER** delete migration files that have been applied to databases. This will break the migration system completely.

- The baseline migration `{baseline_id}_baseline_from_production.py` is referenced by existing databases
- Deleting it will cause `Can't locate revision identified by '{baseline_id}'` errors
- If you accidentally delete it, restore from git: `git restore alembic/versions/{baseline_id}_*.py`

### Safe Reset Guidelines

The reset script is safe ONLY when:

- ✅ You haven't deployed to production yet
- ✅ You're iterating on development changes
- ❌ NEVER after production deployment

### Recovery from Migration System Damage

If you break the migration system:

1. **Restore deleted migrations**: `git restore alembic/versions/`
2. **Check current state**: `alembic heads`
3. **If database references missing migration**: Use git to restore the missing file
4. **Clean up**: Remove any incorrectly created migrations

## Testing & Validation

### Safe Testing Commands

These commands can be run repeatedly without affecting production:

```bash
# Test migration on empty database (always safe)
./scripts/test_migration.sh

# Check what's been deployed (read-only)
./scripts/check_deployment_status.sh

# Prepare migration without uploading (safe, creates local files only)
./scripts/migrate_prod_with_alembic.sh  # Choose "n" when asked to upload
```

### What Each Test Validates

- **`test_migration.sh`**: Creates empty database, applies all migrations, verifies schema
- **`check_deployment_status.sh`**: Shows deployment history and current migration status
- **`migrate_prod_with_alembic.sh`**: Full end-to-end test with real production data (without upload)

### Migration Verification

The system automatically verifies:

- ✅ **Table counts** match expected schema
- ✅ **View counts** match expected schema
- ✅ **Column additions** are successful
- ✅ **Data preservation** during schema changes
- ✅ **View recreation** after table changes

### Migration Fails

1. Check the error message for specific issues
2. Verify your target schema in `tunetrees_test_clean.sqlite3` is correct
3. Test the migration locally first
4. Check that excluded tables aren't causing conflicts

### Schema Mismatch

If there's a mismatch between your target schema and the database:

1. Generate a new migration with `./scripts/generate_migration.sh`
2. Review the generated migration carefully
3. Test locally before applying to production

### "Target database is not up to date" Error

This error occurs when you have pending migrations that haven't been applied yet. To fix:

1. **If you haven't deployed the migration yet**: Delete the pending migration and regenerate:

   ```bash
   # Remove the most recent migration file
   rm alembic/versions/{migration_id}_*.py

   # Verify you're back to the base state
   alembic heads

   # Generate a fresh migration
   ./scripts/generate_migration.sh
   ```

2. **If you need to apply pending migrations**: Run the migration first:
   ```bash
   alembic upgrade head
   ```

### SQLite Column Type Change Errors

If you see "near 'ALTER': syntax error" when testing migrations:

- This indicates SQLite compatibility issues with column type changes
- The system is configured with `render_as_batch=True` to handle this automatically
- Regenerate the migration to get proper batch operations:
  ```bash
  rm alembic/versions/{migration_id}_*.py
  ./scripts/generate_migration.sh
  ```

### Column Not Found Errors

If you see `KeyError: 'column_name'` during migration:

This means the migration is trying to alter a column that doesn't exist in the database. This typically happens when:

1. **Baseline migration mismatch**: The initial migration doesn't match the actual production schema
2. **Wrong comparison source**: Migration was generated against wrong database

**To fix:**

```bash
# 1. Establish correct baseline from actual production
./scripts/establish_baseline.sh

# 2. Generate new migration with correct baseline
./scripts/generate_migration.sh

# 3. Test the migration
./scripts/test_migration.sh
```

**Root cause**: This issue occurs when the baseline migration was created from a different database than what's actually in production. The `establish_baseline.sh` script fixes this by downloading the real production database and creating a baseline that exactly matches it.

### Recovery

If something goes wrong:

1. **Database backups** are automatically created in `tunetrees_do_backup/`
2. **Local backups** are in `tunetrees_local_backup/`
3. You can restore from these backups if needed

## Migration Commands Reference

```bash
# ONE-TIME SETUP: Establish correct baseline from production
./scripts/establish_baseline.sh

# Generate new migration (after baseline is established)
./scripts/generate_migration.sh

# Test migration locally
./scripts/test_migration.sh

# Reset current migration (automated)
./scripts/reset_migration.sh

# Check deployment status
./scripts/check_deployment_status.sh

# Migrate production database
./scripts/migrate_prod_with_alembic.sh

# Check migration status
alembic current

# Show migration history
alembic history

# Manual migration (if needed)
alembic upgrade head
alembic -x db_url=sqlite:///path/to/db.sqlite3 upgrade head
```

## Comparison with Old System

| Aspect           | Old Manual System    | New Alembic System       |
| ---------------- | -------------------- | ------------------------ |
| Schema Detection | Manual SQL writing   | Automatic detection      |
| Error Handling   | Basic                | Robust with rollback     |
| Version Control  | Single SQL file      | Versioned migrations     |
| Data Migration   | Manual ATTACH/DETACH | Seamless preservation    |
| Testing          | Manual verification  | Automated testing script |
| Recovery         | Manual restore       | Automatic backups        |

The new system provides a much more professional and reliable database migration process that scales better as your application grows.

## View Management

Because database views contain complex SQL with NullType columns that can't be auto-generated by Alembic, we use a helper utility:

### `alembic/view_utils.py`

Contains helper functions for managing views in migrations:

- `create_views_from_target_db()` - Extracts and creates views from `tunetrees_test_clean.sqlite3`
- `get_view_definitions()` - Extracts view SQL from a database file
- `create_views_hardcoded()` - Fallback with hardcoded view definitions

### Current Views

- `view_playlist_joined` - Joins playlist and instrument data
- `practice_list_joined` - Complex view for practice data with user overrides
- `practice_list_staged` - Extended practice view with transient data

### Automatic Usage in Migrations

Views are automatically handled by adding this to the end of migration `upgrade()` functions:

```python
# Views are automatically added to generated migrations
from view_utils import create_views_from_target_db

def upgrade() -> None:
    # ... table schema changes ...

    # Recreate views after schema changes
    print("Recreating views after schema changes...")
    create_views_from_target_db()
```

**Note**: The migration generation system automatically includes view recreation, so you don't need to manually add this code.

## Current Migration

**Baseline Migration**: `{baseline_id}_baseline_from_production.py`

- Creates all tables from SQLAlchemy models that match actual production schema
- Uses view_utils to create database views after tables are created
- Properly handles view dependencies on tables
- **CRITICAL**: This baseline migration must never be deleted as it's referenced by existing databases

## Complete Workflow Summary

Here's your complete workflow when making schema or view changes:

### First Time Setup (One-Time Only)

```bash
./scripts/establish_baseline.sh
```

**What this does**: Downloads your actual production database from Digital Ocean and creates a baseline migration that exactly matches what's really in production.

### Normal Development Workflow

1. **Make Changes**: Update your target schema in `tunetrees_test_clean.sqlite3` (then regenerate models with `sqlacodegen_v2`)
2. **Generate Migration**: Run `./scripts/generate_migration.sh`
3. **Test Migration**: Run `./scripts/test_migration.sh`
4. **Deploy**: Run `./scripts/migrate_prod_with_alembic.sh` when ready

### What Happens Automatically Behind the Scenes

✅ **Schema Comparison**: Alembic compares production baseline vs your target schema in `tunetrees_test_clean.sqlite3`
✅ **Difference Detection**: Automatically finds new columns, changed types, new tables, etc.
✅ **Transformation Generation**: Creates SQLAlchemy operations to transform old schema → new schema
✅ **Data Preservation**: All production data is preserved during schema changes
✅ **View Management**: Views are automatically dropped and recreated with new schema
✅ **Backup Creation**: Multiple backups created before any changes
✅ **Verification**: Migration success is verified after completion

### Your Role vs System Role

**You do:**

- Update your target schema in `tunetrees_test_clean.sqlite3` with your changes using database tools
- Regenerate SQLAlchemy models with `sqlacodegen_v2` for code consistency
- Run the migration scripts
- Review and approve before deploying to production

**System does:**

- Downloads actual production database to establish baseline
- Compares production schema vs target schema
- Detects all table and view changes automatically
- Generates proper migration code with SQLite batch operations
- Handles all the complex migration logic
- Creates backups and verifies results
- Preserves data while transforming schema

**Result**: Production database gets transformed from old schema to new schema with zero data loss and fully automated schema detection!

```

```
