# Migration Script Usage Guide

## Overview

Two scripts are provided to help with the legacy code migration:

### 1. `migrate-to-legacy.sh` - Move to Legacy Structure

**Purpose:** Reorganizes the repository to move existing Python/Next.js code into `legacy/` directory.

**What it does:**

- ✅ Moves Python backend (`tunetrees/`, `tests/`) to `legacy/`
- ✅ Moves Next.js frontend to `legacy/frontend/`
- ✅ Moves database files and SQL scripts to `legacy/`
- ✅ Moves infrastructure (Docker, nginx, certbot) to `legacy/`
- ✅ Updates `.gitignore` for SolidJS artifacts
- ✅ Creates placeholder `src/` structure
- ✅ Commits everything with descriptive message
- ✅ **Keeps legacy code in git** (not gitignored)

**What it preserves in root:**

- `.github/` - CI/CD workflows (will update later)
- `README.md`, `LICENSE` - Documentation
- `_notes/`, `design/`, `docs/` - Reference docs
- `archive/`, `scratch/`, `scripts/` - Working files

**Usage:**

```bash
# Make sure you're on the right branch
git switch feat/pwa1

# Ensure working directory is clean
git status

# Run the migration
./migrate-to-legacy.sh

# Review the changes
git show HEAD
```

**Safety Features:**

- Checks you're in a git repository
- Warns if not on `feat/pwa1` branch
- Requires clean working directory (no uncommitted changes)
- Uses `git mv` to preserve file history
- Single atomic commit

---

### 2. `restore-from-legacy.sh` - Undo Migration (Rollback)

**Purpose:** Reverses the migration if needed.

**What it does:**

- ⏮️ Moves everything back from `legacy/` to root
- ⏮️ Removes new SolidJS structure (`src/`, config files)
- ⏮️ Restores original directory layout

**Usage:**

```bash
# CAUTION: This will delete new SolidJS work!
./restore-from-legacy.sh

# Commit the restoration
git commit -m "🔙 Restore legacy structure"
```

**Warning:** Only use this if you need to completely roll back the migration. Any new SolidJS code will be lost.

---

## Post-Migration Next Steps

After running `migrate-to-legacy.sh`:

### 1. **Verify the Migration**

```bash
# Check the commit
git show HEAD --stat

# Verify legacy code is accessible
ls legacy/tunetrees
ls legacy/frontend
```

### 2. **Initialize SolidJS Project**

```bash
# Option A: Using Vite (recommended for PWA)
npm create vite@latest . -- --template solid-ts

# Option B: Using SolidStart (if you want SSR capabilities)
npm create solid@latest

# Install dependencies
npm install
```

### 3. **Set Up Initial Dependencies**

```bash
# Core dependencies
npm install @solidjs/router solid-js

# Database & Sync
npm install drizzle-orm sql.js @supabase/supabase-js

# UI Components
npm install @kobalte/core tailwindcss

# Development
npm install -D drizzle-kit @tailwindcss/vite vite-plugin-pwa
```

### 4. **Configure Supabase**

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and anon key
4. Create `.env.local`:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 5. **Set Up Drizzle ORM**

```bash
# Create Drizzle config
mkdir drizzle
touch drizzle/schema.ts
touch drizzle.config.ts
```

### 6. **Start Development**

```bash
# Run dev server
npm run dev
```

---

## Directory Structure After Migration

```
tunetrees/
├── legacy/                    # All original code (in git)
│   ├── frontend/             # Next.js app
│   ├── tunetrees/            # Python backend
│   ├── tests/                # Pytest tests
│   ├── sql_scripts/          # Database scripts
│   ├── nginx-conf/           # Infrastructure
│   ├── requirements.txt
│   ├── pyproject.toml
│   └── ...
│
├── src/                       # New SolidJS app (to be built)
│   ├── components/
│   ├── routes/
│   ├── lib/
│   └── README.md
│
├── public/                    # Static assets
├── drizzle/                   # Database schema
│   └── schema.ts
│
├── .github/                   # CI/CD (keep, will update)
├── _notes/                    # Migration docs
├── design/                    # Design references
├── docs/                      # Documentation
├── scripts/                   # Utility scripts
│
├── package.json               # New dependencies
├── vite.config.ts            # Build config
├── tsconfig.json             # TypeScript config
├── .gitignore                # Updated
├── README.md                 # Updated
└── LICENSE                   # Unchanged
```

---

## Referencing Legacy Code

### Backend Logic

```typescript
// When porting Python code, reference:
// legacy/tunetrees/app/schedule.py
// legacy/tunetrees/app/queries.py
// legacy/tunetrees/models/tunetrees.py
```

### Frontend Components

```typescript
// When porting React components, reference:
// legacy/frontend/components/
// legacy/frontend/app/(main)/
```

### Database Schema

```typescript
// When creating Drizzle schema, reference:
// legacy/tunetrees/models/tunetrees.py (SQLAlchemy models)
// legacy/sql_scripts/ (SQL migrations)
```

---

## Troubleshooting

### Script Fails with "Not in git repository"

**Solution:** Make sure you're in the repository root:

```bash
cd /Users/sboag/gittt/tunetrees
./migrate-to-legacy.sh
```

### Script Fails with "Uncommitted changes"

**Solution:** Commit or stash your work first:

```bash
git status
git add .
git commit -m "Save work before migration"
./migrate-to-legacy.sh
```

### Want to Review Changes Before Committing

**Solution:** The script creates a single commit. You can amend it:

```bash
./migrate-to-legacy.sh
git commit --amend  # Edit the commit message or add files
```

### Need to Undo Part of the Migration

**Solution:** Use git to cherry-pick specific files back:

```bash
# Example: bring back a specific file to root
git mv legacy/scripts/some-script.sh ./scripts/
git commit -m "Move script back to root"
```

---

## FAQ

**Q: Will I lose any code?**  
A: No. Everything is committed to git with full history preserved. The `legacy/` directory is tracked, not gitignored.

**Q: Can other developers access the legacy code?**  
A: Yes. When they clone the repo or pull this branch, they'll get the full `legacy/` directory.

**Q: What if I need to reference the old code?**  
A: It's all in `legacy/` and fully searchable. Your IDE can still index it.

**Q: Can I run the old app?**  
A: Yes, but you'd need to:

```bash
cd legacy/frontend
npm install
npm run dev
```

And separately run the Python backend from `legacy/tunetrees`.

**Q: Should I delete the legacy code eventually?**  
A: After the new app is stable and deployed, you could move `legacy/` to a separate `legacy` branch or archive repo. But keep it during active development for reference.

---

## Contact & Support

For issues with the migration scripts or questions about the rewrite process, refer to:

- Migration plan: `_notes/solidjs-pwa-migration-plan.md`
- Original plan: `_notes/pwa_rewrite_plan.md`

---

**Last Updated:** October 4, 2025  
**Scripts Version:** 1.0
