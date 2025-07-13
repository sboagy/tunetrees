#!/bin/bash

# Script to migrate production data to new schema
# This bypasses Alembic's schema comparison issues by:
# 1. Download production database (old schema + real data)
# 2. Create new database with target schema
# 3. Copy data from production to new database
# 4. Replace production database locally

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== TuneTrees Data Migration to New Schema ===${NC}"
echo "This script will:"
echo "  1. Download production database from Digital Ocean"
echo "  2. Create new database with target schema from tunetrees_test_clean.sqlite3"
echo "  3. Copy data from production to new database"
echo "  4. Replace production database locally for deployment"
echo ""

# Step 1: Download production database
echo -e "${YELLOW}Step 1: Downloading production database...${NC}"
DATE=$(date +%b_%d)
BACKUP_FILE="./tunetrees_do_backup/backup_practice_${DATE}.sqlite3"

# Create backup directory if it doesn't exist
mkdir -p tunetrees_do_backup

# Create backup on remote server and download it
ssh -i ~/.ssh/id_rsa_ttdroplet sboag@165.227.182.140 "cp tunetrees/tunetrees.sqlite3 tunetrees/backup_practice_${DATE}.sqlite3"
scp -i ~/.ssh/id_rsa_ttdroplet sboag@165.227.182.140:tunetrees/backup_practice_${DATE}.sqlite3 "${BACKUP_FILE}"
echo -e "${GREEN}✓ Backup saved to: ${BACKUP_FILE}${NC}"

# Download current production database
echo "Downloading current production database..."
rm -f tunetrees_production.sqlite3
scp -i ~/.ssh/id_rsa_ttdroplet sboag@165.227.182.140:tunetrees/tunetrees.sqlite3 tunetrees_production.sqlite3
echo -e "${GREEN}✓ Production database downloaded${NC}"

# Step 2: Create new database with target schema
echo -e "${YELLOW}Step 2: Creating new database with target schema...${NC}"
rm -f tunetrees_migrated.sqlite3
cp tunetrees_test_clean.sqlite3 tunetrees_migrated.sqlite3
echo -e "${GREEN}✓ New database created with target schema${NC}"

# Step 3: Copy data from production to new database
echo -e "${YELLOW}Step 3: Copying data from production to new database...${NC}"

# Create SQL script to copy data
cat > migrate_data.sql << 'EOF'
-- Attach production database
ATTACH DATABASE 'tunetrees_production.sqlite3' AS prod;

-- Copy data from production to new schema
-- Note: Only copying columns that exist in both schemas

INSERT INTO account (id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state, user_id)
SELECT id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state, user_id
FROM prod.account;

INSERT INTO genre (id, genre)
SELECT id, genre
FROM prod.genre;

INSERT INTO genre_tune_type (genre_id, tune_type_id)
SELECT genre_id, tune_type_id
FROM prod.genre_tune_type;

INSERT INTO instrument (id, instrument)
SELECT id, instrument
FROM prod.instrument;

INSERT INTO note (id, note_text, playlist_ref, tune_ref, public, user_id)
SELECT id, note_text, playlist_ref, tune_ref, public, user_id
FROM prod.note;

INSERT INTO playlist (playlist_id, playlist_name, instrument_id, created_date, user_id)
SELECT playlist_id, playlist_name, instrument_id, created_date, user_id
FROM prod.playlist;

INSERT INTO playlist_tune (playlist_ref, tune_ref, added_date, user_id)
SELECT playlist_ref, tune_ref, added_date, user_id
FROM prod.playlist_tune;

-- Copy practice_record data, handling new columns with defaults
INSERT INTO practice_record (
    playlist_ref, tune_ref, practiced, quality, id, easiness, interval, repetitions, 
    review_date, backup_practiced, stability, elapsed_days, lapses, state,
    difficulty, step
)
SELECT 
    playlist_ref, tune_ref, practiced, quality, id, easiness, interval, repetitions,
    review_date, backup_practiced, stability, elapsed_days, lapses, state,
    0.0 as difficulty,  -- Default value for new column
    0 as step          -- Default value for new column
FROM prod.practice_record;

INSERT INTO prefs_spaced_repetition (
    id, user_id, alg_type, request_retention, maximum_interval, weights,
    learning_steps, relearning_steps, enable_fuzzing
)
SELECT 
    id, user_id, alg_type, request_retention, maximum_interval, weights,
    '[]' as learning_steps,      -- Default empty JSON array
    '[]' as relearning_steps,    -- Default empty JSON array
    1 as enable_fuzzing          -- Default enabled
FROM prod.prefs_spaced_repetition;

