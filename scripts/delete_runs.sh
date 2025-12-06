#!/bin/bash

# Script to delete cancelled, failed, and/or action-required (waiting approval) workflow runs
# Usage: ./delete_runs.sh [--cancelled] [--failure] [--action_required] [--dry] [limit]
# Flags:
#   --cancelled        : Delete cancelled runs
#   --failure          : Delete failed runs
#   --action_required  : Delete runs requiring action/approval (status==waiting or conclusion==action_required)
#   --dry              : Dry run; print runs that would be deleted without deleting
#   (no flags)         : Delete cancelled and failed runs (default)
# Optional limit parameter: number of most recent runs to skip (default: 0)

# Load environment variables from .env.local
if [ -f .env.local ]; then
  source .env.local
fi

OWNER="${GITT_OWNER:-sboagy}"
REPO="${GITHUB_REPO:-tunetrees}"
DELETE_CANCELLED=false
DELETE_FAILURE=false
DELETE_ACTION_REQUIRED=false
DRY_RUN=false
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
    --action_required)
      DELETE_ACTION_REQUIRED=true
      shift
      ;;
    --dry)
      DRY_RUN=true
      shift
      ;;
    *)
      # Assume it's the limit number
      LIMIT=$1
      shift
      ;;
  esac
done

# If no flags specified, delete both cancelled and failed (default behavior)
if [ "$DELETE_CANCELLED" = false ] && [ "$DELETE_FAILURE" = false ] && [ "$DELETE_ACTION_REQUIRED" = false ]; then
  DELETE_CANCELLED=true
  DELETE_FAILURE=true
fi

# Build jq conditions based on flags
conditions=()
if [ "$DELETE_CANCELLED" = true ]; then
  conditions+=(".conclusion == \"cancelled\"")
fi
if [ "$DELETE_FAILURE" = true ]; then
  conditions+=(".conclusion == \"failure\"")
fi
if [ "$DELETE_ACTION_REQUIRED" = true ]; then
  # Covers environment approval holds and action-required conclusions
  conditions+=(".status == \"waiting\" or .conclusion == \"action_required\"")
fi

# Join conditions with OR
JOINED_COND=$(printf " or %s" "${conditions[@]}")
JOINED_COND=${JOINED_COND#" or "}

JQ_FILTER=".workflow_runs[] | select(${JOINED_COND}) | .id"

# Describe action
desc_parts=()
[ "$DELETE_CANCELLED" = true ] && desc_parts+=("cancelled")
[ "$DELETE_FAILURE" = true ] && desc_parts+=("failed")
[ "$DELETE_ACTION_REQUIRED" = true ] && desc_parts+=("action-required (waiting)")
DESC=$(IFS=", "; echo "${desc_parts[*]}")
if [ "$DRY_RUN" = true ]; then
  echo "Dry run: listing ${DESC} workflow runs for $OWNER/$REPO (skip first $LIMIT runs)"
else
  echo "Deleting ${DESC} workflow runs for $OWNER/$REPO (skip first $LIMIT runs)"
fi

# Fetch workflow runs based on filter
workflow_runs=$(gh api -X GET /repos/$OWNER/$REPO/actions/runs --paginate -q "$JQ_FILTER")

if [ -z "$workflow_runs" ]; then
  echo "No matching workflow runs found"
  exit 0
fi

# Delete each workflow run (or list in dry-run mode)
count=0
deleted=0
for run_id in $workflow_runs; do
  if [ "$count" -ge "$LIMIT" ]; then
    if [ "$DRY_RUN" = true ]; then
      echo "DRY RUN: Would delete workflow run: $run_id (count: $count)"
      deleted=$((deleted + 1))
    else
      gh api -X DELETE /repos/$OWNER/$REPO/actions/runs/"$run_id" --silent
      echo "Deleted workflow run: $run_id (count: $count)"
      deleted=$((deleted + 1))
    fi
  else
    echo "Skipped workflow run: $run_id (count: $count)"
  fi
  count=$((count + 1))
done

echo ""
if [ "$DRY_RUN" = true ]; then
  echo "Total that would be deleted: $deleted"
else
  echo "Total deleted: $deleted"
fi
echo "Total skipped: $LIMIT"
