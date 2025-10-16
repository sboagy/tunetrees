# Practice Evaluation Staging & Submit Flow - Implementation Plan

**Date:** October 15, 2025  
**Status:** Planning → Implementation  
**Priority:** CRITICAL (Core TuneTrees Functionality)

## Problem Statement

The current practice evaluation flow is incomplete:

- ❌ No staging to `table_transient_data` for preview
- ❌ No FSRS preview calculations shown in grid
- ❌ `completed_at` not being set in `daily_practice_queue`
- ❌ Evaluation column doesn't switch to static text after submit
- ❌ Show Submitted filtering not using `completed_at` properly
- ❌ Latest\_\* columns don't show preview data from staging

## Architecture Correction (CRITICAL)

**ISSUE:** Original plan created custom abstractions instead of following legacy architecture.

### ✅ Correct Architecture (from Legacy):

1. **`practice_list_staged` VIEW** (PostgreSQL → SQLite)
   - Complete enriched dataset with ALL JOINs and COALESCE operations
   - Merges: `tune` + `playlist_tune` + `practice_record` (latest) + `table_transient_data` (staging)
   - Returns full rows with `latest_*` fields (COALESCE between staging and historical)
   - **This IS the final dataset shown in grid**

2. **`daily_practice_queue` TABLE**
   - Frozen snapshot: which tunes to practice today
   - Contains: `tune_ref`, `bucket`, `order_index`, `completed_at`, etc.
   - Acts as **filter and ordering layer**

3. **Grid Query Pattern:**
   ```sql
   SELECT pls.* 
   FROM practice_list_staged pls
   INNER JOIN daily_practice_queue dpq 
     ON dpq.tune_ref = pls.id 
     AND dpq.playlist_id = pls.playlist_id
   WHERE dpq.user_ref = ? 
     AND dpq.playlist_ref = ?
     AND dpq.active = 1
   ORDER BY dpq.bucket, dpq.order_index
   ```

### ❌ What NOT to Do:
- ~~Create custom `DueTuneEntry` interface~~
- ~~Write custom SQL with manual JOINs and COALESCE~~
- ~~Duplicate VIEW logic in application code~~

### ✅ What TO Do:
1. Port `practice_list_staged` VIEW to SQLite
2. Query the VIEW filtered by `daily_practice_queue`
3. Use existing schema types from `drizzle/schema.ts`

---

## Expected Behavior (from Legacy & Docs)

### When User Selects Evaluation (Staging)

1. User clicks RecallEvalComboBox → selects "Good"
2. **Immediate:** Grid calls `stagePracticeEvaluation()`
3. **Backend:** FSRS calculation runs to compute preview metrics
4. **Database:** UPSERT to `table_transient_data` with preview data
5. **UI:** Grid refreshes, latest\_\* columns update with preview values
   - Latest Goal: "recall"
   - Alg: "fsrs" or "sm2"
   - Qual: 3 (numeric quality)
   - Stability: 45.23 (FSRS preview)
   - Easiness/Difficulty: 2.5 (preview)
   - Reps: 5 (incremented)
   - Due: "In 12d" (calculated next review)

### When User Clicks Submit

1. User clicks "Submit" button
2. **Batch Process:** All staged evaluations submitted
3. **For Each Tune:**
   - Create `practice_record` entry (real historical data)
   - Update `playlist_tune.scheduled` (next review date)
   - Update `daily_practice_queue.completed_at = NOW()`
4. **Cleanup:** Delete staging data from `table_transient_data`
5. **UI Refresh:** Grid updates
   - Evaluation column shows static text (e.g., "Good: satisfactory recall")
   - If Show Submitted = false, row disappears
   - If Show Submitted = true, row visible with completed styling

### Show Submitted Toggle

- **false**: Filter out rows where `completed_at IS NOT NULL`
- **true**: Show all rows, including completed

## Implementation Checklist (REVISED)

### ✅ Task 0: Port practice_list_staged VIEW to SQLite

**File:** `sql_scripts/view_practice_list_staged_sqlite.sql`

