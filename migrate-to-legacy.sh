#!/bin/bash
# ============================================================================
# TuneTrees Legacy Migration Script
# ============================================================================
# This script moves the existing Python/Next.js codebase to a legacy/
# directory to make room for the new SolidJS PWA rewrite.
#
# IMPORTANT: Run this from the repository root on branch feat/pwa1
# ============================================================================

set -e  # Exit on any error

echo "🚀 TuneTrees Legacy Migration Script"
echo "===================================="
echo ""

# Safety check: Ensure we're in the right directory
if [ ! -d ".git" ]; then
    echo "❌ Error: Not in a git repository root. Please run from tunetrees/ directory."
    exit 1
fi

# Safety check: Ensure we're on the right branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "feat/pwa1" ]; then
    echo "⚠️  Warning: You're on branch '$CURRENT_BRANCH', not 'feat/pwa1'"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Safety check: Ensure working directory is clean
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  Warning: You have uncommitted changes."
    echo "Please commit or stash them before running this script."
    exit 1
fi

echo "✅ Safety checks passed"
echo ""

# Create legacy directory
echo "📁 Creating legacy/ directory..."
mkdir -p legacy

# ============================================================================
# Move Backend Files
# ============================================================================
echo "🐍 Moving Python backend to legacy/..."

git mv tunetrees legacy/
git mv tests legacy/
git mv requirements.txt legacy/
git mv pyproject.toml legacy/
git mv Dockerfile legacy/Dockerfile.python
git mv compose.yaml legacy/
git mv docker-bake.hcl legacy/

# Python-specific files
[ -f "test_goals_manually.py" ] && git mv test_goals_manually.py legacy/
[ -f "ttrees_db.ipynb" ] && git mv ttrees_db.ipynb legacy/

# ============================================================================
# Move Frontend Files
# ============================================================================
echo "⚛️  Moving Next.js frontend to legacy/..."

git mv frontend legacy/

# ============================================================================
# Move Database & SQL Files
# ============================================================================
echo "🗄️  Moving database files to legacy/..."

git mv sql_scripts legacy/

# Database files (if tracked - most are in .gitignore)
[ -f "tunetrees_test_clean.sqlite3" ] && git mv tunetrees_test_clean.sqlite3 legacy/ || true
[ -f "backup_sept_4_tunetrees_test_clean.sqlite3" ] && git mv backup_sept_4_tunetrees_test_clean.sqlite3 legacy/ || true

# ============================================================================
# Move Infrastructure Files
# ============================================================================
echo "🔧 Moving infrastructure files to legacy/..."

git mv nginx-conf legacy/
git mv certbot legacy/ || true
git mv certbot-etc legacy/ || true
git mv certbot-var legacy/ || true
git mv certs legacy/ || true
git mv dhparam legacy/ || true

# ============================================================================
# Move Schemas & Data
# ============================================================================
echo "📋 Moving schema and data files to legacy/..."

git mv schemas legacy/
git mv data legacy/ || true

# ============================================================================
# Move IDE & Environment Files
# ============================================================================
echo "💼 Moving IDE workspace files to legacy/..."

[ -f "backend.code-workspace" ] && git mv backend.code-workspace legacy/
[ -f "backend_python.code-profile" ] && git mv backend_python.code-profile legacy/
[ -f "frontend.code-workspace" ] && git mv frontend.code-workspace legacy/
[ -f "frontend_nodejs.code-profile" ] && git mv frontend_nodejs.code-profile legacy/

# ============================================================================
# Move Temporary/Working Files
# ============================================================================
echo "🗑️  Moving temporary files to legacy/..."

[ -f "fastapi.pid" ] && git mv fastapi.pid legacy/ || true
[ -f "openapi.json" ] && git mv openapi.json legacy/ || true
[ -f "pip_freeze.txt" ] && git mv pip_freeze.txt legacy/ || true
[ -f "pip_list.txt" ] && git mv pip_list.txt legacy/ || true
[ -f "pip_outdated.txt" ] && git mv pip_outdated.txt legacy/ || true
[ -f "outdated_packages.txt" ] && git mv outdated_packages.txt legacy/ || true
[ -f "current_requirements.txt" ] && git mv current_requirements.txt legacy/ || true
[ -f "compiled_requirements.txt" ] && git mv compiled_requirements.txt legacy/ || true

# ============================================================================
# Move Old Virtual Environments (if tracked)
# ============================================================================
[ -d "old.venv" ] && git mv old.venv legacy/ || true
[ -d "saved.venv" ] && git mv saved.venv legacy/ || true

