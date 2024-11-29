#!/bin/bash

# Get the current date in the format "Month_Day" (e.g., "Oct_07")
backup_file="./tunetrees_do_backup/backup_practice_$(date +%b_%d).sqlite3"

# Copy the remote database to a local backup file
scp -i ~/.ssh/id_rsa_ttdroplet -r sboag@165.227.182.140:tunetrees/tunetrees.sqlite3 "$backup_file"

scp -i ~/.ssh/id_rsa_ttdroplet -r sboag@165.227.182.140:tunetrees/tunetrees.sqlite3 "tunetrees_do.sqlite3"

cp tunetrees.sqlite3 tunetrees_local_backup/tunetrees_$(date +%b_%d).sqlite3

# Execute the SQL script, setting the :source_db parameter
sqlite3 tunetrees.sqlite3 <<EOF
.param set :source_db "$backup_file"
.read /Users/sboag/gittt/tunetrees/migrate_from_prod.sql
EOF

# scp -i ~/.ssh/id_rsa_ttdroplet -r "tunetrees.sqlite3" sboag@165.227.182.140:tunetrees/tunetrees.sqlite3 
