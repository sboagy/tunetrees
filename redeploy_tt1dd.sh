#!/bin/bash

docker buildx bake all

docker -c tt1dd compose down
docker -c tt1dd compose pull
docker -c tt1dd compose up -d
