#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
if [ "$PWD" = "$SCRIPT_DIR" ]; then
    cd ..
fi

if [ ! -f "tunetrees.sqlite3" ]; then
    echo "current directory must be the root of the tunetrees repo"
    exit 1
fi

# export TUNETREES_DEPLOY_BASE_DIR="$(pwd)"
# export TUNETREES_DB="${TUNETREES_DEPLOY_BASE_DIR}/tunetrees.sqlite3"

# Don't use the above, because the deploy dir is not the same as the repo dir
# These are paths on the digital ocean server!
export TUNETREES_DB="/home/sboag/tunetrees/tunetrees.sqlite3"
export TUNETREES_DEPLOY_BASE_DIR="/home/sboag/tunetrees"

echo "(paths are relative to the digital ocean server)"
echo "TUNETREES_DEPLOY_BASE_DIR: $TUNETREES_DEPLOY_BASE_DIR"
echo "TUNETREES_DB: $TUNETREES_DB"

docker -c default buildx bake all

docker -c tt1dd compose down
docker -c tt1dd compose pull
docker -c tt1dd compose up -d