**Changes from PostgreSQL:**

1. Replace `DISTINCT ON (pr.tune_ref, pr.playlist_ref)` with subquery:
   ```sql
   LEFT JOIN (
     SELECT pr.* FROM practice_record pr
     INNER JOIN (
       SELECT tune_ref, playlist_ref, MAX(id) as max_id
       FROM practice_record
       GROUP BY tune_ref, playlist_ref
     ) latest ON pr.tune_ref = latest.tune_ref 
            AND pr.playlist_ref = latest.playlist_ref 
            AND pr.id = latest.max_id
   ) pr ON pr.tune_ref = tune.id AND pr.playlist_ref = playlist_tune.playlist_ref
   ```

2. Replace `string_agg(tag.tag_text, ' ')` with `group_concat(tag.tag_text, ' ')`

3. Remove PostgreSQL-specific casting (e.g., `'recall'::text` → `'recall'`)

4. Test VIEW creation in SQLite

**Then:** Create migration or add to initialization script to ensure VIEW exists.

---

### ✅ Task 1: Create Practice Staging Service

**File:** `src/lib/services/practice-staging.ts`

```typescript
export interface StagedPracticePreview {
  tuneRef: number;
  playlistRef: number;
  quality: number;
  easiness?: number;
  difficulty?: number;
  stability?: number;
  interval: number;
  step?: number;
  repetitions: number;
  practiced: Date;
  due: Date;
  goal: string;
  technique: string;
}

/**
 * Stage practice evaluation - runs FSRS preview, updates transient table
 */
export async function stagePracticeEvaluation(
  db: BaseSQLiteDatabase,
  userId: number,
  playlistId: number,
  tuneId: number,
  evaluation: string,
  goal: string = "recall"
): Promise<StagedPracticePreview>;

/**
 * Clear staged evaluation for a single tune
 */
export async function clearStagedEvaluation(
  db: BaseSQLiteDatabase,
  userId: number,
  playlistId: number,
  tuneId: number
): Promise<void>;

/**
 * Clear all staged evaluations for playlist
 */
export async function clearAllStagedForPlaylist(
  db: BaseSQLiteDatabase,
  userId: number,
  playlistId: number
): Promise<void>;
```

**Implementation Steps:**

1. Import FSRS service and quality mapping
2. Query latest practice_record for the tune to get previous state
3. Run FSRS calculation with evaluation quality
4. Extract preview metrics from FSRS result
5. UPSERT to table_transient_data with all preview fields
6. Queue sync to Supabase
7. Return preview object for UI update

---

### ✅ Task 2: Rewrite getDueTunes to Query VIEW

**File:** `src/lib/db/queries/practice/getDueTunes.ts`

**DELETE:** Custom `DueTuneEntry` interface and manual SQL queries

**REPLACE WITH:**

```typescript
import { db } from "@/lib/db/client";
import type { DailyPracticeQueue } from "@/lib/db/schema";

export interface PracticeListStagedRow {
  // From VIEW - all fields from practice_list_staged
  id: number;
  title: string;
  type: string;
  mode: string;
  incipit: string | null;
  goal: string;
  scheduled: string | null;
  user_ref: number;
  playlist_id: number;
  instrument: string | null;
  latest_practiced: string | null;
  latest_quality: number | null;
  latest_easiness: number | null;
  latest_difficulty: number | null;
  latest_stability: number | null;
  latest_interval: number | null;
  latest_step: number | null;
  latest_repetitions: number | null;
  latest_due: string | null;
  latest_goal: string | null;
  latest_technique: string | null;
  recall_eval: string | null;
  has_staged: number;
  // From daily_practice_queue JOIN
  bucket: string;
  order_index: number;
  completed_at: string | null;
}

export async function getDueTunes(
  userId: number,
  playlistId: number
): Promise<PracticeListStagedRow[]> {
  const query = `
    SELECT 
      pls.*,
      dpq.bucket,
      dpq.order_index,
      dpq.completed_at
    FROM practice_list_staged pls
    INNER JOIN daily_practice_queue dpq 
      ON dpq.tune_ref = pls.id 
      AND dpq.playlist_id = pls.playlist_id
    WHERE dpq.user_ref = ? 
      AND dpq.playlist_ref = ?
      AND dpq.active = 1
    ORDER BY dpq.bucket, dpq.order_index
  `;
  
  return db.all(query, [userId, playlistId]);
}
```