INSERT INTO reference (id, reference_text, playlist_ref, tune_ref, url, public, favorite, user_id)
SELECT id, reference_text, playlist_ref, tune_ref, url, public, favorite, user_id
FROM prod.reference;

INSERT INTO session (id, session_token, user_id, expires)
SELECT id, session_token, user_id, expires
FROM prod.session;

INSERT INTO tab_group_main_state (id, user_id, which_tab)
SELECT id, user_id, which_tab
FROM prod.tab_group_main_state;

INSERT INTO table_state (id, user_id, screen_size, purpose, sort_by, sort_desc, filter_by)
SELECT id, user_id, screen_size, purpose, sort_by, sort_desc, filter_by
FROM prod.table_state;

INSERT INTO table_transient_data (user_id, tune_id, playlist_id, overdue_cnt, easiness_avg, interval_avg, repetitions_avg, quality_avg, view_cnt)
SELECT user_id, tune_id, playlist_id, overdue_cnt, easiness_avg, interval_avg, repetitions_avg, quality_avg, view_cnt
FROM prod.table_transient_data;

INSERT INTO tag (tag_id, tag_text)
SELECT tag_id, tag_text
FROM prod.tag;

INSERT INTO tune (id, name, type, structure, mode, incipit, genre, composer, arr, abc, learned, book, url, user_id, tags, date_created, date_modified, backup_abc, repeat_cnt, quality, played_cnt, played_date, learned_date)
SELECT id, name, type, structure, mode, incipit, genre, composer, arr, abc, learned, book, url, user_id, tags, date_created, date_modified, backup_abc, repeat_cnt, quality, played_cnt, played_date, learned_date
FROM prod.tune;

INSERT INTO tune_override (id, tune_id, user_id, abc, tags, playlist_id)
SELECT id, tune_id, user_id, abc, tags, playlist_id
FROM prod.tune_override;

INSERT INTO tune_type (id, tune_type)
SELECT id, tune_type
FROM prod.tune_type;

INSERT INTO user (id, name, email, email_verified, image)
SELECT id, name, email, email_verified, image
FROM prod.user;

INSERT INTO verification_token (identifier, token, expires)
SELECT identifier, token, expires
FROM prod.verification_token;

-- Detach production database
DETACH DATABASE prod;
EOF

# Execute the data migration
sqlite3 tunetrees_migrated.sqlite3 < migrate_data.sql

# Clean up
rm migrate_data.sql

echo -e "${GREEN}✓ Data copied from production to new schema${NC}"

# Step 4: Verify migration
echo -e "${YELLOW}Step 4: Verifying migration...${NC}"

# Check that data was copied
PRACTICE_COUNT=$(sqlite3 tunetrees_migrated.sqlite3 "SELECT COUNT(*) FROM practice_record;")
TUNE_COUNT=$(sqlite3 tunetrees_migrated.sqlite3 "SELECT COUNT(*) FROM tune;")
USER_COUNT=$(sqlite3 tunetrees_migrated.sqlite3 "SELECT COUNT(*) FROM user;")

echo "Data verification:"
echo "  - Practice records: ${PRACTICE_COUNT}"
echo "  - Tunes: ${TUNE_COUNT}"
echo "  - Users: ${USER_COUNT}"

# Check that new columns exist
NEW_COLUMNS=$(sqlite3 tunetrees_migrated.sqlite3 "PRAGMA table_info(practice_record);" | grep -E "(difficulty|step)" | wc -l)
if [ "$NEW_COLUMNS" -eq 2 ]; then
    echo -e "${GREEN}✓ New schema columns verified${NC}"
else
    echo -e "${RED}✗ New schema columns missing${NC}"
    exit 1
fi

# Step 5: Replace production database
echo -e "${YELLOW}Step 5: Replacing production database...${NC}"
cp tunetrees_migrated.sqlite3 tunetrees_production.sqlite3
echo -e "${GREEN}✓ Production database replaced with migrated version${NC}"

echo ""
echo -e "${GREEN}=== Migration Complete! ===${NC}"
echo "Next steps:"
echo "  • Review the migrated database: sqlite3 tunetrees_production.sqlite3"
echo "  • Test your application with the new schema"
echo "  • When ready, deploy to Digital Ocean:"
echo "    scp -i ~/.ssh/id_rsa_ttdroplet tunetrees_production.sqlite3 sboag@165.227.182.140:tunetrees/tunetrees.sqlite3"
echo ""
echo "Backup files:"
echo "  • Production backup: ${BACKUP_FILE}"
echo "  • Original production: backed up on remote server"
