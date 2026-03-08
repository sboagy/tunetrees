# Plan: Clean Up and Simplify Practice Queue Mechanism

**Issue**: #381 — ♻️ Clean up and simplify practice queue mechanism (and make more declarative)
**Branch**: `copilot/clean-up-practice-queue`
**PR**: #448 — Declarative practice queue state machine refactoring
**Constraint**: Must not change features or E2E tests in any way.

---

## Current State Analysis

### Files Involved (4,080 lines total)

| File | Lines | Role |
|------|-------|------|
| `src/routes/practice.tsx` | 1,079 | Main practice page — contains state machine, handlers, rendering |
| `src/routes/practice/usePracticeQueueDate.ts` | 349 | Queue date resolution composable (DB-first, localStorage persistence) |
| `src/components/practice/DateRolloverBanner.tsx` | 161 | Banner with internal polling, state, and `onDateChange` callback |
| `src/lib/services/practice-queue.ts` | 1,280 | Queue generation, bucket classification, DB operations |
| `src/lib/db/queries/practice.ts` | 1,015 | Practice list queries (joins view + queue) |
| `src/lib/utils/practice-date.ts` | 196 | Date utilities (getPracticeDate, hasPracticeDateChanged, formatAsWindowStart) |

### Core Problems

1. **State machine is spread across 4 locations** (identified in issue):
   - `handleDateRolloverDetection` (practice.tsx:884–895) — imperative callback
   - `handlePracticeDateRefresh` (practice.tsx:786–882) — re-derives conditions with async IO
   - `usePracticeQueueDate.ts` — evaluates 2 conditions eagerly at DB-read time
   - `DateRolloverBanner.tsx` — internal polling loop + `showBanner` signal (leaks app state into UI)

2. **practice.tsx is too large** (1,079 lines) with too many responsibilities:
   - Queue date management
   - Rollover detection and auto-advance
   - Evaluation staging/clearing
   - Submit workflow
   - Goal changes
   - Queue reset
   - Add tunes
   - Flashcard mode/visibility persistence
   - Grid data fetching and filtering
   - Repertoire management
   - AI chat drawer

3. **DateRolloverBanner has internal state that should be application state**:
   - `showBanner` signal managed internally
   - `setInterval` polling loop
   - `onDateChange` callback pattern bridges UI→application state imperatively

4. **Duplicate condition derivation**:
   - `handlePracticeDateRefresh` re-queries `getLatestActiveQueueWindow` and re-derives `dateChanged`, `shouldCreateTodayQueue`
   - `usePracticeQueueDate` derives similar conditions (stale flag, DB rows, today comparison)
   - `handleDateRolloverDetection` checks `isManual()` and `isQueueCompleted()` again

5. **getPracticeList has excessive debug logging** (practice.ts:194–311):
   - 6+ debug queries/logs on every practice list fetch
   - Should be removed or gated behind a debug flag

6. **Scheduling-window logic exists in two service modules**:
  - `src/lib/services/practice-queue.ts` contains the active four-bucket windowing helpers used by the current queue flow
  - `src/lib/services/queue-generator.ts` still contains an older copy of `computeSchedulingWindows` / `classifyQueueBucket`
  - These implementations are not identical, so any extraction must reconcile semantics before calling the move “low risk”

### Circular Dependencies (Status: Safe but Fragile)

The reported circular dependencies are currently safe (type-only imports in reverse direction):
- `client-sqlite.ts` ↔ `init-view-column-meta.ts` / `init-views.ts` (type-only reverse)
- `practice.ts` → `practice-queue.ts` (type-only in one direction)

However, the `computeSchedulingWindows` import from `practice.ts → practice-queue.ts` tightly couples the query layer to the service layer.

---

## Refactoring Plan

### Phase 1: Create Unified Rollover State Machine (`useRolloverStateMachine`)

**Goal**: Consolidate all 4 state machine locations into a single declarative composable.

