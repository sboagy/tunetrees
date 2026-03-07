# Plan: Queue Sync Fix #427 — Tests-First, Simplified Index.tsx, CI Deploy

**Branch**: `fix-practice-queue-sync-3`
**Issue**: #427 — practice queue not consistent across devices
**Previous PR #436** merged but made things worse.

---

## Problem Summary

When I went to test the last PR for issue #427, it would start me with a week-old queue date (I don't know where it got it from) that didn't match today's date. Setting the data in the queue date menu to "today" seemed to do nothing.  If I pressed the button on the rollover banner it did seem to refresh the queue to today.  Then, on the android device, sometimes it exhibited the behavior I just described (old queue date), and sometimes it wouldn't replicated at all.  In general, the behavior was inconsistent, not reliably reproducible, and generally incoherent.

## Expected Behavior

1. The practice tab (grid, etc.) has to first make sure the `daily_practice_queue` table is up-to-date (meaning fully synced with the remote state), as well as the `repertoire` and `practice_record` tables that the queue depends on.  There may be other tables as well that need to be synced first.
2. There should be a logical current date for the queue.  All logic should be based on that date.  I think the date is local to the browser session, i.e. it can change per browser, and the current queue data should be stored in local storage.  But, the logic for that date control should not be mixed into the logic in src/routes/practice/Index.tsx!  In other words, the date control logic should be self-contained and not leak into the rest of the practice tab logic, and src/routes/practice/Index.tsx should only consume a queue date argument.
3. The practice tab logic (src/routes/practice/Index.tsx, src/components/grids/TunesGridScheduled.tsx) should then check if the specified queue is all complete.  IF, and ONLY IF all the tunes in the queue are complete, AND the date has progressed to TODAY, AND the queue date is not manual, it should automatically create a new practice queue.
4. If the current (latest) queue is NOT complete, AND the date has changed, AND the date is NOT manual, it should present the rollover banner.
5. If the rollover banner is up, and user clicks the rollover banner button, it should create a new practice queue for today, and update the date control to be today's date, and set the queue date to not-manual.
6. If the user manually changes the date to today, it should set the queue date to today, make sure the manual flag is cleared, and proceed to step 3.
7. Periodic sync should make sure to signal the practice tab (grid, etc.) when the `daily_practice_queue` or anything else that my affect the grid or banner condition has changed.  
8.  The practice tab (grid, etc.) must be responsive to any new changes, and update its UI per steps 2 and 3.


## State Machine (complete — all cells covered)

| isManual | Queue exists? | Complete? | Queue date = today? | Outcome |
|----------|--------------|-----------|---------------------|---------|
| false | no | n/a | n/a | Create queue for today → proceed as "false/yes/no/yes" |
| false | yes | **yes** | **yes** | **Rule 3**: auto-create new queue for today, set date = today |
| false | yes | **yes** | no (future/past) | Show queue as-is, no action |
| false | yes | **no** | **yes** | Queue incomplete but it's today — show queue, no banner |
| false | yes | **no** | **no** | **Rule 4**: show rollover banner |
| **true** | yes | any | any | Stay on manually-selected queue, **no banner, no auto-advance** (Q1) |
| **true** | yes | any | = today | On init, auto-clear manual flag → re-evaluate as `isManual=false` (Q5 special case) |

Banner dismiss / rollover button (Rule 5): `clearManualAndSetToday()` → create today's queue → no more banner.

User picks today explicitly (Rule 6): `setManualDate(today)` → detects "date = today" → calls `clearManualAndSetToday()` instead of setting manual.

---

## Rule 1 Enforcement (sync ordering)

**Where is "wait for sync before evaluating the queue" enforced?**

In `src/lib/auth/AuthContext.tsx` line 820, `setInitialSyncComplete(true)` is called **after a full sync run completes** — after `reconcileCatalogSelection` returns, which itself runs after the sync engine has pulled all tables. It is NOT set early before sync.