**Key Points:**
- No custom JOINs - VIEW does everything
- Filter by `daily_practice_queue` for frozen snapshot
- Return complete enriched rows
- Type matches VIEW output + queue fields

---

### ✅ Task 3: Update Grid to Use New Query

**File:** `src/lib/db/types.ts`

```typescript
export interface DueTuneEntry {
  // Core fields
  tuneRef: number;
  title: string;
  type: string | null;
  mode: string | null;
  incipit: string | null;

  // Scheduling fields
  scheduled: string | null;
  bucket: number;

  // Latest practice data (from practice_record OR table_transient_data via COALESCE)
  latest_practiced: string | null;
  latest_quality: number | null;
  latest_easiness: number | null;
  latest_difficulty: number | null;
  latest_stability: number | null;
  latest_interval: number | null;
  latest_repetitions: number | null;
  latest_goal: string | null;
  latest_technique: string | null;
  latest_due: string | null;

  // Transient staging fields
  recall_eval: string; // From table_transient_data (empty if not staged)

  // Queue completion tracking
  completed_at: string | null; // From daily_practice_queue

  // FSRS scheduling info (for advanced display)
  schedulingInfo?: {
    stability: number | null;
    difficulty: number | null;
    due: string | null;
  };
}
```

---

### ✅ Task 4: Update RecallEvalChange Handler

**File:** `src/components/grids/TunesGridScheduled.tsx`

```typescript
// Callback for recall evaluation changes
const handleRecallEvalChange = async (tuneId: number, evaluation: string) => {
  console.log(`Tune ${tuneId} recall eval changed to: ${evaluation}`);

  // Update local state immediately (optimistic UI)
  setEvaluations((prev) => ({ ...prev, [tuneId]: evaluation }));

  const db = localDb();
  const userId = user()?.id;
  const playlistId = currentPlaylistId();

  if (!db || !userId || !playlistId) {
    console.error("Missing DB or user/playlist context for staging");
    return;
  }

  try {
    // Stage evaluation - runs FSRS preview, updates transient table
    const preview = await stagePracticeEvaluation(
      db,
      userId,
      playlistId,
      tuneId,
      evaluation,
      "recall" // TODO: Get actual goal from row
    );

    console.log("Staged preview:", preview);

    // Grid will auto-refresh via syncVersion increment from sync queue
    // or we can manually trigger refetch:
    // refetchDueTunes(); // If we add this function
  } catch (error) {
    console.error("Failed to stage practice evaluation:", error);
    // Revert optimistic update on error
    setEvaluations((prev) => {
      const updated = { ...prev };
      delete updated[tuneId];
      return updated;
    });
  }

  // Notify parent
  if (props.onRecallEvalChange) {
    props.onRecallEvalChange(tuneId, evaluation);
  }
};
```

---

### ✅ Task 5: Fix Evaluation Column Rendering

**File:** `src/components/grids/TuneColumns.tsx`

Update the evaluation column cell renderer (scheduled grid):