# ============================================================================
# Move Backup Directories
# ============================================================================
echo "💾 Moving backup directories to legacy/..."

[ -d "tunetrees_do_backup" ] && git mv tunetrees_do_backup legacy/ || true
[ -d "tunetrees_local_backup" ] && git mv tunetrees_local_backup legacy/ || true

# ============================================================================
# Move Import Output
# ============================================================================
[ -d "iti_import_output" ] && git mv iti_import_output legacy/ || true

# ============================================================================
# Move GitHub Action Logs
# ============================================================================
[ -d "github-action-logs" ] && git mv github-action-logs legacy/ || true
[ -d "ci-logs" ] && git mv ci-logs legacy/ || true

# ============================================================================
# Move MCP Memory (if you want to keep it for legacy reference)
# ============================================================================
[ -d "mcp-memory" ] && git mv mcp-memory legacy/ || true

# ============================================================================
# Files to KEEP in Root
# ============================================================================
echo ""
echo "📌 Keeping in root (will be updated for new app):"
echo "   - .github/ (CI/CD - will update later)"
echo "   - .gitignore (will update)"
echo "   - README.md (will update)"
echo "   - LICENSE (unchanged)"
echo "   - _notes/ (migration docs)"
echo "   - design/ (reference)"
echo "   - docs/ (will update)"
echo "   - archive/ (historical)"
echo "   - scratch/ (working notes)"
echo "   - scripts/ (some may be reusable)"
echo ""

# ============================================================================
# Update .gitignore for New SolidJS App
# ============================================================================
echo "📝 Updating .gitignore for SolidJS artifacts..."

cat >> .gitignore << 'EOF'

# ============================================================================
# SolidJS PWA Rewrite Additions
# ============================================================================

# Build outputs
/dist
/.solid
/.output
/.vinxi
/.vercel

# SolidJS specific
.solid/

# Vite
vite.config.ts.timestamp-*

# Cloudflare
.wrangler/
wrangler.toml

# SQLite WASM (local development)
*.db
*.db-shm
*.db-wal

# Drizzle ORM
drizzle/

# Package manager
pnpm-lock.yaml
yarn.lock
.pnpm-store/

# TypeScript
*.tsbuildinfo

# Environment
.env.local
.env.production.local
.env.development.local

# Supabase (local development)
supabase/.branches
supabase/.temp

# Legacy code (keep in git, but IDE might generate files)
legacy/node_modules/
legacy/.next/
legacy/dist/
legacy/__pycache__/
EOF

echo "✅ .gitignore updated"

# ============================================================================
# Create Initial SolidJS Project Structure Placeholder
# ============================================================================
echo ""
echo "📦 Creating placeholder structure for new SolidJS app..."

mkdir -p src/components
mkdir -p src/routes
mkdir -p src/lib
mkdir -p public

# Create a README marker
cat > src/README.md << 'EOF'
# TuneTrees SolidJS PWA

This directory contains the new SolidJS Progressive Web App rewrite.

## Getting Started

Coming soon - will be initialized with Vite + SolidJS.

## Reference Legacy Code

See `../legacy/` for the original Python/Next.js implementation.
EOF

echo "✅ Placeholder structure created"

# ============================================================================
# Commit the Migration
# ============================================================================
echo ""
echo "📝 Committing the migration..."

git add -A

git commit -m "🏗️ refactor: Move legacy codebase to legacy/ for SolidJS PWA rewrite

- Moved Python backend (tunetrees/, tests/, requirements) to legacy/
- Moved Next.js frontend to legacy/frontend/
- Moved database scripts and schemas to legacy/
- Moved infrastructure (nginx, docker, certbot) to legacy/
- Updated .gitignore for new SolidJS artifacts
- Created placeholder src/ structure for new app
- Preserved documentation, design, and scripts in root

This commit preserves full git history while providing a clean slate
for the SolidJS/Supabase/SQLite WASM rewrite.

Reference: _notes/solidjs-pwa-migration-plan.md"

echo ""
echo "✅ Migration complete!"
echo ""
echo "📊 Summary:"
git show --stat HEAD

echo ""
echo "🎯 Next Steps:"
echo "   1. Review the changes: git show HEAD"
echo "   2. Initialize SolidJS: npm create vite@latest . -- --template solid-ts"
echo "   3. Set up Supabase project"
echo "   4. Begin Phase 0 implementation"
echo ""
echo "💡 To reference legacy code:"
echo "   - Backend: legacy/tunetrees/"
echo "   - Frontend: legacy/frontend/"
echo "   - Database: legacy/sql_scripts/"
echo ""
echo "✨ Ready to build the future of TuneTrees!"
