#!/bin/bash

# For mac, if you have both Docker Desktop installed and
# Rancher, this is a crude script to fix up the symbolic 
# links to Rancher.

ln -s -f -w -v ~/.rd/bin/docker-compose ~/.docker/cli-plugins/docker-compose
ln -s -f -w -v ~/.rd/bin/docker-buildx ~/.docker/cli-plugins/docker-buildx
