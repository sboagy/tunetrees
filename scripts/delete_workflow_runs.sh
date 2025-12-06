#!/bin/bash

# Load environment variables from .env.local
if [ -f .env.local ]; then
  source .env.local
fi

OWNER="${GITT_OWNER:-sboagy}"
REPO="${GITHUB_REPO:-tunetrees}"
LIMIT="${1:-2}"

echo "Deleting all workflow runs for $OWNER/$REPO (skip first $LIMIT runs)"

# Fetch all workflow runs
workflow_runs=$(gh api -X GET /repos/$OWNER/$REPO/actions/runs --paginate -q '.workflow_runs[].id')

# Delete each workflow run
count=0
for run_id in $workflow_runs; do
  if [ "$count" -ge "$LIMIT" ]; then
    gh api -X DELETE /repos/$OWNER/$REPO/actions/runs/"$run_id" --silent
    echo "Deleted workflow run: $run_id, count: $count"
  fi
  count=$((count + 1))
done
