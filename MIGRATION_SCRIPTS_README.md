# Migration Script Usage Guide

## Overview

Two scripts are provided to help with the legacy code migration:

### 1. `migrate-to-legacy.5. **Get your API credentials:**

**A. Get the anon public key:**

- In left sidebar, click the **⚙️ Settings** icon (gear icon at bottom)
- Click **"API Keys"** (has a "NEW" badge)
- Under the **`anon` `public`** section, click **Copy** to copy the key
  - It's a long string starting with `eyJ...`
  - ⚠️ **DO NOT** copy the `service_role` key (marked as "secret" - that's for server-side only!)

**B. Get the Project URL:**

- In the same **Settings** menu, click **"Data API"**
- You'll see your **Project URL** at the top (looks like `https://xxxxxxxxxxxxx.supabase.co`)
- Alternatively, look at your browser's address bar - the URL contains your project reference:
  - If you see `https://supabase.com/dashboard/project/xxxxxxxxxxxxx`, your Project URL is `https://xxxxxxxxxxxxx.supabase.co`ve to Legacy Structure

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
# Use Vite (REQUIRED for PWA architecture)
npm create vite@latest . -- --template solid-ts

# Install dependencies
npm install
```

> **⚠️ Why Vite, not SolidStart?**
>
> - **TuneTrees is a client-side PWA** - no server-side rendering needed
> - **Offline-first architecture** - all data from local SQLite WASM
> - **Static deployment** - Cloudflare Pages serves pre-built files
> - **SolidStart** is for SSR (server-side rendering), which conflicts with our edge/static deployment model
> - Vite gives us faster builds, simpler deployment, and perfect PWA support

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

1. Go to [supabase.com](https://supabase.com) and sign up/log in
2. Click **"New Project"** button
3. Fill in project details:
   - **Name:** `tunetrees` (or your preference)
   - **Database Password:** Generate and save securely (you'll rarely need this)
   - **Region:** Choose closest to you (e.g., `us-west-1`)
   - Click **"Create new project"**
4. Wait 2-3 minutes for provisioning to complete
5. **Get your API credentials:**
   - In left sidebar, click the **⚙️ Settings** icon (gear icon at bottom)
   - In the Settings menu, click **"API Keys"** (has a "NEW" badge)
   - You'll see the API settings page with:
     - **Project URL:** Copy this (looks like `https://xxxxxxxxxxxxx.supabase.co`)
     - **API Keys section:**
       - Copy the **`anon` `public`** key (long string starting with `eyJ...`)
       - ⚠️ **DO NOT** copy the `service_role` key (that's for server-side only, never expose it!)
6. Create `.env.local` in your project root:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4eHh4eHh4eHgiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY5...
```

> **🔒 Security Note:**
>
> - The `anon` key is **safe to expose** in client-side code (it's public)
> - Supabase uses Row-Level Security (RLS) policies to protect data
> - Add `.env.local` to `.gitignore` (should already be there)
> - Never commit the `service_role` key to git!

### 5. **Set Up Drizzle ORM**

```bash
# Create Drizzle config
mkdir drizzle
touch drizzle/schema.ts
touch drizzle.config.ts
```

### 6. **(Optional) Connect DBeaver to Supabase Database**

You can use DBeaver (or any PostgreSQL client) to directly access your Supabase database:

1. **Get connection details from Supabase:**

   - In Supabase dashboard: **Settings → Database**
   - Under **Connection Info** section, note:
     - **Host:** `db.xxxxxxxxxxxxx.supabase.co` (your project reference)
     - **Port:** `5432` (standard PostgreSQL)
     - **Database:** `postgres`
     - **User:** `postgres`
     - **Password:** The database password you created during project setup

2. **Configure DBeaver:**

   - Create **New Connection → PostgreSQL**
   - Fill in the connection details from step 1
   - **Enable SSL** (required by Supabase)
   - Test connection

3. **Use cases for direct database access:**
   - 🔍 **Debugging** - When sync isn't working as expected
   - 📊 **Analytics** - Running complex queries on production data
   - 🛠️ **Schema verification** - Checking Drizzle migrations applied correctly
   - 🚨 **Emergency fixes** - Manual data corrections when needed

> **⚠️ Important:**
>
> - Direct database access bypasses Row Level Security (RLS) policies
> - Use sparingly - normal development should go through SQLite WASM → Supabase sync layer
> - Be careful with manual changes - they won't trigger RLS validation

### 7. **Start Development**

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