**Guardrail**: The composable must preserve the existing `queueReady()` / `queueReady.loading` gate used by `practiceListData`. No rollover banner or auto-advance effect should fire until queue initialization has fully resolved.

**New file**: `src/routes/practice/useRolloverStateMachine.ts`

```ts
// Inputs (all reactive signals):
//   wallClockDate: Accessor<Date>       — polled wall-clock date
//   queueDate: Accessor<Date>           — current queue window date
//   isManual: Accessor<boolean>          — user locked the date manually
//   isQueueCompleted: Accessor<boolean>  — all queue rows have completed_at
//   queueReady: Resource<true>           — queue has been resolved from DB

// Outputs (all reactive):
//   rolloverStatus: {
//     ready: boolean                 — queue initialization finished
//     showBanner: boolean            — date changed, queue incomplete, not manual
//     shouldAutoAdvance: boolean     — date changed, queue complete, not manual
//     shouldClearManual: boolean     — manual flag set but stored date = today
//     dateChanged: boolean           — wall clock date ≠ queue date
//   }
```

**Implementation**:

```ts
export function useRolloverStateMachine(props: RolloverInputs): RolloverOutputs {
  // Single wall-clock polling signal (replaces DateRolloverBanner's internal interval)
  // isSameDay compares local YYYY-MM-DD (reuse toLocalDateString from usePracticeQueueDate)
  const [wallClockDate, setWallClockDate] = createSignal(getPracticeDate(), {
    equals: (a, b) => isSameDay(a, b),
  });

  // Configurable polling interval (test override supported).
  // getRolloverIntervalMs(): returns 60000 in production, but checks
  // window.__TUNETREES_TEST_DATE_ROLLOVER_INTERVAL_MS__ for E2E overrides.
  // (Moved here from DateRolloverBanner.tsx — same implementation.)
  const intervalMs = getRolloverIntervalMs();
  const timer = setInterval(() => setWallClockDate(getPracticeDate()), intervalMs);
  onCleanup(() => clearInterval(timer));

  // Single memo derives ALL rollover state from the 4 inputs
  const rolloverStatus = createMemo(() => {
    const ready = props.queueReady() === true && !props.queueReady.loading;
    const manual = props.isManual();
    const completed = props.isQueueCompleted();
    const qDate = props.queueDate();
    const today = wallClockDate();
    const dateChanged = !isSameDay(qDate, today);

    if (!ready) {
      return {
        ready: false,
        showBanner: false,
        shouldAutoAdvance: false,
        shouldClearManual: false,
        dateChanged: false,
        wallClockDate: today,
      };
    }

    return {
      ready,
      showBanner:        !manual && dateChanged && !completed,
      shouldAutoAdvance: !manual && dateChanged && completed,
      // "Q5 special case" from the state machine matrix: when the user set a manual
      // date but that date is now today, the manual flag is stale — clear it so the
      // normal auto-advance/banner rules take effect.
      shouldClearManual: manual && isSameDay(qDate, today),
      dateChanged,
      wallClockDate: today,
    };
  });

  // Auto-advance effect
  createEffect(() => {
    if (rolloverStatus().shouldAutoAdvance) {
      void props.onAutoAdvance();
    }
  });

  // Clear manual flag effect (Q5)
  createEffect(() => {
    if (rolloverStatus().shouldClearManual) {
      props.onClearManual();
    }
  });

  return { rolloverStatus, wallClockDate };
}
```

**Implementation note**: Keep `handlePracticeDateRefresh("auto")` idempotent and gated by queue readiness. The state machine may centralize the decision, but it must not remove the existing protection against firing while queue initialization is still in-flight.

**State machine matrix (implemented in ONE place)**:

| isManual | dateChanged | completed | → showBanner | → shouldAutoAdvance |
|----------|-------------|-----------|--------------|---------------------|
| false    | false       | any       | false        | false               |
| false    | true        | false     | **true**     | false               |
| false    | true        | true      | false        | **true**            |
| true     | any         | any       | false        | false               |

