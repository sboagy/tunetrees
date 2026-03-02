# PR #426 — Goal-Based Scheduling: Context Transfer

## Branch / Repo

- **Worktree:** iss-426-user-goals
- **Branch:** `iss-426-user-goals`
- **Base:** `main` (commit `5fc16a7e`)
- **Two commits ahead of main** — both committed and pushed to `origin/iss-426-user-goals`
- **Working tree is clean** (no uncommitted changes)

---

## What This PR Does

Adds a **goal** concept to TuneTrees. Each tune in a repertoire can be assigned a named practice objective (e.g. "recall", "sight read", "technique"). The goal is stored on `repertoire_tune.goal`, displayed as an inline `GoalBadge` dropdown in the grid, and passed through to the FSRS scheduler and `practice_record` on commit.

---

## Committed Changes

### Commit 1: `feat(#426): add goal-based scheduling`

| Area | Detail |
|---|---|
| **Supabase migration** | 20260226000000_create_goal_table.sql — creates `goal` table with system goals (null `private_for`) and user-private goals |
| **SQLite migration** | 0013_add_goal_table.sql — local equivalent, no PRAGMA statements |
| **Schema version** | migration-version.ts → `"2.0.5-add-goal-table"` |
| **`GoalBadge` component** | GoalBadge.tsx — inline combobox in the grid row for picking a goal |
| **`UserSettingsDialog`** | UserSettingsDialog.tsx — overlay dialog replacing route-based settings nav |
| **`UserSettingsDialogContext`** | UserSettingsDialogContext.tsx — open/close state |
| **Goals settings page** | goals.tsx — full CRUD for managing goals |
| **Grid columns** | TuneColumns.tsx — goal column using `GoalBadge`, `onGoalChange` callback |
| **Grid types** | types.ts — `onGoalChange` added to `ICellCallbacks` |
| **Grid wrappers** | TunesGridRepertoire.tsx, TunesGridScheduled.tsx — pass `onGoalChange` through to columns |
| **Queries** | user-settings.ts — `getGoals()`, `upsertGoal()`, `deleteGoal()` |
| **Practice recording** | practice-recording.ts — goal passed into `practice_record` on commit |
| **FSRS service** | fsrs-service.ts — goal-aware hooks |
| **Practice route** | Index.tsx — `handleGoalChange`, passes goals to `TunesGridScheduled` |
| **Repertoire route** | repertoire.tsx — `handleGoalChange`, passes goals to `TunesGridRepertoire` |
| **Codegen / sync** | oosync.codegen.config.json — `goal` table added with `changeCategory: "user"` and push/pull rules |
| **Regenerated artifacts** | table-meta.ts, table-meta.generated.ts, schema-postgres.generated.ts, worker-config.generated.ts |
| **Nav / App** | TopNav.tsx, App.tsx — wire up `UserSettingsDialog` |

### Commit 2: `fix(e2e): update settings locators and fix mobile sidebar flow`

E2E fixes needed because `UserSettingsDialog` uses `<button>` elements for tab nav (not `<a>` links):

- TuneTreesPage.ts — 5 locators changed from `getByRole("link")` to `getByTestId("settings-tab-*")`
- usersettings-001-forms.spec.ts — updated to dialog model
- Various other specs — removed `page.mouse.click` backdrop-close patterns; fixed PRAGMA foreign_keys leak from SQLite migration; fixed mobile sidebar stability issues

**All E2E tests pass clean on this branch.**

---

## The Unsolved Problem: Goal Change Refreshes the Entire Grid

### Symptom

When the user picks a new goal from the `GoalBadge` dropdown, the entire grid flashes/resets. Scroll position is lost. Row selection is lost. The bug is reproducible and consistent.

### Root Cause (confirmed)

The data flow after a goal change is:

```
GoalBadge → onGoalChange → handleGoalChange (route)
  → db.update(repertoireTune).set({ goal }) [SQLite write]
  → outbox trigger fires [SQLite trigger on repertoire_tune write]
  → sync engine flushes outbox to Supabase
  → AuthContext sync callback fires (AuthContext.tsx ~line 841):

      for (const table of result.affectedTables) {
        const meta = TABLE_REGISTRY[table];
        if (meta?.changeCategory) categories.add(meta.changeCategory);
      }
      if (categories.has("repertoire")) {
        incrementRepertoireListChanged();   // ← THIS fires
      }

  → repertoire_tune has changeCategory: "repertoire" in TABLE_REGISTRY
  → incrementRepertoireListChanged() increments a reactive signal
  → that signal is tracked by createResource in both:
      (a) repertoire.tsx outer `repertoireTunes` resource
      (b) TunesGridRepertoire.tsx inner `repertoireTunesData` resource
  → both resources refetch
  → repertoire.tsx has <Switch><Match when={repertoireTunes.loading}>
      which unmounts <TunesGridRepertoire> while loading
  → full grid remount: scroll lost, selection lost
```