The composable gates on `initialSyncComplete()` (all tables including `daily_practice_queue` have been pulled at least once) AND on `remoteSyncDownCompletionVersion` (re-evaluates after every subsequent sync pull). This satisfies Rule 1 for the normal online case.

**Known limitation**: `initialSyncComplete` is a single global flag — it doesn't provide table-level ordering guarantees within a single sync pass. In practice this isn't a problem because the sync engine processes all tables in one batch before setting the flag. But if the sync architecture ever changes to per-table completion signals, the composable's source memo should be updated correspondingly.

---

## Root Cause Summary

`Index.tsx` has a 5-priority localStorage-first queue date resolver that, on a new/wiped device, falls back to `getPracticeDate()` (today) BEFORE checking the DB. If a remote-synced queue exists for a different window, the app still initializes a NEW queue for today's date. The `TT_PRACTICE_QUEUE_DATE_MANUAL` flag triggers an early return in `resolvedQueueDate` that BYPASSES the DB check entirely, regardless of what sync delivered.

---

## Phase 1: New E2E Tests (write first — must FAIL before the fix)

### Determinism analysis

After reading the actual resolver code (`Index.tsx` lines 362–527), the picture is:

- `queueInitialized` already gates on `resolvedQueueDate.loading` — so there is **no race for the non-manual path** in the current code. The resolver queries the DB first, and `ensureDailyQueue` only fires once that resolves.
- **The deterministic bug is the manual-flag early return** at fetcher lines 407–414: when `TT_PRACTICE_QUEUE_DATE_MANUAL=true` AND a stored date exists, the fetcher returns without ever calling `getLatestActiveQueueWindow`. This is the root cause of the "week-old date" symptom.
- Tests that target the `manual=true` bypass will **fail deterministically** with the current code.
- Tests that wipe localStorage (non-manual path) may **pass** with the current code because the non-manual path already queries the DB. Those tests are still valuable as regression guards, but they should be labeled as such — they won't demonstrate a failure-first workflow.
- `sync-003` (fresh device full wipe) is **inherently timing-dependent**: it requires IndexedDB+localStorage to be wiped, sync to complete, AND `daily_practice_queue` rows to arrive before the composable queries. This test will be written but should use generous timeouts; its primary value is post-fix verification.

Conclusion: **`sync-004` is the one true deterministic-fail test.** `sync-001`/`sync-002`/`sync-003` are primarily regression guards that should pass both before and after — unless we discover additional concrete failures during implementation. We should still write all four, but be clear-eyed that only `sync-004` should fail before the fix.

### Tests requiring review/update after the fix

`e2e/tests/practice-005-date-rollover-banner.spec.ts` directly reads `TT_PRACTICE_QUEUE_DATE` and `TT_PRACTICE_QUEUE_DATE_MANUAL` from localStorage in several assertions (e.g. `expect(reloadedStorage.manualFlag).toBe("false")`). These keys are still used after the fix (they move to the composable, not deleted), so most assertions in practice-005 remain valid. However:
- The **timing** of when the keys are written may change (composable writes on resource completion, not in a cascading effect)
- The `"should refresh queue and hide banner when Refresh Now is pressed"` test asserts `refreshedStorage.manualFlag === "false"` — this should still hold
- The `"should auto-refresh completed queue without showing banner"` test asserts same — should still hold
- All tests in practice-005 need a **read-through pass** before merging the fix to catch any timing-sensitive assertions

Other tests to review: any test that presets `TT_PRACTICE_QUEUE_DATE` or `TT_PRACTICE_QUEUE_DATE_MANUAL` via `page.evaluate` (e.g. in helpers or setup) must verify those keys still have the same behavior under the composable.

### New test files

#### `e2e/tests/sync-001-queue-stable-on-reload.spec.ts`
- Setup: seed repertoire (3+ tunes), navigate to `/practice`, queue is created
- Action: reload page 3 times (`page.reload()` + wait for practice grid)
- Assert (DB): `__ttTestApi.getQueueInfo(repertoireId).rowCount` is the same count each time — no new rows duplicated
- Assert (UI): practice grid row count equals `rowCount` on each reload
- Classification: **regression guard** (may pass before fix); confirms idempotency of `ensureDailyQueue`

