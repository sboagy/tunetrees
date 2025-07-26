#!/bin/bash

# Manual test script to verify production database schema matches clean test schema
# This helps detect schema drift in production before it becomes a problem

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Production Schema Verification Test ===${NC}"
echo "This script downloads the current production database and compares its schema"
echo "to the clean test schema to detect any drift or inconsistencies."
echo ""

# Check we're in the tunetrees repo root
if [ ! -f "tunetrees_test_clean.sqlite3" ]; then
    echo -e "${RED}ERROR: Must be run from tunetrees repo root (tunetrees_test_clean.sqlite3 not found)${NC}"
    exit 1
fi

# Check SSH key exists
if [ ! -f ~/.ssh/id_rsa_ttdroplet ]; then
    echo -e "${RED}ERROR: SSH key not found at ~/.ssh/id_rsa_ttdroplet${NC}"
    exit 1
fi

# Create temp directory for this test
TEST_DIR=$(mktemp -d)
trap "rm -rf $TEST_DIR" EXIT

echo -e "${YELLOW}Step 1: Download Current Production Database${NC}"
echo "Downloading from Digital Ocean..."

# Download production database
scp -i ~/.ssh/id_rsa_ttdroplet sboag@165.227.182.140:tunetrees/tunetrees.sqlite3 "$TEST_DIR/production_current.sqlite3"
echo -e "${GREEN}✓ Production database downloaded${NC}"

echo -e "${YELLOW}Step 2: Run Clear Schema Analysis${NC}"

# Check if the clear schema analysis tool exists
if [ ! -f "scripts/clear_schema_analysis.py" ]; then
    echo -e "${RED}ERROR: scripts/clear_schema_analysis.py not found${NC}"
    exit 1
fi

echo "Running comprehensive schema analysis..."

# Run the clear schema analysis tool  
if python3 scripts/clear_schema_analysis.py "tunetrees_test_clean.sqlite3" "$TEST_DIR/production_current.sqlite3"; then
    echo ""
    echo -e "${GREEN}✅ SUCCESS: Production schema matches clean test schema!${NC}"
    echo ""
    echo "Schema verification complete - no drift detected."
    exit 0
else
    echo ""
    echo -e "${RED}❌ FAILURE: Production schema differs from clean test schema!${NC}"
    echo ""
    
    # Save production database with timestamp for analysis
    timestamp=$(date +%Y%m%d_%H%M%S)
    cp "$TEST_DIR/production_current.sqlite3" "./production_backup_${timestamp}.sqlite3"
    
    echo -e "${GREEN}✓ Production database saved for analysis:${NC}"
    echo "  ./production_backup_${timestamp}.sqlite3"
    echo ""
    
    echo -e "${RED}This indicates schema drift in production!${NC}"
    echo "Possible causes:"
    echo "  - Manual changes made directly to production"
    echo "  - Missing migrations that weren't applied"  
    echo "  - Migration that didn't complete properly"
    echo ""
    echo -e "${CYAN}To re-run the analysis:${NC}"
    echo "  python3 scripts/clear_schema_analysis.py tunetrees_test_clean.sqlite3 ./production_backup_${timestamp}.sqlite3"
    
    exit 1
fi
