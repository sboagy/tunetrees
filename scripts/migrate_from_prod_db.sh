#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
if [ "$PWD" = "$SCRIPT_DIR" ]; then
    cd ..
fi

if [ ! -f "tunetrees.sqlite3" ]; then
    echo "current directory must be the root of the tunetrees repo"
    exit 1
fi

# I think normally the right thing to do will be to make schema or other database changes in 
# tunetrees_test_clean.sqlite3, then copy it to tunetrees.sqlite3 for migration.
# But normally the data in the test database should not change, since tests may rely on it.
# Or if data changes, it should be done in a very careful way.
# Putting this prompt here to remind me to remind me about this, and just to give an 
# option to not copy the test database to the main database.
read -p "copy tunetrees_test_clean.sqlite3 tunetrees.sqlite3? (y/n): " choice
echo choice: $choice
if [[ "$choice" == "y" || "$choice" == "Y" ]]; then
    echo "Copying tunetrees_test_clean.sqlite3 to tunetrees.sqlite3"
    cp tunetrees_test_clean.sqlite3 tunetrees.sqlite3
else
    echo "Not copying tunetrees_test_clean.sqlite3 to tunetrees.sqlite3 and exiting"
    exit 1
fi

#######################
# WARNING: When I ran this on Jan 29, 2025, I got an error:
# Runtime error near line 2: no such database: source_db
# Runtime error near line 3: malformed database schema (view_playlist_joined) - 
# view view_playlist_joined cannot reference objects in database main (11)
#
# I had to delete view_playlist_joined from tunetrees_do.sqlite3 for it to work.
#######################

# Get the current date in the format "Month_Day" (e.g., "Oct_07")
backup_file="./tunetrees_do_backup/backup_practice_$(date +%b_%d).sqlite3"

# Copy the remote database to a local backup file
scp -i ~/.ssh/id_rsa_ttdroplet -r sboag@165.227.182.140:tunetrees/tunetrees.sqlite3 "$backup_file"

scp -i ~/.ssh/id_rsa_ttdroplet -r sboag@165.227.182.140:tunetrees/tunetrees.sqlite3 "tunetrees_do.sqlite3"

cp tunetrees.sqlite3 tunetrees_local_backup/tunetrees_$(date +%b_%d).sqlite3

# Execute the SQL script, setting the :source_db parameter
sqlite3 tunetrees.sqlite3 <<EOF
.param set :source_db "tunetrees_do.sqlite3"
.read /Users/sboag/gittt/tunetrees/migrate_from_prod.sql
EOF

# I've been running the copy back to digital ocean manually, but when I get more comfortable 
# with this script, I can enable it to happen automatically:
# scp -i ~/.ssh/id_rsa_ttdroplet -r "tunetrees.sqlite3" sboag@165.227.182.140:tunetrees/tunetrees.sqlite3 