**Impact on existing files**:
- `practice.tsx`: Remove `handleDateRolloverDetection`, simplify `handlePracticeDateRefresh`
- `DateRolloverBanner.tsx`: Strip all internal state/polling, become pure display

---

### Phase 2: Simplify DateRolloverBanner (Pure Display Component)

**Goal**: Remove all internal state and polling — driven entirely by props.

**Before** (161 lines with internal state, polling, callbacks):
```tsx
<DateRolloverBanner
  initialDate={queueDate()}
  onRefresh={() => handlePracticeDateRefresh("manual")}
  onDateChange={handleDateRolloverDetection}
/>
```

**After** (~50 lines, pure display):
```tsx
<Show when={rolloverStatus().showBanner}>
  <DateRolloverBanner
    newDate={rolloverStatus().wallClockDate}
    onRefresh={() => handlePracticeDateRefresh("manual")}
  />
</Show>
```

**New props**:
```ts
interface DateRolloverBannerProps {
  /** The new date to display in the banner */
  newDate: Date;
  /** Callback when user clicks "Refresh Now" */
  onRefresh: () => void | Promise<void>;
}
```

**Removed**:
- `initialDate` prop (no longer needed — visibility driven by parent `<Show>`)
- `onDateChange` callback (replaced by declarative memo in parent)
- Internal `showBanner` signal
- Internal `newDate` signal
- Internal `setInterval` polling loop
- `getRolloverIntervalMs()` helper (moved to `useRolloverStateMachine`)
- `hasPracticeDateChanged` import (no longer needed here)

**E2E test impact**: None — `data-testid="date-rollover-banner"` and `data-testid="date-rollover-refresh-button"` remain unchanged. The banner's visibility is now controlled by the parent `<Show>` rather than internal `showBanner()`, but the DOM structure and test IDs are identical.

---

### Phase 3: Extract Composables from practice.tsx

**Goal**: Reduce practice.tsx from ~1,079 lines to ~400–500 lines by extracting cohesive composables.

#### 3a: Extract `usePracticeEvaluations` composable

**New file**: `src/routes/practice/usePracticeEvaluations.ts`

Move from practice.tsx:
- `evaluations` signal and `setEvaluations`
- `didHydrateEvaluations` hydration logic (lines 252–280)
- `stagingTuneIds` signal and `isStaging`
- `handleRecallEvalChange` (lines 483–563)
- `handleGoalChange` (lines 568–611)
- `clearStagedEvaluation` / `stagePracticeEvaluation` imports

**Interface**:
```ts
interface PracticeEvaluationsProps {
  localDb: Accessor<SqliteDatabase | null>;
  userId: Accessor<string | null>;
  currentRepertoireId: Accessor<string | null>;
  practiceListData: Accessor<ITuneOverview[]>;
  goalsMap: Accessor<Map<string, GoalRow>>;
  incrementPracticeListStagedChanged: () => void;
  suppressNextViewRefresh: (scope: string) => void;
}

interface PracticeEvaluationsState {
  evaluations: Accessor<Record<string, string>>;
  isStaging: Accessor<boolean>;
  evaluationsCount: Accessor<number>;
  handleRecallEvalChange: (tuneId: string, evaluation: string) => Promise<void>;
  handleGoalChange: (tuneId: string, goal: string | null) => Promise<void>;
}
```

#### 3b: Extract `usePracticeSubmit` composable

**New file**: `src/routes/practice/usePracticeSubmit.ts`

Move from practice.tsx:
- `handleSubmitEvaluations` (lines 615–709)
- `handleQueueReset` (lines 897–945)
- `handleAddTunes` (lines 712–761)

**Interface**:
```ts
interface PracticeSubmitProps {
  localDb: Accessor<SqliteDatabase | null>;
  userId: () => Promise<string | null>;
  currentRepertoireId: Accessor<string | null>;
  queueDate: Accessor<Date>;
  evaluationsCount: Accessor<number>;
  isStaging: Accessor<boolean>;
  clearEvaluations: () => void;
  incrementPracticeListStagedChanged: () => void;
  syncPracticeScope: () => Promise<void>;
}
```

