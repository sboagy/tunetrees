# TuneTrees Database Migration Guide

**Last Updated:** October 15, 2025  
**Consolidated from:** MIGRATION_SCRIPTS_README.md, PRODUCTION_MIGRATION_README.md, SCHEMA_AUDIT_REPORT.md, schema-migration-strategy.md, supabase-migration-setup.md, uuid-migration-strategy.md

---

## Overview

This guide covers migrating data from the legacy SQLite database to the new Supabase PostgreSQL + SQLite WASM architecture.

### Migration Goals

1. Migrate production data to Supabase PostgreSQL
2. Set up local SQLite WASM with migrated data
3. Preserve all user data (tunes, repertoires, practice records)
4. Maintain data integrity and relationships

---

## Migration Architecture

```
Legacy SQLite (tunetrees_production.sqlite3)
        ↓
   Migration Script
        ↓
Supabase PostgreSQL ← Sync → SQLite WASM (Browser)
```

---

## Prerequisites

- Supabase project created and configured
- Legacy database backup (`tunetrees_production.sqlite3`)
- Drizzle schema up to date
- Migration script (`scripts/migrate-production-to-supabase.ts`)

---

## Migration Steps

### 1. Backup Production Database

```bash
# Create backup
cp tunetrees_production.sqlite3 tunetrees_production_backup_$(date +%Y%m%d).sqlite3

# Verify backup
sqlite3 tunetrees_production_backup_*.sqlite3 "SELECT COUNT(*) FROM tune;"
```

### 2. Prepare Supabase Schema

```bash
# Generate Drizzle migrations
npm run db:generate

# Review generated SQL
cat drizzle/migrations/*.sql

# Apply to Supabase (via Drizzle)
npm run db:push
```

### 3. Run Migration Script

```bash
# Dry run (validation only)
npm run migrate:production -- --dry-run

# Full migration
npm run migrate:production

# Verify migration
npm run migrate:verify
```

### 4. Verify Data Integrity

Check key metrics:

```sql
-- Tunes count
SELECT COUNT(*) FROM tune WHERE deleted = 0;

-- Practice records count
SELECT COUNT(*) FROM practice_record;

-- Repertoires count
SELECT COUNT(*) FROM repertoire WHERE deleted = 0;

-- Users count
SELECT COUNT(*) FROM user_profile;
```

Compare with legacy database counts.

---

## Schema Differences

### Legacy → New Schema Changes

**ID Fields:**
- Legacy: Auto-increment integers
- New: Keep integers for compatibility (UUIDs considered but deferred)

**Sync Metadata:**
- Added: `sync_version`, `last_modified_at`, `synced_at`
- Purpose: Multi-device synchronization

**Soft Deletes:**
- Added: `deleted` boolean (0/1)
- Replaces: Hard deletes

**FSRS Fields:**
- Added: `stability`, `difficulty`, `state`, etc.
- Purpose: Enhanced scheduling algorithm

---

## Migration Script Details

### Script: `scripts/migrate-production-to-supabase.ts`

**What it does:**
1. Reads legacy SQLite database
2. Transforms data to new schema format
3. Inserts into Supabase PostgreSQL
4. Handles foreign key relationships
5. Validates data integrity

**Key transformations:**
- Maps legacy user IDs to new IDs
- Converts date formats (SQLite → PostgreSQL)
- Initializes FSRS fields with defaults
- Sets sync metadata timestamps

**Error handling:**
- Transaction-based (rollback on error)
- Detailed logging
- Validation checks at each step

---

## Rollback Procedure

If migration fails:

```bash
# 1. Drop Supabase tables
npm run db:reset

# 2. Re-apply schema
npm run db:push

# 3. Fix migration script issue

# 4. Re-run migration
npm run migrate:production
```

---

## Testing Migration

### Test with Clean Database

```bash
# Use test database
export DATABASE_URL="path/to/tunetrees_test_clean.sqlite3"

# Run migration
npm run migrate:production -- --test

# Verify
npm run migrate:verify
```

### Validation Checks

- [ ] All tunes migrated (count matches)
- [ ] All practice records migrated
- [ ] All repertoires migrated
- [ ] Foreign key relationships intact
- [ ] No orphaned records
- [ ] Dates formatted correctly
- [ ] User accounts linked properly

---

## Post-Migration

### 1. Seed Local SQLite WASM

After Supabase migration:

```bash
# Sync down from Supabase to local SQLite
npm run sync:down
```

### 2. Update User Accounts

- Notify users of migration
- Provide login instructions
- Support password resets if needed

### 3. Monitor Sync

- Check Supabase dashboard for activity
- Monitor sync queue processing
- Watch for conflict resolution

---

## TODO: Content to Add

- [ ] Extract migration script details from MIGRATION_SCRIPTS_README.md
- [ ] Extract production migration steps from PRODUCTION_MIGRATION_README.md
- [ ] Add schema audit findings from SCHEMA_AUDIT_REPORT.md
- [ ] Document UUID migration strategy (if/when implemented)
- [ ] Add troubleshooting guide for common migration issues
- [ ] Document data validation procedures

---

**See Also:**
- [Setup Guide](SETUP.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Phase 8: Remote Sync Plan](_notes/phase-8-remote-sync-plan.md)
