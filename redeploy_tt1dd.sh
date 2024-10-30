#!/bin/bash

export TUNETREES_DB="/home/sboag/tunetrees/tunetrees.sqlite3"
export TUNETREES_DEPLOY_BASE_DIR="/home/sboag/tunetrees"

docker buildx bake all

docker -c tt1dd compose down
docker -c tt1dd compose pull
docker -c tt1dd compose up -d