#### `e2e/tests/sync-002-queue-date-from-db-not-localstorage.spec.ts`
- Setup: seed repertoire, navigate to practice, record DB window via `getQueueInfo()`
- Action: `localStorage.removeItem('TT_PRACTICE_QUEUE_DATE'); localStorage.removeItem('TT_PRACTICE_QUEUE_DATE_MANUAL')` via `page.evaluate`
- Action: reload page, wait for practice grid
- Assert (DB): `getQueueInfo(repertoireId).windowStartUtc` matches pre-wipe window; `rowCount` unchanged
- Assert (UI): practice grid still shows same tunes
- Classification: **regression guard** (expected to pass before fix for non-manual path)

#### `e2e/tests/sync-003-fresh-device-uses-synced-queue.spec.ts`
- Setup: seed repertoire via Supabase API (direct, not browser), including a `daily_practice_queue` row with yesterday's date
- Action: wipe IndexedDB + localStorage via `clearTunetreesStorageDB()` or equivalent
- Action: reload page, wait for practice grid with generous timeout (≥20s for sync)
- Assert (DB): `getQueueInfo(repertoireId).windowStartUtc` matches the seeded queue's window date (NOT today)
- Assert (UI): practice grid shows the seeded tunes
- Note: inherently depends on sync timing; use `page.waitForFunction(() => window.__ttTestApi?.isSyncComplete?.(), { timeout: 20000 })` or poll `getQueueInfo` until `windowStartUtc` is non-empty
- Classification: **timing-dependent regression guard**

#### `e2e/tests/sync-004-manual-localstorage-date-ignored.spec.ts`
- Setup: seed repertoire + today's queue (so DB has a valid queue for today)
- Setup: `page.addInitScript` to set `TT_PRACTICE_QUEUE_DATE = threeDaysAgo.toISOString()` AND `TT_PRACTICE_QUEUE_DATE_MANUAL = 'true'` BEFORE page load
- Navigate to `/practice`, wait for practice grid
- Assert (DB): `getQueueInfo(repertoireId).windowStartUtc` date portion matches today, NOT three-days-ago
- Assert (UI): practice grid shows today's tunes (not the stale queue's tunes; if no tunes found for stale date, grid is empty which also demonstrates the bug)
- Classification: **DETERMINISTIC FAIL before fix** — the manual-flag early return in the current resolver bypasses the DB entirely

### New `__ttTestApi` method (`src/test/test-api.ts`)

Add `getQueueInfo(repertoireId: string) → { windowStartUtc: string; rowCount: number; completedCount: number }`:
```ts
async function getQueueInfo(repertoireId: string) {
  const db = await ensureDb();
  const userRef = await resolveUserId(db);
  // Get the latest active window and its counts
  const rows = await db.all<{ windowStartUtc: string; rowCount: number; completedCount: number }>(sql`
    SELECT
      substr(replace(window_start_utc, 'T', ' '), 1, 19) as windowStartUtc,
      COUNT(*) as rowCount,
      COUNT(completed_at) as completedCount
    FROM daily_practice_queue
    WHERE user_ref = ${userRef}
      AND repertoire_ref = ${repertoireId}
      AND active = 1
    GROUP BY substr(replace(window_start_utc, 'T', ' '), 1, 19)
    ORDER BY windowStartUtc DESC
    LIMIT 1
  `);
  return rows[0] ?? { windowStartUtc: '', rowCount: 0, completedCount: 0 };
}
```

Register it on `window.__ttTestApi` in the existing attachment block.
Add type declaration in the `__ttTestApi` interface.

---

## Phase 2: Index.tsx Rewrite + New Composable

### New file: `src/routes/practice/usePracticeQueueDate.ts`