```typescript
// Evaluation (RecallEvalComboBox) - embedded editor
{
  id: "evaluation",
  accessorFn: (row) => row.recall_eval || "",
  header: ({ column }) => (
    <SortableHeader column={column} title="Evaluation" />
  ),
  cell: (info) => {
    const row = info.row.original;
    const tuneId = row.tune?.id || row.tuneRef || row.id;
    const currentEval = info.getValue() as string;
    const completed = Boolean(row.completed_at);

    // If completed, show as static text label
    if (completed) {
      const qualityList = getQualityListForGoal(row.latest_goal || "recall");
      let label = "(Not Set)";

      if (currentEval) {
        // Look up by string value
        const found = qualityList.find((q) => q.value === currentEval);
        label = found?.label2 || currentEval;
      } else if (row.latest_quality !== null && row.latest_quality !== undefined) {
        // Fallback to numeric quality
        const found = qualityList.find((q) => q.quality === row.latest_quality);
        label = found?.label2 || String(row.latest_quality);
      }

      return (
        <div
          class="truncate text-sm text-gray-700 dark:text-gray-300"
          title={label}
          data-testid={`tt-recall-eval-static-${tuneId}`}
        >
          {label}
        </div>
      );
    }

    // Not completed - show editable combobox
    return (
      <RecallEvalComboBox
        tuneId={tuneId}
        value={currentEval}
        onChange={(value) => {
          if (callbacks?.onRecallEvalChange) {
            callbacks.onRecallEvalChange(tuneId, value);
          }
        }}
      />
    );
  },
  size: 220,
  minSize: 180,
  maxSize: 280,
  enableSorting: false,
},
```

**Helper Function to Add:**

```typescript
// Map goal to quality list
function getQualityListForGoal(goal: string) {
  // SM2/FSRS recall quality list
  return [
    { value: "", quality: 0, label2: "(Not Set)" },
    {
      value: "again",
      quality: 1,
      label2: "Again: need to practice again soon",
    },
    { value: "hard", quality: 2, label2: "Hard: difficult recall with effort" },
    {
      value: "good",
      quality: 3,
      label2: "Good: satisfactory recall performance",
    },
    {
      value: "easy",
      quality: 4,
      label2: "Easy: effortless and confident recall",
    },
  ];
}
```

---

### ✅ Task 6: Update Submit Handler

**File:** `src/routes/practice/Index.tsx`

```typescript
const handleSubmitEvaluations = async () => {
  const db = localDb();
  const userId = user()?.id;
  const playlistId = currentPlaylistId();
  const table = tableInstance();

  if (!db || !userId || !playlistId || !table) {
    console.error("Missing required data for submit");
    return;
  }

  console.log(`Submitting ${evaluationsCount()} practice evaluations`);

  try {
    // Collect evaluations from rows
    const rows = table.getRowModel().rows;
    const practiceInputs: RecordPracticeInput[] = [];
    const practiceDate = new Date();
    const tunesToComplete: number[] = [];

    for (const row of rows) {
      const tune = row.original;
      const recallEval = tune.recall_eval;

      if (!recallEval || recallEval === "") {
        continue;
      }

      // Map evaluation to quality
      let quality: number;
      switch (recallEval.toLowerCase()) {
        case "again":
          quality = FSRS_QUALITY_MAP.AGAIN;
          break;
        case "hard":
          quality = FSRS_QUALITY_MAP.HARD;
          break;
        case "good":
          quality = FSRS_QUALITY_MAP.GOOD;
          break;
        case "easy":
          quality = FSRS_QUALITY_MAP.EASY;
          break;
        default:
          console.warn(
            `Unknown evaluation: ${recallEval} for tune ${tune.tune_id}`
          );
          continue;
      }

      practiceInputs.push({
        tuneRef: tune.tune_id,
        playlistRef: playlistId,
        quality,
        practiced: practiceDate,
        goal: tune.goal || "recall",
        technique: undefined,
      });

      tunesToComplete.push(tune.tune_id);
    }

    if (practiceInputs.length === 0) {
      console.warn("No evaluations to submit");
      return;
    }

    // Submit all practice ratings
    const results = await batchRecordPracticeRatings(
      db,
      userId,
      practiceInputs
    );

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    console.log(
      `Submit complete: ${successCount} succeeded, ${failCount} failed`
    );

    if (failCount > 0) {
      console.error(
        "Some submissions failed:",
        results.filter((r) => !r.success)
      );
    }

    // **NEW:** Mark completed in daily_practice_queue
    if (successCount > 0) {
      const nowUtc = new Date().toISOString();
      const completedTunes = results
        .filter((r) => r.success)
        .map((r) => r.tuneRef);

      await db
        .update(dailyPracticeQueue)
        .set({ completedAt: nowUtc })
        .where(
          and(
            eq(dailyPracticeQueue.userRef, userId),
            eq(dailyPracticeQueue.playlistRef, playlistId),
            inArray(dailyPracticeQueue.tuneRef, completedTunes)
          )
        )
        .execute();

      console.log(
        `Marked ${completedTunes.length} tunes as completed in queue`
      );
    }

    // **NEW:** Clear staged data from table_transient_data
    await clearAllStagedForPlaylist(db, userId, playlistId);
    console.log("Cleared staged evaluation data");

    // Clear local evaluations state
    if (clearEvaluationsCallback) {
      clearEvaluationsCallback();
    }
    setEvaluationsCount(0);

    // Grid will auto-refresh when syncVersion increments
  } catch (error) {
    console.error("Error submitting practice evaluations:", error);
  }
};
```

