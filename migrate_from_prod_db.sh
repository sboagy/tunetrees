#!/bin/bash

# Get the current date in the format "Month_Day" (e.g., "Oct_07")
backup_file="backup_practice_$(date +%b_%d).sqlite"

# Copy the remote database to a local backup file
scp -i ~/.ssh/id_rsa_ttdroplet -r sboag@165.227.182.140:tunetrees/tunetrees.sqlite3 "$backup_file"

cp tunetrees.sqlite3 tunetrees_$(date +%b_%d).sqlite3.bak

# Execute the SQL script, setting the :source_db parameter
sqlite3 tunetrees.sqlite3 <<EOF
.param set :source_db "$backup_file"
.read /Users/sboag/gittt/tunetrees/migrate_from_prod.sql
EOF
