# Markdown Documentation Cleanup Plan

**Date:** October 15, 2025  
**Current Count:** 27 root-level `.md` files + 73 `_notes/*.md` files = **100 markdown files**  
**Target:** Reduce to ~20-25 essential files, archive the rest

---

## 📊 Analysis Summary

### Root Directory Issues

- **26 markdown files** cluttering the root (should be ~5 max)
- Many are **completion summaries** from past sprints
- Several **duplicate/overlapping guides** (deployment, setup, fixes)
- Mix of **active documentation** and **historical artifacts**

### \_notes/ Directory Issues

- **73 files** (way too many!)
- Lots of **phase completion summaries** (phases 0-8 all documented multiple times)
- Multiple **context transfer** documents (5+ files)
- Many **bug fix** summaries that are now irrelevant
- **Session summaries** from October 9-12 (short-term artifacts)

---

## 🗂️ Categorization

### Category 1: **Keep Active** (Essential, Current)

These are actively used or referenced, keep in root or `_notes/`:

#### Root Directory (Keep):

1. ✅ **README.md** - Main project readme
2. ✅ **QUICKSTART.md** - Quick setup guide (combine with ENV_SETUP_QUICKSTART.md)
3. ✅ **todo.md** - Current task list
4. ✅ **.github/copilot-instructions.md** - Active Copilot config

#### \_notes/ Directory (Keep):

1. ✅ **solidjs-pwa-migration-plan.md** - Master migration plan (KEEP!)
2. ✅ **context-transfer-practice-tab-next-phase.md** - Current work context
3. ✅ **testing-infrastructure-complete.md** - Active testing setup
4. ✅ **test-users.md** - Test user specs
5. ✅ **phase-10-postgresql-docker-testing-plan.md** - Future phase plan
6. ✅ **tt*scratch*\*.md** - User's scratch files (exempted)

**Total Keep: ~10 files**

---

### Category 2: **Consolidate** (Merge Similar Docs)

#### 🔀 Consolidation Group 1: Environment Setup

**Merge into:** `docs/SETUP.md` (new consolidated guide)

- ENV_SETUP_QUICKSTART.md
- ENVIRONMENT_SETUP.md
- GITHUB_ACTIONS_SECRETS.md

#### 🔀 Consolidation Group 2: Deployment

**Merge into:** `docs/DEPLOYMENT.md` (new consolidated guide)

- CLOUDFLARE_DEPLOYMENT_GUIDE.md
- CLOUDFLARE_DEPLOYMENT_SETUP.md
- DEPLOYMENT_CHECKLIST.md
- DEPLOYMENT_SETUP_SUMMARY.md

#### 🔀 Consolidation Group 3: Database Migration

**Merge into:** `docs/DATABASE_MIGRATION.md` (new consolidated guide)

- MIGRATION_SCRIPTS_README.md
- PRODUCTION_MIGRATION_README.md
- SCHEMA_AUDIT_REPORT.md
- \_notes/schema-migration-strategy.md
- \_notes/supabase-migration-setup.md
- \_notes/uuid-migration-strategy.md

#### 🔀 Consolidation Group 4: Phase Completion Summaries

**Merge into:** `_notes/PHASE_COMPLETION_LOG.md` (single timeline doc)

- \_notes/phase-0-completion-summary.md
- \_notes/phase-1-completion-summary.md
- \_notes/phase-1-final-summary.md
- \_notes/phase-2-task-2-completion.md
- \_notes/phase-2-task-3-completion.md
- \_notes/phase-2-task-4-completion.md
- \_notes/phase-2-task-7-sync-completion.md
- \_notes/PHASE_2_COMPLETE.md
- \_notes/phase-4-completion-summary.md
- \_notes/phase-5-completion-summary.md
- \_notes/phase-6-task-1-abc-notation-complete.md
- \_notes/phase-7-task-2-completion.md
- \_notes/phase-8-completion-summary.md
- \_notes/phase-8-task-1-completion-summary.md
- \_notes/phase-8-task-4-completion.md
- \_notes/task-5-completion-summary.md
- \_notes/task-6-crud-completion-summary.md
- \_notes/production-migration-completion-summary.md
- PHASE_1_COMPLETE.md (root - move to consolidated)