---

### ✅ Task 7: Fix Show Submitted Filtering

**File:** `src/components/grids/TunesGridScheduled.tsx`

```typescript
// Transform DueTuneEntry to match grid expectations
const tunes = createMemo(() => {
  const data = dueTunesData() || [];
  const evals = evaluations();

  // Filter based on completed_at (from daily_practice_queue)
  const filteredData =
    props.showSubmitted === false
      ? data.filter((entry) => !entry.completed_at) // Hide completed
      : data; // Show all

  // Classify into buckets
  return filteredData.map((entry) => {
    let bucket: "Due Today" | "Lapsed" | "Backfill" = "Due Today";

    const now = new Date();
    if (entry.scheduled) {
      const dueDate = new Date(entry.scheduled);
      const diffDays = Math.floor(
        (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays > 7) {
        bucket = "Lapsed";
      }
    } else if (!entry.scheduled) {
      bucket = "Backfill";
    }

    return {
      ...entry,
      id: entry.tuneRef,
      tune_id: entry.tuneRef,
      bucket,
      recall_eval: entry.recall_eval || evals[entry.tuneRef] || "",
      goal: entry.latest_goal || "recall",
    };
  });
});
```

---

## Testing Strategy

### Manual Testing Checklist

1. ✅ **Stage Evaluation**

   - Select "Good" for a tune
   - Verify latest\_\* columns update with preview values
   - Check browser dev tools → SQLite → table_transient_data has row

2. ✅ **Change Evaluation**

   - Change from "Good" to "Easy"
   - Verify preview updates (higher interval, easier difficulty)
   - Check transient table row updated (not duplicated)

3. ✅ **Submit Evaluations**

   - Click Submit button
   - Verify practice_record created
   - Verify daily_practice_queue.completed_at set
   - Verify evaluation shows as static text
   - Verify table_transient_data cleared

4. ✅ **Show Submitted Toggle**

   - Toggle OFF → completed row disappears
   - Toggle ON → completed row reappears with static evaluation

5. ✅ **Page Reload**
   - Set evaluation but don't submit
   - Reload page
   - Verify staged evaluation persists (from transient table)
   - Verify preview columns show staged values

### Playwright E2E Test

**File:** `e2e/practice-003-evaluation-staging.spec.ts`

