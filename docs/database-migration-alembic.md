# Database Migration with Alembic

This document explains how to use the new Alembic-based database migration system that replaces the manual SQL migration process.

## Overview

The new migration system uses Alembic to automatically detect schema changes and generate migration scripts. This is much more robust than the previous manual SQL approach and handles schema evolution gracefully.

## Migration Workflow

### 1. Making Schema Changes

When you need to change the database schema or views:

1. **Update `tunetrees_test_clean.sqlite3`** with your schema changes
   - This includes table structure changes AND view changes
   - Views will be automatically detected and migrated
2. **Test your changes locally** to make sure they work
3. **Generate a migration** using the provided script

### 2. Generate Migration Script

After updating your schema, run:

```bash
./scripts/generate_migration.sh
```

This will:

- Copy `tunetrees_test_clean.sqlite3` to `tunetrees.sqlite3` (target schema)
- Auto-detect table AND view changes from your target schema
- Generate an Alembic migration file in `alembic/versions/`
- Include view updates automatically using dynamic view extraction
- Show you the next steps

### 3. Review and Test Migration

1. **Review the generated migration** in `alembic/versions/`
2. **Test locally** by running:
   ```bash
   ./scripts/test_migration.sh
   ```
3. **Edit the migration if needed** (add data migrations, etc.)

### 4. Apply to Production

When ready to migrate production:

```bash
./scripts/migrate_prod_with_alembic.sh
```

This script will:

- Download the production database from Digital Ocean
- Create timestamped backups (both remote and local)
- Handle known issues (like the `view_playlist_joined` problem)
- Apply Alembic migrations to the production data
- Verify the migration
- Optionally upload the migrated database back to production

## Key Files

- `alembic.ini` - Alembic configuration
- `alembic/env.py` - Migration environment setup
- `alembic/versions/` - Generated migration scripts
- `scripts/migrate_prod_with_alembic.sh` - Main production migration script
- `scripts/generate_migration.sh` - Helper to create new migrations
- `scripts/test_migration.sh` - Local migration testing

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

- **Remote backup**: `tunetrees_do_backup/backup_practice_[date].sqlite3`
- **Local backup**: `tunetrees_local_backup/tunetrees_[date].sqlite3`

### View Migration

✅ **Views are now fully automatic!**

When you change `tunetrees_test_clean.sqlite3`:

- View changes are automatically detected
- Views are extracted from your target schema (tunetrees.sqlite3)
- Migration system recreates views with the exact SQL from your target database
- No manual steps required - views stay perfectly in sync with your schema

The system handles:

- New views
- Modified view definitions
- Removed views
- Complex view dependencies

### Known Issues

The script automatically handles the `view_playlist_joined` issue that caused problems in the old manual migration process.

## Troubleshooting

### Migration Fails

1. Check the error message for specific issues
2. Verify your models are correct
3. Test the migration locally first
4. Check that excluded tables aren't causing conflicts

### Schema Mismatch

If there's a mismatch between your models and the database:

1. Generate a new migration with `./scripts/generate_migration.sh`
2. Review the generated migration carefully
3. Test locally before applying to production

### Recovery

If something goes wrong:

1. **Database backups** are automatically created in `tunetrees_do_backup/`
2. **Local backups** are in `tunetrees_local_backup/`
3. You can restore from these backups if needed

## Migration Commands Reference

```bash
# Generate new migration
./scripts/generate_migration.sh

# Test migration locally
./scripts/test_migration.sh

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

- `create_views()` - Creates all application views
- `drop_views()` - Drops all application views
- `recreate_views()` - Drops and recreates all views

### Current Views

- `view_playlist_joined` - Joins playlist and instrument data
- `practice_list_joined` - Complex view for practice data with user overrides
- `practice_list_staged` - Extended practice view with transient data

### Usage in Migrations

```python
from view_utils import create_views, drop_views

def upgrade() -> None:
    # ... table creation commands ...
    create_views()  # Add this after tables are created

def downgrade() -> None:
    drop_views()    # Add this before tables are dropped
    # ... table dropping commands ...
```

## Current Migration

**Initial Migration**: `20011a33cdb1_initial_migration_with_views.py`

- Creates all tables from SQLAlchemy models
- Uses view_utils to create database views
- Properly handles view dependencies on tables

## Complete Workflow Summary

Here's your complete workflow when making schema or view changes:

### Simple 3-Step Process

1. **Make Changes**: Update `tunetrees_test_clean.sqlite3` with any schema or view changes
2. **Generate Migration**: Run `./scripts/generate_migration.sh`
3. **Deploy**: Run `./scripts/migrate_prod_with_alembic.sh` when ready

### What Happens Automatically

✅ **Views are completely automatic** - no manual steps needed  
✅ **Schema changes detected** from your target database  
✅ **Production data preserved** during migration  
✅ **Backups created** automatically  
✅ **Verification performed** after migration

### Your Role vs System Role

**You do:**

- Update `tunetrees_test_clean.sqlite3` with your changes
- Run the migration scripts
- Review and approve before deploying to production

**System does:**

- Detects all table and view changes automatically
- Extracts view definitions from your target schema
- Generates proper migration code
- Handles all the complex migration logic
- Creates backups and verifies results

**Result:** Views and schema stay perfectly in sync with zero manual work!