**Format:** Chronological log with dates, what was done, links to code

---

### Category 3: **Archive** (Historical, No Longer Relevant)

#### 📦 Archive Bucket 1: Bug Fixes (Fixed, No Longer Needed)

Move to `archive/new/md/bug-fixes/`:

- CACHED_DATA_IMMEDIATE_DISPLAY_FIX.md
- COLUMN_PERSISTENCE_FIX.md
- GRID_STYLING_FIX.md
- SYNC_FIX_COMPLETE.md
- SYNC_FLOW_FIX.md
- \_notes/database-fixes-part2.md
- \_notes/database-migration-fixes.md
- \_notes/practice-history-database-fix.md
- \_notes/seed-data-schema-fixes.md

#### 📦 Archive Bucket 2: Context Transfer Docs (Obsolete Sessions)

Move to `archive/new/md/context-transfers/`:

- \_notes/context-transfer-phase7-task2.md
- \_notes/context-transfer-repertoire-tab.md
- \_notes/context-transfer-repertoire-tab-complete.md
- \_notes/context-transfer-ui-cleanup-oct9.md
- \_notes/context-transfer-ui-cleanup-oct11.md

**Note:** Keep `context-transfer-practice-tab-next-phase.md` (current work!)

#### 📦 Archive Bucket 3: Session Summaries (Short-term artifacts)

Move to `archive/new/md/sessions/`:

- \_notes/catalog-grid-advanced-features.md
- \_notes/catalog-grid-fixes-empty-data-toolbar.md
- \_notes/catalog-grid-integration-complete.md
- \_notes/oct10-catalog-toolbar-session-summary.md
- \_notes/combined-filter-dropdown-tune-count-debug.md
- \_notes/session-sidebar-redesign-oct11.md
- \_notes/tune-grid-integration-guide.md
- \_notes/tune-grids-session-1-summary.md
- \_notes/tunelist-table-refactor-completion.md

#### 📦 Archive Bucket 4: Intermediate Implementation Guides

Move to `archive/new/md/implementation-guides/`:

- CACHE_IMPLEMENTATION_GUIDE.md
- TOOLBAR_STYLES_SUMMARY.md
- TYPESCRIPT_FIXES_SUMMARY.md
- LOADING_STATES_SUMMARY.md
- \_notes/TOOLBAR_IMPLEMENTATION_PLAN.md
- \_notes/practice-tab-implementation-complete.md
- \_notes/reference-data-sync-implementation.md
- \_notes/sync-engine-supabase-refactor.md

#### 📦 Archive Bucket 5: UX Fix Docs (Completed)

Move to `archive/new/md/ux-fixes/`:

- DEPLOYMENT_UX_FIXES_JAN12.md
- POST_DEPLOYMENT_UX_FIXES.md

#### 📦 Archive Bucket 6: Schema/DB Tools (One-time use)

Move to `archive/new/md/schema-tools/`:

- \_notes/drizzle-schema-files-explained.md
- \_notes/how-to-set-column-defaults.md
- \_notes/schema-conversion-tool-complete.md
- \_notes/schema-synchronization-complete.md
- \_notes/sqlite-to-postgres-mapping.md

#### 📦 Archive Bucket 7: Old Plans/Checklists (Superseded)

Move to `archive/new/md/old-plans/`:

