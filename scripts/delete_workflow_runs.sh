#!/bin/bash

# Load environment variables from .env.local
if [ -f .env.local ]; then
  source .env.local
fi

OWNER="${GITT_OWNER:-sboagy}"
REPO="${GITHUB_REPO:-tunetrees}"

echo "Deleting all workflow runs for $OWNER/$REPO"

# Fetch all workflow runs
workflow_runs=$(gh api -X GET /repos/$OWNER/$REPO/actions/runs --paginate -q '.workflow_runs[].id')

# Delete each workflow run
count=0
for run_id in $workflow_runs; do
  if [ $count -ge 1 ]; then
    gh api -X DELETE /repos/$OWNER/$REPO/actions/runs/$run_id --silent
    echo "Deleted workflow run: $run_id, count: $count"
    # echo "count: $count; gh api -X DELETE /repos/$OWNER/$REPO/actions/runs/$run_id --silent"
  fi
  count=$((count + 1))
done