#### 3c: Extract `useFlashcardPersistence` composable

**New file**: `src/routes/practice/useFlashcardPersistence.ts`

Move from practice.tsx:
- `flashcardMode` signal + localStorage persistence (lines 316–365)
- `flashcardFieldVisibility` signal + localStorage persistence (lines 320–373)
- Migration logic for old format (lines 338–355)

#### 3d: Remaining in practice.tsx (~400–500 lines)

After extraction, practice.tsx retains:
- Gate logic (`practiceGateState`, `isPracticeGateOpen`)
- `usePracticeQueueDate` setup
- `useRolloverStateMachine` setup
- `practiceListData` resource
- `filteredPracticeList` memo
- `handleQueueDateChange`
- `handlePracticeDateRefresh` (simplified — no longer re-derives rollover conditions)
- JSX rendering

---

### Phase 4: Simplify `handlePracticeDateRefresh`

**Goal**: Remove re-derivation of conditions already computed by the state machine.

**Current** (97 lines, re-queries DB, re-derives conditions):
```ts
const handlePracticeDateRefresh = async (mode: "manual" | "auto") => {
  // ... 15 lines of null checks
  const { ensureDailyQueue, getLatestActiveQueueWindow } = await import(...);
  // ... 20 lines querying latest window
  // ... 15 lines parsing dates and comparing
  const shouldCreateTodayQueue = !latestWindowStart || (dateChanged && (mode === "manual" || ...));
  if (!shouldCreateTodayQueue) { ... return; }
  // ... actual work
};
```

**After** (~35 lines, trusts the state machine):
```ts
const handlePracticeDateRefresh = async (mode: "manual" | "auto") => {
  const db = localDb();
  const repertoireId = currentRepertoireId();
  const userIdValue = await getUserId();
  if (!db || !repertoireId || !userIdValue) return;

  const practiceDate = getPracticeDate();

  // For auto mode, the state machine already validated conditions.
  // For manual mode (Refresh Now button), always advance.
  clearManualAndSetToday();

  try {
    await ensureDailyQueue(db, userIdValue, repertoireId, practiceDate);
  } catch (error) {
    console.warn("[PracticePage] Failed to ensure queue during refresh:", error);
  }

  incrementPracticeListStagedChanged();
};
```

The auto-advance effect in `useRolloverStateMachine` calls `handlePracticeDateRefresh("auto")` only when `shouldAutoAdvance` is true, so the function no longer needs to re-validate.

---

### Phase 5: Clean Up `getPracticeList` Debug Logging

**File**: `src/lib/db/queries/practice.ts`

**Remove or gate** the 6+ debug queries and console.log statements (lines 194–311):

```ts
// REMOVE these debug queries:
const queueRows = await db.all<{ count: number }>(sql`SELECT COUNT(*)...`);    // line 195
console.log("[DB identity]", db);                                                 // line 202
const viewRows = await db.all<{ count: number }>(sql`SELECT COUNT(*)...`);      // line 208
const windowCheck = await db.all<{...}>(sql`SELECT window_start_utc...`);       // line 219
console.log(`[getPracticeList] Available windows:`, windowCheck);                 // line 231
rows.forEach((row, i) => { console.log(...) });                                  // lines 307-311
```

These are development-time debugging aids that execute on every practice list fetch. They should be removed entirely (not gated) since they add overhead and log noise.

**Keep**: The functional `console.log` at line 304 (`"JOIN returned N rows"`) can remain as it provides row-count telemetry useful for diagnosing "empty grid" issues. The criteria: keep logs that describe *results* of operations (counts, success/failure); remove logs that dump *intermediate state* (DB identity, raw window arrays, per-row debug).

---

### Phase 6: Reduce `computeSchedulingWindows` Coupling

