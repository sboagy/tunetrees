#!/bin/bash

# Script to delete cancelled and/or failed workflow runs
# Usage: ./delete_failed_runs.sh [--cancelled] [--failure] [limit]
# Flags:
#   --cancelled : Only delete cancelled runs
#   --failure   : Only delete failed runs
#   (no flags)  : Delete both cancelled and failed runs
# Optional limit parameter: number of most recent runs to skip (default: 0)

# Load environment variables from .env.local
if [ -f .env.local ]; then
  source .env.local
fi

OWNER="${GITT_OWNER:-sboagy}"
REPO="${GITHUB_REPO:-tunetrees}"
DELETE_CANCELLED=false
DELETE_FAILURE=false
LIMIT=0

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --cancelled)
      DELETE_CANCELLED=true
      shift
      ;;
    --failure)
      DELETE_FAILURE=true
      shift
      ;;
    *)
      # Assume it's the limit number
      LIMIT=$1
      shift
      ;;
  esac
done

# If no flags specified, delete both
if [ "$DELETE_CANCELLED" = false ] && [ "$DELETE_FAILURE" = false ]; then
  DELETE_CANCELLED=true
  DELETE_FAILURE=true
fi

# Build the jq filter based on flags
if [ "$DELETE_CANCELLED" = true ] && [ "$DELETE_FAILURE" = true ]; then
  JQ_FILTER='.workflow_runs[] | select(.conclusion == "cancelled" or .conclusion == "failure") | .id'
  echo "Deleting cancelled and failed workflow runs for $OWNER/$REPO (skip first $LIMIT runs)"
elif [ "$DELETE_CANCELLED" = true ]; then
  JQ_FILTER='.workflow_runs[] | select(.conclusion == "cancelled") | .id'
  echo "Deleting cancelled workflow runs for $OWNER/$REPO (skip first $LIMIT runs)"
else
  JQ_FILTER='.workflow_runs[] | select(.conclusion == "failure") | .id'
  echo "Deleting failed workflow runs for $OWNER/$REPO (skip first $LIMIT runs)"
fi

# Fetch workflow runs based on filter
workflow_runs=$(gh api -X GET /repos/$OWNER/$REPO/actions/runs --paginate -q "$JQ_FILTER")

if [ -z "$workflow_runs" ]; then
  echo "No cancelled or failed workflow runs found"
  exit 0
fi

# Delete each workflow run
count=0
deleted=0
for run_id in $workflow_runs; do
  if [ "$count" -ge "$LIMIT" ]; then
    gh api -X DELETE /repos/$OWNER/$REPO/actions/runs/"$run_id" --silent
    echo "Deleted workflow run: $run_id (count: $count)"
    deleted=$((deleted + 1))
  else
    echo "Skipped workflow run: $run_id (count: $count)"
  fi
  count=$((count + 1))
done

echo ""
echo "Total deleted: $deleted"
echo "Total skipped: $LIMIT"