The immediate `handleGoalChange` also called `incrementRepertoireListChanged()` explicitly, but even without that, **the sync callback always fires it** after every outbox flush — that is the persistent trigger.

### What Was Attempted (all reverted)

**Attempt 1 — Remove explicit increment calls from `handleGoalChange`**
- Removed `incrementRepertoireListChanged()` from `repertoire.tsx handleGoalChange`
- Removed `incrementPracticeListStagedChanged()` from `pIndex.tsx handleGoalChange`
- Added `goalOverrides` optimistic signal in `TunesGridRepertoire` and `TunesGridScheduled` to update the badge locally
- **Result:** Badge updated instantly locally, but grid still reset ~1 second later when the sync engine's own callback fired `incrementRepertoireListChanged()`. Optimistic approach doesn't survive the sync-triggered refetch.

**Attempt 2 — `resource.latest` in inner grid (`TunesGridRepertoire`)**
- Changed `tunes` memo to use `repertoireTunesData.latest ?? []`
- Changed loading `<Show>` to only fire when `latest == null` (first load only)
- **Result:** Inner grid stayed mounted during its own resource refetch, but the outer repertoire.tsx `<Switch><Match when={repertoireTunes.loading}>` still unmounted `<TunesGridRepertoire>` when the *outer* resource refetched.

**Attempt 3 — `resource.latest` propagated to outer route layer too**
- repertoire.tsx: `<Match when={repertoireTunes.loading && repertoireTunes.latest == null}>` — initial load only
- Used `.latest` in `availableTypes/Modes/Genres` memos and `repertoireIsEmpty`
- Index.tsx: `practiceListLoading` only true when `latest == null`; `filteredPracticeList` uses `.latest`
- **Result:** User confirmed the reset still happened, "just more slowly." The grid no longer fully unmounts, but TanStack Table still receives a new `data` array reference and re-renders all rows visibly.

**Attempt 4 — Change `repertoire_tune` `changeCategory` to `null` in codegen config**
- oosync.codegen.config.json: `"repertoire_tune": "repertoire"` → `"repertoire_tune": null`
- Ran `npm run codegen:schema` — regenerated table-meta.ts and table-meta.generated.ts
- Updated table-meta.test.ts count 21 → 22 (the `goal` table was also new)
- **Reasoning:** With `changeCategory: null`, the sync callback ignores `repertoire_tune` flush results, so `incrementRepertoireListChanged()` never fires from sync when a goal is saved. All other `repertoire_tune` consumer handlers (add/remove tune from repertoire, mark learned, etc.) call `incrementRepertoireListChanged()` **explicitly** in their own handlers — so the auto-signal from sync is redundant for them. Goal change does not need a repertoire refresh at all.
- **User action:** Undid all 4 file changes before the approach could be tested in the browser. **This was never verified.**

---

## Recommended Fix Going Forward

**Option A — Clean minimal fix (Attempt 4, done properly):**

1. oosync.codegen.config.json: change `"repertoire_tune": "repertoire"` → `"repertoire_tune": null`
2. Run `npm run codegen:schema`
3. table-meta.test.ts: update expected table count 21 → 22
4. Verify in browser that:
   - Goal change no longer triggers grid reset
   - Adding/removing tunes from repertoire still refreshes the grid (those handlers call `incrementRepertoireListChanged()` explicitly — confirm they do)
   - Sync down of `repertoire_tune` changes from another device still shows up (the sync pull still works; only the *signal firing* is suppressed; the data still arrives in SQLite)

The risk: after a pull sync that changes `repertoire_tune` rows from another device (e.g. tune added on mobile), the grid won't auto-refresh until the next explicit action. Mitigations: (a) accept it as a minor edge case for now, (b) add a separate `"repertoire_tune_structural"` change category only fired for structural changes (add/remove), not for field updates like `goal`.

**Option B — Finer-grained change category (longer term):**
Split `repertoire_tune` writes into two categories: structural (add/remove row, mark learned) vs. field updates (goal, scheduled). Only structural writes fire `incrementRepertoireListChanged()`. Requires changes to either the outbox trigger system or the sync callback to distinguish write types.