This composable owns all queue-date state and logic. `Index.tsx` becomes a pure consumer.

**Public interface:**
```ts
export interface PracticeQueueDateState {
  queueDate: Accessor<Date>;       // current queue date (reactive)
  isManual: Accessor<boolean>;     // whether user locked the date manually (reactive)
  queueReady: Resource<true>;      // resource: loading = resolving + ensureDailyQueue; () = true when done
  setManualDate: (date: Date) => void;     // user picks a specific date (sets isManual=true, unless it's today)
  clearManualAndSetToday: () => void;      // banner button OR user picks today → clears manual, sets today
}
```

**What the composable handles internally:**
1. localStorage keys `TT_PRACTICE_QUEUE_DATE` and `TT_PRACTICE_QUEUE_DATE_MANUAL` — reads on init, writes on mutation
2. DB resolution via `getLatestActiveQueueWindow(db, userId, repertoireId)` → `MAX(windowStartUtc)` always wins
3. Manual flag awareness: if `isManual=true`, skip DB resolution and use stored date directly
4. Special-case init: if `isManual=true` AND stored date equals today's local calendar date → auto-clear manual (no point locking to today)
5. Call `ensureDailyQueue(db, userId, repertoireId, resolvedDate)` idempotently after resolution
6. Re-runs when `remoteSyncDownCompletionVersion` changes (background sync may bring newer queue rows)

**Source memo for the resource** (drives re-evaluation):
```ts
// Fires on: prereqs ready, sync version bumps, remoteSyncReady transitions
const prereqs = () => {
  const db = localDb();
  const uid = userId();
  const rid = currentRepertoireId();
  const syncReady = initialSyncComplete();
  const syncVersion = remoteSyncDownCompletionVersion();
  return db && uid && rid && syncReady
    ? { db, userId: uid, repertoireId: rid, syncVersion }
    : null;
};
```

**Resolution logic (inside the resource fetcher):**
```
IF isManual() AND stored date ≠ today:
  → keep stored queueDate, skip DB query
  → call ensureDailyQueue(storedDate)
  → return true

IF isManual() AND stored date = today:
  → auto-clear isManual (stored date is today, manual lock is pointless)
  → fall through to auto-resolution

AUTO-RESOLUTION:
  → call getLatestActiveQueueWindow()
  → if result has windowStartUtc → use MAX(windowStartUtc) as resolved date
  → if no result → use getPracticeDate() (today)
  → setQueueDate(resolved)
  → persist resolved date to localStorage (NOT as manual)
  → call ensureDailyQueue(resolved)
  → return true
```

**`setManualDate(date)`** mutation:
```
dateAtNoon = date normalized to noon local time
IF dateAtNoon local date = today's local date:
  → clearManualAndSetToday() (Rule 6: picking today clears manual)
ELSE:
  → setQueueDate(dateAtNoon)
  → setIsManual(true)
  → persist both to localStorage
```

**`clearManualAndSetToday()`** mutation:
```
→ setIsManual(false)
→ setQueueDate(getPracticeDate())
→ persist to localStorage (isManual=false, date=today)
```

### Moved out of Index.tsx — now owned by composable

The localStorage keys `TT_PRACTICE_QUEUE_DATE` and `TT_PRACTICE_QUEUE_DATE_MANUAL` are **NOT deleted** — they are **moved** to `usePracticeQueueDate.ts`. The composable is the sole reader and writer of these keys. `Index.tsx` no longer touches them at all.

The following are removed from `Index.tsx` (everything that was directly handling queue-date localStorage in the component):

- `TT_PRACTICE_QUEUE_DATE` and `TT_PRACTICE_QUEUE_DATE_MANUAL` constant definitions, all `localStorage.getItem/setItem` calls referencing them
- `[isManualQueueDate, setIsManualQueueDate]` signal
- `[queueDateLockedByUser, setQueueDateLockedByUser]` signal
- `[initialPracticeDate, setInitialPracticeDate]` signal
- `queueDateScopeKey` mutable ref
- `parseQueueDateString()`, `getStoredQueueDate()`, `getStoredManualQueueDateFlag()` helpers
- `resolvedQueueDate` createResource (5-priority async resolver) + its entire async body
- `type QueueDateResolution`
- All `createEffect` blocks that react to `resolvedQueueDate` (~lines 461–540)

