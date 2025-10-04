#!/bin/bash
# ============================================================================
# TuneTrees Legacy Restoration Script (UNDO)
# ============================================================================
# This script REVERSES the legacy migration, restoring the original structure.
# Use this if you need to roll back the migration.
#
# WARNING: This will delete the new SolidJS structure if it exists.
# ============================================================================

set -e

echo "🔄 TuneTrees Legacy Restoration Script"
echo "======================================"
echo ""
echo "⚠️  WARNING: This will restore the legacy structure and remove new SolidJS files."
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Safety check
if [ ! -d "legacy" ]; then
    echo "❌ Error: No legacy/ directory found. Nothing to restore."
    exit 1
fi

if [ ! -d ".git" ]; then
    echo "❌ Error: Not in a git repository root."
    exit 1
fi

echo "🔙 Restoring legacy structure..."

# Move everything back from legacy/
git mv legacy/tunetrees ./
git mv legacy/tests ./
git mv legacy/requirements.txt ./
git mv legacy/pyproject.toml ./
git mv legacy/Dockerfile.python ./Dockerfile
git mv legacy/compose.yaml ./
git mv legacy/docker-bake.hcl ./
git mv legacy/frontend ./
git mv legacy/sql_scripts ./
git mv legacy/nginx-conf ./
git mv legacy/schemas ./

# Move optional files if they exist
[ -d "legacy/data" ] && git mv legacy/data ./ || true
[ -d "legacy/certbot" ] && git mv legacy/certbot ./ || true
[ -d "legacy/certbot-etc" ] && git mv legacy/certbot-etc ./ || true
[ -d "legacy/certbot-var" ] && git mv legacy/certbot-var ./ || true
[ -d "legacy/certs" ] && git mv legacy/certs ./ || true
[ -d "legacy/dhparam" ] && git mv legacy/dhparam ./ || true
[ -f "legacy/backend.code-workspace" ] && git mv legacy/backend.code-workspace ./ || true
[ -f "legacy/backend_python.code-profile" ] && git mv legacy/backend_python.code-profile ./ || true
[ -f "legacy/frontend.code-workspace" ] && git mv legacy/frontend.code-workspace ./ || true
[ -f "legacy/frontend_nodejs.code-profile" ] && git mv legacy/frontend_nodejs.code-profile ./ || true

# Remove new SolidJS structure
[ -d "src" ] && git rm -rf src || true
[ -f "vite.config.ts" ] && git rm vite.config.ts || true
[ -f "tsconfig.json" ] && git rm tsconfig.json || true
[ -f "package.json" ] && git rm package.json || true

# Remove empty legacy directory
rmdir legacy 2>/dev/null || echo "Note: legacy/ directory not empty, leaving it"

echo "✅ Restoration complete!"
echo ""
echo "🔄 Commit this restoration:"
echo "   git commit -m '🔙 Restore legacy structure'"
