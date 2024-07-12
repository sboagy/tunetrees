#!/bin/bash

# For mac, if you have both Docker Desktop installed and
# Rancher, this is a crude script to fix up the symbolic 
# links to Docker Desktop.

ln -s -f -w -v /Applications/Docker.app/Contents/Resources/cli-plugins/docker-compose ~/.docker/cli-plugins/docker-compose
ln -s -f -w -v /Applications/Docker.app/Contents/Resources/cli-plugins/docker-buildx ~/.docker/cli-plugins/docker-buildx