**Goal**: Move pure computation functions out of the service layer to break the tight coupling, while first reconciling the duplicate implementation that still exists in `src/lib/services/queue-generator.ts`.

**Current import chain**:
```
practice.ts (queries) → practice-queue.ts (services) → computeSchedulingWindows
```

**Important prerequisite**:
- `src/lib/services/practice-queue.ts` and `src/lib/services/queue-generator.ts` both define scheduling-window helpers today.
- They are not behaviorally identical, so this phase must either:
  1. make `queue-generator.ts` consume the shared utility and preserve its current semantics explicitly, or
  2. declare `queue-generator.ts` out of scope for this PR and defer deprecated-code removal until that caller is retired.

**Move** the canonical `computeSchedulingWindows`, `classifyQueueBucket`, `SchedulingWindows` interface to:
`src/lib/utils/scheduling-windows.ts`

This is a pure function with no dependencies on DB or services. Moving it to `utils/` breaks the coupling chain:
```
practice.ts (queries) → scheduling-windows.ts (utils)  ← pure
practice-queue.ts (services) → scheduling-windows.ts (utils) ← pure
```

**Re-export** from `practice-queue.ts` for backward compatibility:
```ts
export { computeSchedulingWindows, classifyQueueBucket } from "../utils/scheduling-windows";
export type { SchedulingWindows } from "../utils/scheduling-windows";
```

**Scope note**: Do not remove `queue-generator.ts`-only helpers in the same step unless their remaining callers have been updated in the same patch.

---

### Phase 7: Add Column Comments to `daily_practice_queue`

**Goal**: Document each column's purpose directly in the Drizzle schema.

**File**: `drizzle/schema-sqlite.generated.ts` — This is generated, so comments should go in the source that generates it, or in a companion documentation block.

Since the schema is generated, add a companion type documentation in `src/lib/services/practice-queue.ts` at the `DailyPracticeQueueRow` interface:

```ts
export interface DailyPracticeQueueRow {
  /** UUID primary key */
  id?: string;
  /** Supabase Auth UUID of the user */
  userRef: string;
  /** Repertoire this queue entry belongs to */
  repertoireRef: string;
  /** UTC start of the scheduling window (YYYY-MM-DDTHH:MM:SS) — defines "which day" */
  windowStartUtc: string;
  /** UTC end of the scheduling window (start + 24h) */
  windowEndUtc: string;
  /** UUID of the tune to practice */
  tuneRef: string;
  /** Queue bucket: 1=Due Today, 2=Recently Lapsed, 3=New/Unscheduled, 4=Old Lapsed */
  bucket: number;
  /** Display order within the queue (0-based, stable across reloads) */
  orderIndex: number;
  /** Snapshot of COALESCE(scheduled, latest_due) at queue generation time */
  snapshotCoalescedTs: string;
  /** Queue generation mode: "per_day" (default) or "rolling" */
  mode: string | null;
  /** Date-only portion of windowStartUtc (YYYY-MM-DD) for per_day mode */
  queueDate: string | null;
  /** Snapshot of `scheduled` timestamp at generation — diagnostic only */
  scheduledSnapshot: string | null;
  /** Snapshot of `latest_due` timestamp at generation — diagnostic only */
  latestDueSnapshot: string | null;
  /** Delinquency window (days) used during generation — diagnostic only */
  acceptableDelinquencyWindowSnapshot: number | null;
  /** Client TZ offset (minutes from UTC) at generation — diagnostic only */
  tzOffsetMinutesSnapshot: number | null;
  /** ISO timestamp when this queue entry was generated */
  generatedAt: string;
  /** ISO timestamp when this entry was marked complete (null = incomplete) */
  completedAt: string | null;
  /** Number of exposures required before completion (reserved for future use) */
  exposuresRequired: number | null;
  /** Number of exposures completed so far (reserved for future use) */
  exposuresCompleted: number | null;
  /** Outcome of practice (reserved for future use) */
  outcome: string | null;
  /** 1 = active, 0 = deactivated (on queue regeneration) */
  active: number;
  // Sync columns (from sqliteSyncColumns):
  syncVersion: number;
  lastModifiedAt: string;
  deviceId: string | null;
}
```

