#!/bin/bash

SRC_DB="tunetrees_do.sqlite3"
DST_DB="tunetrees.sqlite3"
OUTPUT_SQL="migrate_from_prod_generated.sql"

echo "-- Generated migration SQL" > "$OUTPUT_SQL"
echo "ATTACH DATABASE '$SRC_DB' AS source_db;" >> "$OUTPUT_SQL"
echo "PRAGMA foreign_keys = OFF;" >> "$OUTPUT_SQL"

sqlite3 "$SRC_DB" <<EOF | grep -v '^sqlite_' | while read -r table; do
.headers off
.mode list
SELECT name FROM sqlite_master WHERE type='table';
EOF
do
  echo "INSERT OR REPLACE INTO main.$table SELECT * FROM source_db.$table;" >> "$OUTPUT_SQL"
done

echo "DETACH DATABASE source_db;" >> "$OUTPUT_SQL"
echo "-- Done." >> "$OUTPUT_SQL"