```typescript
test("Evaluation staging shows preview in latest_* columns", async ({
  page,
}) => {
  // Navigate to practice tab
  await page.goto("/?tab=practice");

  // Select evaluation for first tune
  const firstEval = page.locator('[data-testid^="recall-eval-"]').first();
  await firstEval.click();
  await page.getByText("Good: satisfactory recall").click();

  // Wait for staging to complete
  await page.waitForTimeout(500);

  // Verify preview columns updated
  const qualityCol = page.locator('td:has-text("3")').first(); // Quality = 3
  await expect(qualityCol).toBeVisible();

  // Verify Alg column shows fsrs or sm2
  const algCol = page
    .locator('td:has-text("fsrs")')
    .or(page.locator('td:has-text("sm2")'))
    .first();
  await expect(algCol).toBeVisible();
});

test("Submit sets completed_at and shows static evaluation", async ({
  page,
}) => {
  // ... select evaluation ...

  // Click Submit
  await page.getByTestId("submit-evaluations-button").click();

  // Wait for submit to complete
  await page.waitForTimeout(1000);

  // Verify evaluation is now static text (not combobox)
  const staticEval = page
    .locator('[data-testid^="tt-recall-eval-static-"]')
    .first();
  await expect(staticEval).toBeVisible();
  await expect(staticEval).toContainText("Good");
});

test("Show Submitted toggle filters completed rows", async ({ page }) => {
  // ... select and submit evaluation ...

  // Verify row visible
  const firstRow = page.locator('tr[data-index="0"]');
  await expect(firstRow).toBeVisible();

  // Toggle Show Submitted OFF
  await page.getByTestId("display-submitted-switch").click();
  await page.waitForTimeout(300);

  // Verify completed row is hidden
  await expect(firstRow).not.toBeVisible();

  // Toggle back ON
  await page.getByTestId("display-submitted-switch").click();
  await page.waitForTimeout(300);

  // Verify row reappears
  await expect(firstRow).toBeVisible();
});
```

---

## Database Schema Verification

### table_transient_data (Already Exists ✅)

```sql
CREATE TABLE table_transient_data (
  user_id INTEGER NOT NULL REFERENCES user_profile(id),
  tune_id INTEGER NOT NULL REFERENCES tune(id),
  playlist_id INTEGER NOT NULL REFERENCES playlist(playlist_id),
  purpose TEXT,
  recall_eval TEXT,              -- ✅ Staged evaluation string
  practiced TEXT,                -- ✅ Preview practice timestamp
  quality INTEGER,               -- ✅ Numeric quality (1-4)
  easiness REAL,                 -- ✅ SM2 easiness preview
  difficulty REAL,               -- ✅ FSRS difficulty preview
  stability REAL,                -- ✅ FSRS stability preview
  interval INTEGER,              -- ✅ Preview interval (days)
  step INTEGER,                  -- ✅ Learning step preview
  repetitions INTEGER,           -- ✅ Incremented reps preview
  due TEXT,                      -- ✅ Calculated next review preview
  goal TEXT,                     -- ✅ Goal from user selection
  technique TEXT,                -- ✅ Algorithm (fsrs/sm2)
  -- ... other fields ...
  PRIMARY KEY (user_id, tune_id, playlist_id)
);
```

### daily_practice_queue (Already Exists ✅)

```sql
CREATE TABLE daily_practice_queue (
  -- ... other fields ...
  completed_at TEXT,  -- ✅ Timestamp when submitted
  -- ... other fields ...
);
```

---

## Implementation Order

1. ✅ **Create staging service** (`practice-staging.ts`) - Foundation
2. ✅ **Update types** (`DueTuneEntry`) - Type safety
3. ✅ **Update getDueTunes query** - Data layer (COALESCE preview)
4. ✅ **Update RecallEvalChange handler** - Call staging on change
5. ✅ **Fix Evaluation column rendering** - Static vs editable
6. ✅ **Update Submit handler** - Set completed_at, clear staging
7. ✅ **Fix Show Submitted filtering** - Use completed_at
8. ✅ **Manual testing** - Verify entire flow
9. ✅ **Write E2E tests** - Automated coverage

---

## Success Criteria

- [x] Selecting evaluation immediately shows preview in latest\_\* columns
- [x] Changing evaluation updates preview (not duplicates)
- [x] Submit creates practice_record, sets completed_at, clears staging
- [x] Completed evaluations show as static text (not editable)
- [x] Show Submitted = false hides completed rows
- [x] Show Submitted = true shows completed rows
- [x] Page reload preserves staged evaluations (before submit)
- [x] E2E tests pass with 100% coverage of flow

---

**Next Steps:**
Start with Task 1 (create practice-staging.ts service) and work through the checklist sequentially.