**Columns flagged as "diagnostic only"**: `scheduledSnapshot`, `latestDueSnapshot`, `acceptableDelinquencyWindowSnapshot`, `tzOffsetMinutesSnapshot`. These capture queue-generation-time state for debugging but are never read by application logic. They could be dropped in a future migration without affecting features.

**Columns flagged as "reserved for future use"**: `exposuresRequired`, `exposuresCompleted`, `outcome`. Currently always null/0 — could be dropped or kept depending on roadmap.

---

### Phase 8: Retire Deprecated Code Only After Live Callers Are Gone

**File**: `src/lib/db/queries/practice.ts`

Remove deprecated functions only after all live callers have been updated or removed in the same PR:
- `getDueTunes` (line 320–327) — wrapper that just calls `getPracticeList`
- `getDueTunesLegacy` (line 334+) — old implementation with manual JOINs
- `DueTuneEntry` interface (line 148–159) — used only by deprecated functions

**Current blocker**: `src/lib/services/queue-generator.ts` still imports `getDueTunesLegacy`, so Phase 8 is conditional, not automatic.

**Verify**: Search for callers before removing. If anything still imports these, update the caller first or defer this phase.

---

## File Organization (After Refactoring)

```
src/routes/practice.tsx                           (~400-500 lines, down from 1,079)
src/routes/practice/
  ├── usePracticeQueueDate.ts                     (~349 lines, unchanged)
  ├── useRolloverStateMachine.ts                  (~80 lines, NEW)
  ├── usePracticeEvaluations.ts                   (~150 lines, NEW - extracted)
  ├── usePracticeSubmit.ts                        (~120 lines, NEW - extracted)
  ├── useFlashcardPersistence.ts                  (~60 lines, NEW - extracted)
  └── history.tsx                                 (unchanged)

src/components/practice/
  ├── DateRolloverBanner.tsx                      (~50 lines, down from 161)
  ├── PracticeControlBanner.tsx                   (unchanged)
  └── ... other components                        (unchanged)

src/lib/services/
  ├── practice-queue.ts                           (~1,280 lines, minor changes)
  ├── queue-generator.ts                          (either updated to consume shared scheduling utility, or explicitly deferred)
  └── ... other services                          (unchanged)

src/lib/db/queries/
  ├── practice.ts                                 (~900 lines, down from 1,015 after removing deprecated + debug)
  └── ... other queries                           (unchanged)

src/lib/utils/
  ├── practice-date.ts                            (unchanged)
  └── scheduling-windows.ts                       (~200 lines, NEW - extracted from practice-queue.ts)
```

---

## Implementation Order

1. **Phase 6** first, but split it into two steps: reconcile `queue-generator.ts` duplication, then extract the shared utility
2. **Phase 1** (create `useRolloverStateMachine`) — core of the declarative refactor
3. **Phase 2** (simplify `DateRolloverBanner`) — depends on Phase 1
4. **Phase 4** (simplify `handlePracticeDateRefresh`) — depends on Phase 1
5. **Phase 3a–3d** (extract composables from practice.tsx) — independent extractions, can be done in any order
6. **Phase 5** (clean up debug logging) — independent, low risk
7. **Phase 7** (add column comments) — documentation only
8. **Phase 8** (remove deprecated code) — only after verifying no live callers remain

Each phase should be followed by:
- `npm run lint` (Biome check)
- `npx vitest run src/lib/services/practice-queue.test.ts` (service-level queue tests)
- `npm run test:unit` (Vitest suite under `tests/`)
- Manual verification that the app builds (`npm run build`)
- E2E tests should pass after all phases complete

---

## Risk Assessment

