# Direct Database Migration Guide

## Overview

This document describes the new direct database migration system that replaces Alembic. The approach is designed for database-first development where schema changes are made directly in the database and then migrated to production.

## Philosophy

- **Database-first**: Schema changes are made in `tunetrees_test_clean.sqlite3` first
- **AI-assisted mapping**: Complex schema changes are handled with intelligent column mapping
- **Manual confirmation**: All potentially destructive operations require explicit user approval
- **Safety-first**: Multiple backups and validation steps ensure data integrity

## Migration Script: `scripts/migrate_database_direct.sh`

### Features

1. **Automatic Schema Comparison**: Compares source schema with production schema
2. **Intelligent Data Mapping**: Handles column renames, type changes, and structural modifications
3. **Interactive Confirmation**: Prompts for approval before any destructive operations
4. **Comprehensive Validation**: Verifies data integrity after migration
5. **Automatic Backups**: Creates timestamped backups before any changes

### Usage

```bash
# Normal migration
./scripts/migrate_database_direct.sh

# Dry run to see what would happen
./scripts/migrate_database_direct.sh --dry-run

# Show help
./scripts/migrate_database_direct.sh --help
```

### Migration Workflow

1. **Backup Production**: Creates timestamped backup in `tunetrees_do_backup/`
2. **Download Current Production**: Downloads current production database
3. **Schema Extraction**: Extracts schemas from both databases using `.schema`
4. **Schema Comparison**: Uses `diff` to identify differences
5. **Interactive Review**: Shows differences and asks for confirmation
6. **Migration Database Creation**: Creates new database with target schema
7. **Data Mapping**: Copies data with intelligent column mapping
8. **Validation**: Verifies record counts match between source and target
9. **Deployment Confirmation**: Final confirmation before production deployment
10. **Production Deployment**: Uploads migrated database and restarts services

### Column Mapping Intelligence

The script handles several types of schema changes:

- **Identical Schemas**: Direct data copy
- **Column Additions**: Copies existing columns, leaves new columns with defaults
- **Column Removals**: Copies only columns that exist in target schema
- **Column Renames**: Prompts for manual mapping confirmation
- **Type Changes**: Attempts automatic conversion with validation

### Safety Features

- **Multiple Confirmations**: User must approve schema differences and deployment
- **Automatic Backups**: Production database backed up before any changes
- **Rollback Capability**: Original database preserved for emergency rollback
- **Validation Checks**: Record counts verified after migration
- **Dry Run Mode**: Test migration without making changes

## Development Workflow

### Making Schema Changes

1. Modify schema in `tunetrees_test_clean.sqlite3` using your preferred SQLite tool
2. Test the changes thoroughly with your application
3. Commit the updated database file to version control
4. Run migration script to deploy to production

### Example Schema Change Process

```bash
# 1. Make changes to schema database
sqlite3 tunetrees_test_clean.sqlite3
# ... make your schema changes ...

# 2. Test changes locally
uvicorn tunetrees.api.main:app --reload

# 3. Run tests to ensure compatibility
pytest tests/

# 4. Deploy to production
./scripts/migrate_database_direct.sh
```

### Handling Complex Migrations

For complex schema changes that require data transformation:

1. Create transformation SQL scripts in `sql_scripts/`
2. Test transformations on a copy of production data
3. Modify the migration script to include custom transformation logic
4. Document the transformation in migration notes

## Troubleshooting

### Common Issues

**Schema Comparison Fails**

- Ensure `tunetrees_test_clean.sqlite3` has the correct target schema
- Check that SQLite `.schema` output is clean (no comments or extra whitespace)

**Column Mapping Issues**

- Review column names and types carefully
- Use SQLite tools to inspect schema differences
- Consider using custom mapping logic for complex transformations

**Deployment Failures**

- Verify SSH key access to production server
- Check disk space on production server
- Ensure production services can be restarted

### Recovery Procedures

**Rollback Production Database**

```bash
# Find the backup file
ls -la tunetrees_do_backup/

# Copy backup to production
scp -i ~/.ssh/id_rsa_ttdroplet tunetrees_production_backup_YYYYMMDD_HHMMSS.sqlite3 sboag@165.227.182.140:/home/sboag/tunetrees/tunetrees_production.sqlite3

# Restart services
ssh -i ~/.ssh/id_rsa_ttdroplet sboag@165.227.182.140 "cd tunetrees && docker-compose restart"
```

## Migration History

The migration script automatically logs all operations and maintains:

- Timestamped backups in `tunetrees_do_backup/`
- Schema difference files in `migration_temp/` (during execution)
- Console logs with detailed operation information

## Comparison with Alembic

| Feature              | Alembic          | Direct Migration       |
| -------------------- | ---------------- | ---------------------- |
| Development Style    | Code-first       | Database-first         |
| Schema Definition    | Python models    | Direct SQL             |
| Version Control      | Migration files  | Database files         |
| Rollback             | Automatic        | Manual with backups    |
| Complexity           | High             | Low                    |
| Data Transformations | Python code      | SQL + manual mapping   |
| Production Safety    | Version tracking | Multiple confirmations |

## Best Practices

1. **Always test migrations** on a copy of production data first
2. **Review schema differences** carefully before approving migration
3. **Monitor production** closely after deployment
4. **Keep backups** for at least 30 days
5. **Document complex transformations** in migration notes
6. **Use dry-run mode** for testing migration logic

## Future Enhancements

Potential improvements to consider:

- **Automated rollback detection**: Detect migration failures and auto-rollback
- **Schema versioning**: Track schema versions in database metadata
- **Migration testing**: Automated testing of migration scripts
- **Parallel migrations**: Support for multi-server deployments
- **Integration with CI/CD**: Automated migration in deployment pipeline

This approach provides a simpler, more reliable alternative to Alembic while maintaining safety and flexibility for database-first development workflows.
