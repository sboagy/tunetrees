#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
if [ "$PWD" = "$SCRIPT_DIR" ]; then
    cd ..
fi

if [ ! -f "tunetrees.sqlite3" ]; then
    echo "current directory must be the root of the tunetrees repo"
    exit 1
fi

cp tunetrees.sqlite3 tunetrees_db_backup/tunetrees_$(date +%b_%d).sqlite3.bak