| Phase | Risk | Mitigation |
|-------|------|------------|
| Phase 1 (state machine) | Medium — changes reactive flow | Keep exact same conditions/outcomes; comprehensive E2E coverage exists |
| Phase 2 (banner simplification) | Low — display only | `data-testid` attributes preserved; E2E tests validate visibility |
| Phase 3 (composable extraction) | Low — mechanical move | No logic changes, just moving code between files |
| Phase 4 (simplify refresh) | Medium — removes safety re-checks | State machine memo must preserve queueReady gating before calling |
| Phase 5 (debug logging) | Very Low — removes console.log | No functional impact |
| Phase 6 (scheduling-windows) | Medium — duplicate implementations must be reconciled first | Update or explicitly defer `queue-generator.ts`; then re-export from `practice-queue.ts` |
| Phase 7 (column comments) | None — documentation only | — |
| Phase 8 (deprecated removal) | Medium — dead code is still live today | Remove only after caller search is clean |

---

## Success Criteria

1. **E2E tests pass unchanged** — especially `practice-005-date-rollover-banner.spec.ts`
2. **State machine is in ONE place** — `useRolloverStateMachine.ts` with a single `createMemo`
3. **DateRolloverBanner is pure display** — no internal state, no polling, no callbacks that determine visibility
4. **practice.tsx under 500 lines** — down from 1,079
5. **No circular dependencies** — verified by import chain analysis
6. **All `data-testid` attributes preserved** — no E2E locator changes needed
7. **Validation commands match the repo** — service tests under `src/**` are run explicitly, not assumed via `npm run test:unit`
8. **Deprecated practice-query APIs are removed only if caller search is clean** — otherwise they stay deferred for a follow-up cleanup

---

## Potential Next Steps

These are intentionally out of scope for the current PR unless a reviewer explicitly pulls them in. They come from issue #381's broader goal of making the practice queue flow simpler and easier for mid-level humans to understand.

1. **Reduce `daily_practice_queue` column surface area**
  - Audit every read/write of the queue table and classify columns as: core state, diagnostic snapshot, or future-reserved.
  - If the audit confirms they are unused in live logic, consider a follow-up migration that drops diagnostic-only columns such as `scheduledSnapshot`, `latestDueSnapshot`, `acceptableDelinquencyWindowSnapshot`, and `tzOffsetMinutesSnapshot`.
  - If roadmap review confirms they are not needed, consider dropping currently reserved columns such as `exposuresRequired`, `exposuresCompleted`, and `outcome`.
  - Do this only in a dedicated schema-change PR with migration notes, caller search, and queue regeneration/backfill verification.

2. **Collapse duplicate queue-generation code paths**
  - Decide whether `src/lib/services/queue-generator.ts` should be fully retired, or whether its remaining behavior should be absorbed into `src/lib/services/practice-queue.ts`.
  - The long-term simplification target should be one canonical queue-generation module, one canonical scheduling-window utility, and one bucket-classification definition.

3. **Make queue state transitions easier to read end-to-end**
  - After the declarative rollover refactor lands, consider a small follow-up that documents the complete queue lifecycle in one place: queue date resolution, queue creation, staging, submit, completion, rollover, and reset.
  - A short architecture note or state-transition table near the implementation may do more for human comprehensibility than additional code comments spread across files.

4. **Further decompose `practice.tsx` only where boundaries become clearer**
  - If the first extraction pass is successful, a later cleanup could move more practice-page concerns into focused composables or subcomponents, but only where the resulting ownership is obvious.
  - The standard should be improved human readability, not file-count reduction.

5. **Revisit file placement for practice/queue code**
  - Issue #381 raises whether practice-page composables and queue services should live closer together.
  - A follow-up could evaluate whether queue-date logic, rollover logic, and queue services are easier to navigate when grouped by domain rather than by current route/service split.
  - This should be judged by discoverability and dependency clarity, not aesthetics.

6. **Measure complexity only if it helps a real decision**
  - If future refactors stall on "this still feels too hard to hold in my head," a lightweight complexity snapshot could be useful.
  - This is optional. It should support human review, not become a tooling project of its own.
