#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
if [ "$PWD" = "$SCRIPT_DIR" ]; then
    cd ..
fi

if [ ! -f "tunetrees.sqlite3" ]; then
    echo "current directory must be the root of the tunetrees repo"
    exit 1
fi

export TUNETREES_DEPLOY_BASE_DIR="$(pwd)"
export TUNETREES_DB="${TUNETREES_DEPLOY_BASE_DIR}/tunetrees.sqlite3"

echo "TUNETREES_DEPLOY_BASE_DIR: $TUNETREES_DEPLOY_BASE_DIR"
echo "TUNETREES_DB: $TUNETREES_DB"

current_branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$current_branch" != "main" ]; then
    echo "Error: Only deply on main branch, Current git branch is not 'main'."
    exit 1
fi

echo "Redeploying the tt1dd stack"

docker -c default buildx bake all

docker -c tt1dd compose down
docker -c tt1dd compose pull
docker -c tt1dd compose up -d

echo "Redeployed the tt1dd stack!"