- \_notes/phase-0-checklist.md (superseded by completion summary)
- \_notes/phase-3-pwa-practice-plan.md (superseded by current context doc)
- \_notes/phase-4-ui-layout-plan.md (completed)
- \_notes/phase-6-advanced-features-plan.md (in progress, keep for now?)
- \_notes/phase-7-pwa-features-plan.md (completed)
- \_notes/phase-8-remote-sync-plan.md (completed)
- \_notes/migration-plan-update-v2.md (superseded by solidjs-pwa-migration-plan.md)
- \_notes/pwa_rewrite_plan.md (superseded by solidjs-pwa-migration-plan.md)
- \_notes/strategy.md (vague, unclear)

#### 📦 Archive Bucket 8: Testing Docs (Keep Active Ones)

Keep active:

- \_notes/testing-infrastructure-complete.md ✅
- \_notes/test-users.md ✅
- \_notes/phase-10-postgresql-docker-testing-plan.md ✅

Archive old:

- \_notes/ci-testing-setup.md (superseded by testing-infrastructure-complete.md)
- \_notes/pwa-testing-guide.md (superseded)
- \_notes/task-12-testing-guide.md (legacy practice testing)
- \_notes/test-plan-alice-signin.md (specific test, obsolete)
- \_notes/test-user-password-setup.md (setup done, archive)

#### 📦 Archive Bucket 9: Operational Guides (Reference Only)

Move to `archive/new/md/operations/`:

- \_notes/clear-pwa-cache-steps.md (one-time fix guide)
- \_notes/rls-policies-status.md (snapshot, now outdated)
- \_notes/practice_queue_checklist.md (old checklist)
- \_notes/plan_for_review_updates.md (vague plan)
- \_notes/tunes_grids_specification.md (outdated spec)
- \_notes/phase-8-task-1-schema-audit.md (audit done)
- \_notes/phase-8-task-1-verification-audit.md (verification done)

#### 📦 Archive Bucket 10: Misc/Unclear

Move to `archive/new/md/misc/`:

- CLAUDE.md (what is this? Old AI chat log?)
- README.Docker.md (Docker setup? Is this used?)

---

## 📁 Final Structure

### Root Directory (After Cleanup):

```
/Users/sboag/gittt/tunetrees/
├── README.md                          # Main project readme
├── QUICKSTART.md                      # Quick setup (consolidated)
├── todo.md                            # Current tasks
└── .github/
    └── copilot-instructions.md        # Copilot config
```

### docs/ Directory (New - Consolidated Guides):

```
docs/
├── SETUP.md                           # Environment setup (consolidated)
├── DEPLOYMENT.md                      # Deployment guide (consolidated)
├── DATABASE_MIGRATION.md              # Migration guide (consolidated)
└── practice_flow.md                   # (already exists, keep)
```

### \_notes/ Directory (After Cleanup):

```
_notes/
├── solidjs-pwa-migration-plan.md                    # MASTER PLAN
├── PHASE_COMPLETION_LOG.md                          # Consolidated timeline (NEW)
├── context-transfer-practice-tab-next-phase.md      # Current work context
├── testing-infrastructure-complete.md               # Testing setup
├── test-users.md                                    # Test user specs
├── phase-10-postgresql-docker-testing-plan.md       # Future phase
├── phase-6-advanced-features-plan.md                # Current phase plan
├── tt_scratch_*.md                                  # User scratch files
└── markdown-cleanup-plan.md                         # This file!
```

### archive/new/md/ (Historical Artifacts):

```
archive/new/md/
├── bug-fixes/                         # 9 files
├── context-transfers/                 # 5 files
├── sessions/                          # 9 files
├── implementation-guides/             # 8 files
├── ux-fixes/                          # 2 files
├── schema-tools/                      # 5 files
├── old-plans/                         # 9 files
├── testing/                           # 5 files
├── operations/                        # 9 files
└── misc/                              # 2 files
```

**Total Archived:** ~63 files  
**Total Consolidated:** ~20 files → 3 new docs  
**Total Remaining:** ~10-12 active files

---

## 🎯 Execution Plan

### Step 1: Create Consolidated Docs (Manual Work)

