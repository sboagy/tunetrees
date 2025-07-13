#!/bin/bash

# Quick script to check deployment status

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
if [ "$PWD" = "$SCRIPT_DIR" ]; then
    cd ..
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Deployment Status Check ===${NC}"

DEPLOYMENT_LOG="./migration_deployments.log"
CURRENT_HEAD=$(alembic heads --resolve-dependencies | head -n1 | awk '{print $1}')

echo "Current migration head: $CURRENT_HEAD"
echo ""

if [ -f "$DEPLOYMENT_LOG" ]; then
    echo -e "${YELLOW}Recent deployments:${NC}"
    tail -n5 "$DEPLOYMENT_LOG" | while read line; do
        echo "  $line"
    done
    echo ""
    
    LAST_DEPLOYED=$(tail -n1 "$DEPLOYMENT_LOG" | awk '{print $3}')
    if [ "$LAST_DEPLOYED" = "$CURRENT_HEAD" ]; then
        echo -e "${GREEN}✓ Current migrations are deployed to production${NC}"
    else
        echo -e "${YELLOW}⚠️  Current migrations ($CURRENT_HEAD) not yet deployed${NC}"
        echo "Last deployed: $LAST_DEPLOYED"
    fi
else
    echo -e "${RED}No deployment log found${NC}"
    echo "Either no deployments have been made, or deployment tracking was not enabled"
fi

echo ""
echo "To deploy current migrations: ./scripts/migrate_prod_with_alembic.sh"