### What Index.tsx does instead (~10 lines replacing ~220)

```ts
// Queue date: owned by composable (DB-first, isManual-aware, sync-reactive)
const { queueDate, isManual, queueReady, setManualDate, clearManualAndSetToday } =
  usePracticeQueueDate({ localDb, userId, currentRepertoireId, initialSyncComplete, remoteSyncDownCompletionVersion });

// Banner condition: computed here because it needs practiceListData
const showRolloverBanner = createMemo(() => {
  if (!queueReady()) return false;                  // not ready yet
  if (isManual()) return false;                     // Q1: manual = user in control, no banner
  const today = toLocalDateString(getPracticeDate());
  const queueDay = toLocalDateString(queueDate());
  const dateChanged = queueDay !== today;
  return dateChanged && !isQueueCompleted();        // Rule 4
});

// Auto-advance: also here because it needs isQueueCompleted + queueReady
createEffect(() => {
  if (!queueReady() || isManual()) return;          // Q1: skip when manual
  if (!isQueueCompleted()) return;                  // Rule 3: only when complete
  const today = toLocalDateString(getPracticeDate());
  const queueDay = toLocalDateString(queueDate());
  if (today > queueDay) {                           // Rule 3: date progressed to today
    clearManualAndSetToday();
    incrementPracticeListStagedChanged();
  }
});
```

### Simplified handlers in Index.tsx

**`handleQueueDateChange(date: Date, isPreview: boolean)`**:
- Calls `setManualDate(date)` (composable handles today-special-case per Rule 6)
- Calls `incrementPracticeListStagedChanged()`
- Shows appropriate toast

**`handlePracticeDateRefresh()`** (rollover banner button — Rule 5):
- Calls `clearManualAndSetToday()`
- Calls `ensureDailyQueue` for today
- Calls `incrementPracticeListStagedChanged()`

**`handleDateRolloverDetection()`**: removed — merged into the `showRolloverBanner` memo and `queueReady` effect above.

### What is NOT changed in Index.tsx
- All evaluation/staging/goal logic (`handleRecallEvalChange`, `handleGoalChange`)
- `handleSubmitEvaluations`, `handleAddTunes`, `handleQueueReset` — unchanged
- Flashcard mode + field visibility (localStorage use here is fine — UI preference)
- `practiceListData` resource — gated on `queueReady() === true && !queueReady.loading`
- `showSubmitted`, `evaluations`, `evaluationsCount`, `filteredPracticeList`, `practiceListLoading`, `practiceListError` — unchanged
- Repertoires, goals resources — unchanged  
- `isPracticeGateOpen`, `practiceGateState`, all gate logic — unchanged
- JSX / render return — unchanged

---

## Phase 3: CI + Cloudflare Deploy

### `.github/workflows/ci.yml` changes

**Change 1** — add to `on.push.branches`:
```yaml
on:
  push:
    branches: [main, fix/is354_sync_errors, fix-practice-queue-sync-3]
  pull_request:
    branches: [main]
```

**Change 2** — update `deploy` job `if` condition:
```yaml
if: github.event_name == 'push' && (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/fix/is354_sync_errors' || github.ref == 'refs/heads/fix-practice-queue-sync-3')
```

**Change 3** — same update for `deploy-worker` job `if` condition.

### Cloudflare Pages dashboard (manual steps for you)