1. Create `docs/SETUP.md` (merge 3 setup docs)
2. Create `docs/DEPLOYMENT.md` (merge 4 deployment docs)
3. Create `docs/DATABASE_MIGRATION.md` (merge 6 migration docs)
4. Create `_notes/PHASE_COMPLETION_LOG.md` (merge 19 completion summaries)

**Estimated Time:** 2-3 hours (extract key info, format chronologically)

### Step 2: Archive Old Docs (Scripted)

```bash
# Create archive structure
mkdir -p archive/new/md/{bug-fixes,context-transfers,sessions,implementation-guides,ux-fixes,schema-tools,old-plans,testing,operations,misc}

# Move files (use Git mv to preserve history)
git mv CACHED_DATA_IMMEDIATE_DISPLAY_FIX.md archive/new/md/bug-fixes/
git mv COLUMN_PERSISTENCE_FIX.md archive/new/md/bug-fixes/
# ... (repeat for all 63 files)

# Commit
git add -A
git commit -m "📦 chore: Archive 63 obsolete markdown docs"
```

**Estimated Time:** 30 minutes (scripted)

### Step 3: Update References

1. Search codebase for links to archived docs
2. Update any references in:
   - README.md
   - QUICKSTART.md
   - .github/copilot-instructions.md
   - \_notes/solidjs-pwa-migration-plan.md

**Estimated Time:** 30 minutes

### Step 4: Verify & Document

1. Run `find . -name "*.md" | wc -l` to confirm reduction
2. Update this plan with final counts
3. Add note to README.md about archive location

**Total Estimated Time:** 3-4 hours

---

## ✅ Success Criteria

- [ ] Root directory has ≤5 markdown files
- [ ] `_notes/` has ≤15 active files
- [ ] All obsolete docs archived to `archive/new/md/`
- [ ] 3-4 new consolidated guides created in `docs/`
- [ ] No broken links in active documentation
- [ ] Git history preserved (use `git mv`)
- [ ] Phase completion timeline in single chronological log

---

## 🚨 Files to Double-Check Before Archiving

**Maybe keep?** (User should decide)

- CLAUDE.md - What is this? Old conversation log?
- README.Docker.md - Is Docker setup still used?
- \_notes/phase-6-advanced-features-plan.md - Is ABC notation done? Archive or keep?
- \_notes/strategy.md - Any valuable insights here?

**Definitely keep:**

- docs/practice_flow.md (exempted by user)
- _notes/tt_scratch_\*.md (exempted by user)

---

## 📊 Impact Analysis

**Before:**

- Root: 27 .md files
- \_notes/: 73 .md files
- **Total: 100 files** 😱

**After:**

- Root: 4 .md files
- docs/: 4 .md files (3 new + 1 existing)
- \_notes/: 8-10 .md files
- archive/new/md/: 63 .md files (organized in 10 buckets)
- **Total Active: ~18 files** ✅
- **Total Archived: ~63 files** 📦

**Reduction: 82% fewer active docs!**

---

## 🔍 User Decisions

### Files Reviewed:

1. **TOOLBAR_IMPLEMENTATION_PLAN.md**

   - ✅ **KEEP** - Renamed to `practice-toolbar-implementation-plan.md`
   - **Reason:** This is the detailed implementation guide for the NEXT phase of work
   - **Note:** Has significant overlap with `context-transfer-practice-tab-next-phase.md` but provides more detailed legacy analysis and phased rollout plan
   - **Action:** Keep both, they serve complementary purposes (context transfer = quick reference, toolbar plan = detailed guide)

2. **CLAUDE.md**

   - ✅ **KEEP** - But acknowledge duplication with `copilot-instructions.md`
   - **Reason:** Claude-specific instruction file (may have Claude-specific patterns)
   - **Analysis:** 90% overlap with `.github/copilot-instructions.md` but has some unique sections (UI guidelines, Docker legacy info)
   - **Recommendation:** Consider consolidating AI instructions in future cleanup, but not critical now

