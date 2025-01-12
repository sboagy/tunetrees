#!/bin/bash

# Load environment variables from .env.local
if [ -f .env.local ]; then
  source .env.local
fi

OWNER=${GITT_OWNER}
REPO=${GITTHUB_REPO}

echo "Deleting all workflow runs for $OWNER/$REPO"

# Fetch all workflow runs
workflow_runs=$(gh api -X GET /repos/$OWNER/$REPO/actions/runs --paginate -q '.workflow_runs[].id')

# Delete each workflow run
for run_id in $workflow_runs; do
  gh api -X DELETE /repos/$OWNER/$REPO/actions/runs/$run_id --silent
  echo "Deleted workflow run: $run_id"
done