The `wrangler pages deploy` command already passes `--branch=${{ github.ref_name }}` which will be `fix-practice-queue-sync-3`. By default Cloudflare serves the *production branch* at `tunetrees-pwa.pages.dev`. You need to point that to your new branch:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → `tunetrees-pwa`
2. **Settings** → **Builds & Deployments** → **Production branch**
3. Change from `main` → `fix-practice-queue-sync-3`
4. Click **Save**
5. On the next CI push to `fix-practice-queue-sync-3`, the deployment will serve at the production URL
6. **After issue #427 is resolved** and the fix is merged to `main`: revert Production branch back to `main` in Cloudflare, and remove `fix-practice-queue-sync-3` from `ci.yml`

---

## Resolved Clarifying Questions

**Q1 — `manual=true` + date has advanced:**
User stays on the manually-selected queue indefinitely. No banner, no auto-advance. The user is fully in control until they explicitly navigate away or change the date. This is a valid — if uncovered — cell in the state machine.

**Q2 — "Date has progressed to today":**
Comparison uses the browser's local calendar date (not UTC). The rollover/auto-advance decision is a local per-device determination. `getPracticeDate()` already encapsulates this.

**Q3 — Cross-device initial resolution:**
`MAX(windowStartUtc)` wins — the most recent queue is always used, regardless of completion status. Example: incomplete queue from 3 days ago vs. complete queue from yesterday → use yesterday's complete queue. This is also why we must guard `ensureDailyQueue` carefully — never create a new queue when a synced queue already exists for the same or later date.

**Q4 — Architecture of "self-contained date logic":**
Extract into a SolidJS composable: `src/routes/practice/usePracticeQueueDate.ts`. The composable owns all queue-date state (signals, localStorage persistence) and the DB resolution logic. `Index.tsx` calls the composable and only consumes `{ queueDate, isManual, queueReady, setManualDate, clearManualAndSetToday }`. The route file handles environment mechanics (gate, eval, submit, add tunes); the composable is the pure queue-date controller. See Phase 2 for the detailed design.

**Q5 — `isManual` persists across reloads:**
Yes, stored in localStorage. On reload, the composable reads back both the stored date AND the manual flag. Special case: if `isManual=true` AND stored date equals today's local date, the manual flag is automatically cleared on init (no point locking to today — it's already today).

**Q6 — Background sync triggers re-evaluation:**
Yes. Changes to `remoteSyncDownCompletionVersion` must trigger re-evaluation of the queue date (which queue is the latest active?) and consequently the banner condition. The composable's resource source memo includes `remoteSyncDownCompletionVersion` so it re-runs on every sync pull — just like the current `resolvedQueueDate` resource does.

---

## Verification Sequence

1. Write `sync-001` through `sync-004` + `getQueueInfo` — run them → **all should FAIL**
2. Apply Index.tsx rewrite
3. Run `sync-001` through `sync-004` → **all should PASS**
4. Run `scheduling-001` through `scheduling-009` + `practice-005-date-rollover-banner` → **all must still PASS**
5. Push to `fix-practice-queue-sync-3` → CI runs → deploy to Cloudflare production
6. Manual test on Android: sign in fresh (clear site data) → verify queue matches desktop queue

---

## Relevant Files

| File | Change |
|------|--------|
| `src/routes/practice/usePracticeQueueDate.ts` | **New** — composable that owns all queue-date state + DB resolution + localStorage |
| `src/routes/practice/Index.tsx` | Rewrite queue date section (~220 lines → ~10 lines); call composable; simplified handlers |
| `src/test/test-api.ts` | Add `getQueueInfo()` method + type |
| `e2e/tests/sync-001-queue-stable-on-reload.spec.ts` | New |
| `e2e/tests/sync-002-queue-date-from-db-not-localstorage.spec.ts` | New |
| `e2e/tests/sync-003-fresh-device-uses-synced-queue.spec.ts` | New |
| `e2e/tests/sync-004-manual-localstorage-date-ignored.spec.ts` | New |
| `e2e/helpers/practice-scenarios.ts` | Possibly add `setupForQueueSyncTests()` helper |
| `.github/workflows/ci.yml` | 3 targeted changes |