3. **README.Docker.md**

   - ❌ **DELETE** - Docker setup no longer used
   - **Action:** Archive to `archive/new/md/misc/`

4. **phase-6-advanced-features-plan.md**

   - ❌ **ARCHIVE** - ABC notation complete, plan can be archived
   - **Action:** Move to `archive/new/md/old-plans/`

5. **strategy.md**
   - ❌ **ARCHIVE** - No valuable insights
   - **Action:** Move to `archive/new/md/misc/`

---

## 📁 Updated Final Structure

### \_notes/ Directory (After Cleanup):

```
_notes/
├── solidjs-pwa-migration-plan.md                    # MASTER PLAN
├── PHASE_COMPLETION_LOG.md                          # Consolidated timeline (NEW)
├── context-transfer-practice-tab-next-phase.md      # Current work - quick reference
├── practice-toolbar-implementation-plan.md          # Current work - detailed guide (RENAMED)
├── testing-infrastructure-complete.md               # Testing setup
├── test-users.md                                    # Test user specs
├── phase-10-postgresql-docker-testing-plan.md       # Future phase
├── tt_scratch_*.md                                  # User scratch files
└── markdown-cleanup-plan.md                         # This file!
```

### Root Directory (After Cleanup):

```
/Users/sboag/gittt/tunetrees/
├── README.md                          # Main project readme
├── QUICKSTART.md                      # Quick setup (consolidated)
├── CLAUDE.md                          # Claude instructions (keep for now, note duplication)
├── todo.md                            # Current tasks
└── .github/
    └── copilot-instructions.md        # Copilot config
```

**Note on AI Instructions:** CLAUDE.md and .github/copilot-instructions.md have ~90% overlap. Consider consolidating in future, but not blocking this cleanup.

---

## 🤔 Recommendations

### Option A: Aggressive Cleanup (Recommended) ⭐

Execute full plan as outlined above. Archive everything that's not actively referenced.

**Pros:**

- Clean, navigable documentation
- Easy to find current info
- Preserves history in archive
- **Updated file counts:** ~65 files archived, ~10-12 active

**Cons:**

- 3-4 hours of work
- Some docs might be harder to find

**User Notes Applied:**

- ✅ Keep TOOLBAR_IMPLEMENTATION_PLAN.md (renamed)
- ✅ Keep CLAUDE.md (acknowledge duplication)
- ✅ Delete README.Docker.md
- ✅ Archive phase-6-advanced-features-plan.md
- ✅ Archive strategy.md

### Option B: Minimal Cleanup

Just move obviously obsolete docs (bug fixes, old sessions) and leave plans/summaries.

**Pros:**

- Less work (1-2 hours)
- Keep more "just in case"

**Cons:**

- Still cluttered
- Hard to know what's current

### Option C: Two-Phase Cleanup

**Phase 1 (Now):** Archive bug fixes, sessions, context transfers (~30 files)  
**Phase 2 (Later):** Consolidate summaries and plans (~33 files)

**Pros:**

- Immediate clutter reduction
- Can do consolidation when you have more time

**Cons:**

- Still somewhat messy after Phase 1

---

## 🎬 Next Steps

**Recommended: Option A (Aggressive Cleanup)**

1. ✅ **Decisions made** - All "Double-Check" items resolved
2. ⏭️ **Generate scripts** - Create bash scripts to automate moves
3. ⏭️ **Rename file** - `TOOLBAR_IMPLEMENTATION_PLAN.md` → `practice-toolbar-implementation-plan.md`
4. ⏭️ **Create consolidated docs** - Skeleton files with TODOs
5. ⏭️ **Execute cleanup** - Run scripts, review results, commit

**Estimated total time:** 3-4 hours

---

**Ready to proceed?** Say "yes" and I'll generate:

1. Bash script to archive 65+ files
2. Bash script to rename toolbar plan
3. Skeleton consolidated docs (SETUP.md, DEPLOYMENT.md, etc.)
4. Git commit message template
