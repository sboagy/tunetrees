# Practice Flow: Code Map (SolidJS PWA)

This document maps the complete practice flow in the current SolidJS PWA implementation, from queue generation to submission and sync.

**Architecture:** Offline-first with local SQLite WASM + Supabase sync  
**Last Updated:** November 8, 2025

---

## Overview

The practice flow consists of five major phases:

1. **Queue Generation** - Create frozen daily practice snapshot
2. **Evaluation Staging** - FSRS preview calculations on dropdown selection
3. **Submission** - Commit evaluations to practice_record and mark queue completed
4. **Sync** - Bidirectional sync with Supabase PostgreSQL
5. **UI Refresh** - React to database changes via reactive signals

---

## Architecture Diagram

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant UI as SolidJS UI
    participant DB as SQLite WASM
    participant Q as Practice Queue
    participant S as Staging Service
    participant C as Commit Service
    participant Sync as Sync Engine
    participant SB as Supabase

    Note over U,SB: PHASE 1: Queue Generation (On Page Load)
    U->>UI: Navigate to /practice
    UI->>DB: Check if queue exists for today
    alt Queue exists
        DB-->>UI: Return existing queue
    else No queue
        UI->>Q: generateOrGetPracticeQueue()
        Q->>DB: Query practice_list_staged VIEW
        Note over Q,DB: Q1: Due Today<br/>Q2: Recently Lapsed<br/>Q3: New/Unscheduled<br/>Q4: Old Lapsed
        Q->>DB: INSERT daily_practice_queue rows
        Q->>Sync: queueSync() for new rows
        DB-->>UI: Return queue snapshot
    end
    UI-->>U: Display practice grid (ordered by bucket/order_index)

    Note over U,SB: PHASE 2: Evaluation Staging (Per Tune)
    U->>UI: Select "Good" evaluation
    UI->>S: stagePracticeEvaluation()
    S->>DB: Get latest practice_record
    S->>S: Run FSRS calculation
    Note over S: Convert "good" → Rating.Good<br/>Compute stability, difficulty, interval
    S->>DB: UPSERT table_transient_data
    S->>Sync: queueSync() for staging row
    S->>DB: persistDb() to IndexedDB
    S-->>UI: Return preview metrics
    UI->>UI: incrementSyncVersion()
    UI->>DB: Re-query practice_list_staged
    Note over DB: VIEW COALESCEs staging + historical
    UI-->>U: Show preview (stability, due date, etc.)

    loop Additional Evaluations
        U->>UI: Select evaluation for another tune
        UI->>S: stagePracticeEvaluation()
        Note over S,DB: Same staging process (UPSERT)
    end

    Note over U,SB: PHASE 3: Submission
    U->>UI: Click "Submit" button
    UI->>C: commitStagedEvaluations(windowStartUtc)
    C->>DB: SELECT from table_transient_data<br/>(filter by user/playlist/practiced IS NOT NULL)
    C->>DB: SELECT tune_refs from daily_practice_queue<br/>(filter by windowStartUtc)
    C->>C: Filter staging rows to only current queue

    loop For Each Staged Evaluation
        C->>DB: Check for duplicate practice_record<br/>(unique: tune_ref, playlist_ref, practiced)
        alt Duplicate exists
            C->>C: Increment practiced timestamp by 1 second
        end
        C->>DB: INSERT practice_record
        C->>Sync: queueSync("practice_record", "update")
        C->>DB: UPDATE playlist_tune.current (next review date)
        C->>Sync: queueSync("playlist_tune", "update")
        C->>DB: UPDATE daily_practice_queue.completed_at
        C->>Sync: queueSync("daily_practice_queue", "update")
        C->>DB: DELETE from table_transient_data
        C->>Sync: queueSync("table_transient_data", "delete")
    end

    C->>DB: persistDb() to IndexedDB
    C-->>UI: Return {success: true, count: N}
    UI->>UI: toast.success()
    UI->>Sync: forceSyncUp()

    Note over U,SB: PHASE 4: Sync to Supabase
    Sync->>DB: getPendingSyncItems()
    loop For Each Sync Queue Item
        Sync->>Sync: Transform camelCase → snake_case
        Sync->>SB: Supabase API (INSERT/UPDATE/DELETE)
        SB-->>Sync: Success
        Sync->>DB: markSynced(item.id)
    end
    Sync-->>UI: Sync complete

    UI->>UI: setEvaluations({})
    UI->>UI: setEvaluationsCount(0)
    UI->>UI: incrementSyncVersion()

    Note over U,SB: PHASE 5: UI Refresh
    UI->>DB: getPracticeList() [triggered by syncVersion change]
    DB->>DB: Query practice_list_staged<br/>INNER JOIN daily_practice_queue<br/>WHERE completed_at IS NULL
    DB-->>UI: Return uncompleted tunes
    UI-->>U: Grid refreshes (submitted tunes disappear)

    Note over U,SB: Background: Supabase → Local Sync
    SB->>Sync: Realtime notification (other device changed data)
    Sync->>SB: syncDown() - fetch updated records
    Sync->>DB: UPSERT into local tables
    Sync->>UI: Trigger incrementSyncVersion()
    UI->>DB: Re-query practice_list_staged
    UI-->>U: Grid updates with changes
```

---

## Phase 1: Queue Generation

### Entry Point: Page Load

**File:** `src/routes/practice/Index.tsx`  
**Lines:** 1-110

```typescript
const PracticeIndex: Component = () => {
  const { user, localDb, incrementSyncVersion, forceSyncUp, syncVersion } = useAuth();
  const { currentPlaylistId } = useCurrentPlaylist();

  // Resource to get user ID from user_profile table
  const [userId] = createResource(/* ... */); // Lines 60-75

  // Shared evaluation state
  const [evaluations, setEvaluations] = createSignal<Record<number, string>>({});
  const [evaluationsCount, setEvaluationsCount] = createSignal(0);
```

### Queue Generation Service

**File:** `src/lib/services/practice-queue.ts`  
**Lines:** 547-820 (main function)

**Entry Function:** `generateOrGetPracticeQueue()`

```typescript
export async function generateOrGetPracticeQueue(
  db: AnyDatabase,
  userRef: string,
  playlistRef: string,
  reviewSitdownDate: Date = new Date(),
  localTzOffsetMinutes: number | null = null,
  mode: string = "per_day",
  forceRegen: boolean = false
): Promise<DailyPracticeQueueRow[]>
```

**Key Steps:**

1. **Compute Windows** (Lines 570-577)
   ```typescript
   const windows = computeSchedulingWindows(
     reviewSitdownDate,
     prefs.acceptableDelinquencyWindow,
     localTzOffsetMinutes
   );
   ```
   - **Function:** `computeSchedulingWindows()` in `src/lib/services/queue-generator.ts:131-151`
   - **Returns:** `{ startTs, endTs, windowFloorTs }` (ISO format timestamps)

2. **Check Existing Queue** (Lines 595-607)
   ```typescript
   const existing = await fetchExistingActiveQueue(db, userRef, playlistRef, windowStartKey);
   if (existing.length > 0 && !forceRegen) {
     return existing;
   }
   ```
   - **Function:** `fetchExistingActiveQueue()` in `src/lib/services/practice-queue.ts:198-220`

3. **Query Practice List Staged** (Lines 636-668, 679-700, 709-730, 740-764)
   - **Q1 (Bucket 1):** Due today
     ```sql
     SELECT * FROM practice_list_staged
     WHERE scheduled >= startTs AND scheduled < endTs
     ORDER BY COALESCE(scheduled, latest_due) ASC
     ```
   - **Q2 (Bucket 2):** Recently lapsed (within delinquency window)
     ```sql
     WHERE scheduled >= windowFloorTs AND scheduled < startTs
     ```
   - **Q3 (Bucket 3):** New/unscheduled tunes
     ```sql
     WHERE scheduled IS NULL AND (latest_due IS NULL OR latest_due < windowFloorTs)
     ```
   - **Q4 (Bucket 4):** Old lapsed (disabled by default)

4. **Build Queue Rows** (Lines 774-803)
   ```typescript
   const q1Built = buildQueueRows(q1Rows, windows, prefs, userRef, playlistRef, mode, localTzOffsetMinutes, 1);
   ```
   - **Function:** `buildQueueRows()` in `src/lib/services/practice-queue.ts:340-381`
   - **Creates:** `DailyPracticeQueueRow` objects with:
     - `bucket` (1-4)
     - `orderIndex` (0-based sequential)
     - `windowStartUtc`, `windowEndUtc`
     - `snapshotCoalescedTs` (captured scheduling timestamp)
     - `completedAt: null` (initially)

5. **Persist to Database** (Lines 805-817)
   ```typescript
   await db.insert(dailyPracticeQueue).values(allBuiltRows).run();
   ```
   - **Table:** `daily_practice_queue`
   - **Schema:** `drizzle/schema-postgres.ts:286-346` (23 fields, UNIQUE constraint)

### Window Format Utility

**File:** `src/lib/utils/practice-date.ts`  
**Lines:** 57-76

```typescript
export function formatAsWindowStart(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} 00:00:00`;
}
// Returns: "2025-11-08 00:00:00" (space format)
```

**Critical Note:** Database may contain BOTH formats:
- `'2025-11-08T00:00:00'` (ISO with T - from earlier code)
- `'2025-11-08 00:00:00'` (space format - from formatAsWindowStart)

---

## Phase 2: Evaluation Staging

### User Interaction: Selecting Evaluation

**File:** `src/components/grids/TunesGridScheduled.tsx`  
**Lines:** 275-325

**Handler:** `handleRecallEvalChange()`

```typescript
const handleRecallEvalChange = async (tuneId: string, evaluation: string) => {
  console.log(`Tune ${tuneId} recall eval changed to: ${evaluation}`);
  
  // Update local state immediately (optimistic UI)
  setEvaluations((prev) => ({ ...prev, [tuneId]: evaluation }));

  const db = localDb();
  const playlistId = currentPlaylistId();
  if (!db || !playlistId || !props.userId) return;

  if (evaluation === "") {
    // Clear staged data when "(not set)" selected
    await clearStagedEvaluation(db, props.userId, tuneId, playlistId);
  } else {
    // Stage FSRS preview
    await stagePracticeEvaluation(db, props.userId, playlistId, tuneId, evaluation, "recall", "");
  }
}
```

### Evaluation Dropdown Component

**File:** `src/components/grids/RecallEvalComboBox.tsx`  
**Lines:** 1-107

```typescript
interface RecallEvalComboBoxProps {
  value: string;
  onChange: (value: string) => void;
  testId: string;
}

export const RecallEvalComboBox: Component<RecallEvalComboBoxProps> = (props) => {
  const options = [
    { value: "", label: "(Not Set)", color: "text-gray-500" },
    { value: "again", label: "Again", color: "text-red-600" },
    { value: "hard", label: "Hard", color: "text-orange-600" },
    { value: "good", label: "Good", color: "text-green-600" },
    { value: "easy", label: "Easy", color: "text-blue-600" },
  ];
  
  return <DropdownMenu.Root>{/* Kobalte DropdownMenu */}</DropdownMenu.Root>;
};
```

### Staging Service

**File:** `src/lib/services/practice-staging.ts`  
**Lines:** 128-262

**Main Function:** `stagePracticeEvaluation()`

```typescript
export async function stagePracticeEvaluation(
  db: SqliteDatabase,
  userId: string,
  playlistId: string,
  tuneId: string,
  evaluation: string,
  goal: string = "recall",
  technique: string = ""
): Promise<FSRSPreviewMetrics>
```

**Key Steps:**

1. **Get Latest Practice Record** (Lines 141-143)
   ```typescript
   const latestCard = await getLatestPracticeRecord(db, tuneId, playlistId);
   ```
   - **Function:** `getLatestPracticeRecord()` in same file, lines 67-122
   - **Returns:** FSRS `Card` object or null if never practiced

2. **Run FSRS Calculation** (Lines 145-161)
   ```typescript
   const f = fsrs();
   const rating = mapEvaluationToRating(evaluation); // "good" → Rating.Good
   const card: Card = latestCard ?? createEmptyCard(now);
   const schedulingCards = f.repeat(card, now);
   const nextCard = schedulingCards[ratingKey].card;
   ```
   - **Library:** `ts-fsrs` (imported line 17)
   - **Ratings:** Again=1, Hard=2, Good=3, Easy=4

3. **Build Preview Metrics** (Lines 164-175)
   ```typescript
   const preview: FSRSPreviewMetrics = {
     quality: rating,
     difficulty: nextCard.difficulty,
     stability: nextCard.stability,
     interval: Math.round(nextCard.scheduled_days),
     step: nextCard.state,
     repetitions: nextCard.reps,
     practiced: now.toISOString(),
     due: nextCard.due.toISOString(),
     state: nextCard.state,
     goal,
     technique,
   };
   ```

4. **UPSERT to Transient Table** (Lines 178-225)
   ```typescript
   await db.run(sql`
     INSERT INTO table_transient_data (
       user_id, tune_id, playlist_id, quality, difficulty, stability, 
       interval, step, repetitions, practiced, due, state, goal, 
       technique, recall_eval, sync_version, last_modified_at
     ) VALUES (${userId}, ${tuneId}, ${playlistId}, /* ... */)
     ON CONFLICT(user_id, tune_id, playlist_id) DO UPDATE SET
       quality = excluded.quality,
       difficulty = excluded.difficulty,
       /* ... all fields ... */
   `);
   ```
   - **Table:** `table_transient_data`
   - **Constraint:** UNIQUE on (user_id, tune_id, playlist_id)

5. **Queue for Sync** (Lines 228-240)
   ```typescript
   await queueSync(db, "table_transient_data", "update", {
     userId, tuneId, playlistId, ...preview, recallEval: evaluation
   });
   ```

6. **Persist to IndexedDB** (Lines 243-244)
   ```typescript
   await persistDb();
   ```

### Clear Staged Evaluation

**File:** `src/lib/services/practice-staging.ts`  
**Lines:** 264-289

```typescript
export async function clearStagedEvaluation(
  db: SqliteDatabase,
  userId: string,
  tuneId: string,
  playlistId: string
): Promise<void> {
  await db.run(sql`
    DELETE FROM table_transient_data
    WHERE user_id = ${userId} AND tune_id = ${tuneId} AND playlist_id = ${playlistId}
  `);
  
  await queueSync(db, "table_transient_data", "delete", { userId, tuneId, playlistId });
  await persistDb();
}
```

---

## Phase 3: Submission

### User Action: Click Submit Button

**File:** `src/routes/practice/Index.tsx`  
**Lines:** 291-389

**Handler:** `handleSubmitEvaluations()`

```typescript
const handleSubmitEvaluations = async () => {
  const db = localDb();
  const playlistId = currentPlaylistId();
  const userId = await getUserId();
  
  if (!db || !playlistId || !userId) {
    toast.error("Cannot submit: Missing required data");
    return;
  }

  const count = evaluationsCount();
  if (count === 0) {
    toast.warning("No evaluations to submit");
    return;
  }

  // Convert queue date to window_start_utc format
  const date = queueDate();
  const windowStartUtc = formatAsWindowStart(date); // "2025-11-08 00:00:00"

  // Call commit service
  const result = await commitStagedEvaluations(db, userId, playlistId, windowStartUtc);

  if (result.success) {
    toast.success(`Successfully submitted ${result.count} evaluation(s)`);
    
    // Force sync to Supabase
    await forceSyncUp();
    
    // Clear local state
    setEvaluations({});
    setEvaluationsCount(0);
    
    // Trigger UI refresh
    incrementSyncVersion();
  } else {
    toast.error(`Failed to submit: ${result.error}`);
  }
};
```

### Commit Service

**File:** `src/lib/services/practice-recording.ts`  
**Lines:** 356-710

**Main Function:** `commitStagedEvaluations()`

```typescript
export async function commitStagedEvaluations(
  db: SqliteDatabase,
  userId: string,
  playlistId: string,
  windowStartUtc?: string
): Promise<{ success: boolean; count: number; error?: string }>
```

**Key Steps:**

1. **Determine Active Window** (Lines 370-394)
   ```typescript
   let activeWindowStart: string;
   if (windowStartUtc) {
     activeWindowStart = windowStartUtc;
   } else {
     const latestWindow = await db.get<{ window_start_utc: string }>(sql`
       SELECT window_start_utc FROM daily_practice_queue
       WHERE user_ref = ${userId} AND playlist_ref = ${playlistId}
       ORDER BY window_start_utc DESC LIMIT 1
     `);
     activeWindowStart = latestWindow.window_start_utc;
   }
   ```

2. **Fetch Staged Evaluations** (Lines 407-449)
   ```typescript
   const stagedEvaluations = await db.all<{
     tune_id: number;
     quality: number;
     difficulty: number;
     stability: number;
     interval: number;
     step: number | null;
     repetitions: number;
     practiced: string;
     due: string;
     state: number;
     goal: string;
     technique: string;
     recall_eval: string;
     elapsed_days: number | null;
     lapses: number | null;
   }>(sql`
     SELECT tune_id, quality, difficulty, stability, interval, step, 
            repetitions, practiced, due, state, goal, technique, recall_eval
     FROM table_transient_data
     WHERE user_id = ${userId}
       AND playlist_id = ${playlistId}
       AND practiced IS NOT NULL
   `);
   ```

3. **Filter to Queue Tunes** (Lines 452-471)
   ```typescript
   const queueTuneIds = await db.all<{ tune_ref: number }>(sql`
     SELECT DISTINCT tune_ref FROM daily_practice_queue
     WHERE user_ref = ${userId} AND playlist_ref = ${playlistId}
       AND window_start_utc = ${activeWindowStart}
   `);
   
   const queueTuneIdSet = new Set(queueTuneIds.map(row => row.tune_ref));
   const evaluationsToCommit = stagedEvaluations.filter(eval_ => 
     queueTuneIdSet.has(eval_.tune_id)
   );
   ```

4. **For Each Evaluation** (Lines 490-706):

   **a. Ensure Unique Timestamp** (Lines 494-521)
   ```typescript
   let practicedTimestamp = staged.practiced;
   let attempts = 0;
   while (attempts < maxAttempts) {
     const existing = await db.all<{ id: number }>(sql`
       SELECT id FROM practice_record
       WHERE tune_ref = ${staged.tune_id}
         AND playlist_ref = ${playlistId}
         AND practiced = ${practicedTimestamp}
     `);
     
     if (existing.length === 0) break;
     
     // Increment by 1 second if duplicate
     const date = new Date(practicedTimestamp);
     date.setSeconds(date.getSeconds() + 1);
     practicedTimestamp = date.toISOString();
     attempts++;
   }
   ```

   **b. Insert Practice Record** (Lines 524-571)
   ```typescript
   const recordId = generateId();
   await db.run(sql`
     INSERT INTO practice_record (
       id, playlist_ref, tune_ref, practiced, quality, easiness, interval, 
       repetitions, due, backup_practiced, stability, elapsed_days, lapses, 
       state, difficulty, step, goal, technique, last_modified_at
     ) VALUES (
       ${recordId}, ${playlistId}, ${staged.tune_id}, ${practicedTimestamp},
       ${staged.quality}, NULL, ${staged.interval}, ${staged.repetitions},
       ${staged.due}, NULL, ${staged.stability}, ${staged.elapsed_days ?? null},
       ${staged.lapses ?? 0}, ${staged.state}, ${staged.difficulty},
       ${staged.step}, ${staged.goal}, ${staged.technique}, ${now}
     )
   `);
   ```

   **c. Queue Sync for Practice Record** (Lines 573-591)
   ```typescript
   await queueSync(db, "practice_record", "update", {
     id: recordId,
     playlistRef: playlistId,
     tuneRef: staged.tune_id,
     practiced: practicedTimestamp,
     quality: staged.quality,
     // ... all fields ...
   });
   ```

   **d. Update Playlist Tune** (Lines 593-606)
   ```typescript
   await db.run(sql`
     UPDATE playlist_tune
     SET current = ${staged.due}, last_modified_at = ${now}
     WHERE playlist_ref = ${playlistId} AND tune_ref = ${staged.tune_id}
   `);
   
   await queueSync(db, "playlist_tune", "update", {
     playlistRef: playlistId,
     tuneRef: staged.tune_id,
   });
   ```

   **e. Update Queue Completed At** (Lines 639-683)
   ```typescript
   const queueItem = await db.get<{ id: string; window_start_utc: string }>(sql`
     SELECT id, window_start_utc, window_end_utc
     FROM daily_practice_queue
     WHERE user_ref = ${userId}
       AND playlist_ref = ${playlistId}
       AND tune_ref = ${staged.tune_id}
       AND window_start_utc = ${activeWindowStart}
     LIMIT 1
   `);
   
   await db.run(sql`
     UPDATE daily_practice_queue
     SET completed_at = ${now}
     WHERE user_ref = ${userId}
       AND playlist_ref = ${playlistId}
       AND tune_ref = ${staged.tune_id}
       AND window_start_utc = ${activeWindowStart}
   `);
   
   // Verify the update
   const verifyQueue = await db.get<{ completed_at: string | null }>(sql`
     SELECT completed_at FROM daily_practice_queue
     WHERE user_ref = ${userId} AND playlist_ref = ${playlistId}
       AND tune_ref = ${staged.tune_id} AND window_start_utc = ${activeWindowStart}
     LIMIT 1
   `);
   console.log(`✓ Verified completed_at in DB:`, verifyQueue?.completed_at);
   
   await queueSync(db, "daily_practice_queue", "update", {
     id: queueItem.id,
     userRef: userId,
     playlistRef: playlistId,
     completedAt: now,
   });
   ```

   **f. Delete from Transient Table** (Lines 686-691)
   ```typescript
   await db.run(sql`
     DELETE FROM table_transient_data
     WHERE user_id = ${userId} AND tune_id = ${staged.tune_id}
       AND playlist_id = ${playlistId}
   `);
   ```

5. **Persist and Return** (Lines 704-709)
   ```typescript
   await persistDb();
   
   return {
     success: true,
     count: committedTuneIds.length,
   };
   ```

---

## Phase 4: Synchronization

### Force Sync Up (Manual Trigger)

**File:** `src/lib/auth/AuthContext.tsx`  
**Lines:** 342-372 (forceSyncUp implementation)

```typescript
const forceSyncUp = async () => {
  const syncServiceInstance = syncService();
  if (!syncServiceInstance) return;

  console.log("🔄 [ForceSyncUp] Starting sync up to Supabase...");
  
  const result = await syncServiceInstance.syncUp();
  
  console.log("✅ [ForceSyncUp] Sync up completed:", {
    success: result.success,
    itemsSynced: result.itemsSynced,
    itemsFailed: result.itemsFailed,
  });
  
  // Increment sync version to trigger UI updates
  setSyncVersion((prev) => prev + 1);
};
```

### Sync Service

**File:** `src/lib/sync/service.ts`  
**Lines:** 159-179

```typescript
export class SyncService {
  public async syncUp(): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error("Sync already in progress");
    }
    
    this.isSyncing = true;
    
    try {
      const result = await this.syncEngine.syncUp();
      this.config.onSyncComplete?.(result);
      return result;
    } finally {
      this.isSyncing = false;
    }
  }
}
```

### Sync Engine

**File:** `src/lib/sync/engine.ts`  
**Lines:** 192-284

**Main Function:** `syncUp()`

```typescript
async syncUp(): Promise<SyncResult> {
  const startTime = new Date().toISOString();
  const errors: string[] = [];
  let synced = 0;
  let failed = 0;

  // Get pending sync items in batches
  const pendingItems = await getPendingSyncItems(this.localDb, this.config.batchSize);

  if (pendingItems.length === 0) {
    return { success: true, itemsSynced: 0, itemsFailed: 0, conflicts: 0, errors: [], timestamp: startTime };
  }

  // Process each item
  for (const item of pendingItems) {
    try {
      await this.processQueueItem(item);
      await markSynced(this.localDb, item.id!);
      synced++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`Item ${item.id} (${item.tableName} ${item.operation}): ${errorMsg}`);
      await updateSyncStatus(this.localDb, item.id!, "failed", errorMsg);
      failed++;
    }
  }

  return {
    success: failed === 0,
    itemsSynced: synced,
    itemsFailed: failed,
    conflicts: 0,
    errors,
    timestamp: startTime,
  };
}
```

**Process Queue Item** (Lines 404-505)

```typescript
private async processQueueItem(item: SyncQueueItem): Promise<void> {
  const remoteTable = this.supabase.from(item.tableName);
  const recordData = JSON.parse(item.recordData);
  
  // Transform camelCase (local) → snake_case (Supabase API)
  const transformed = this.transformLocalToRemote(recordData);

  if (item.operation === "insert" || item.operation === "update") {
    const { error } = await remoteTable.upsert(transformed);
    if (error) throw error;
  } else if (item.operation === "delete") {
    const compositeFields = getCompositeKeyFields(item.tableName);
    if (compositeFields) {
      // Handle composite keys
      const filters: any = {};
      for (const field of compositeFields) {
        filters[field] = transformed[field];
      }
      const { error } = await remoteTable.delete().match(filters);
      if (error) throw error;
    } else {
      const { error } = await remoteTable.delete().eq("id", transformed.id);
      if (error) throw error;
    }
  }
}
```

### Field Transformation

**File:** `src/lib/sync/engine.ts`  
**Lines:** 938-998 (transformLocalToRemote)

```typescript
private transformLocalToRemote(record: any): any {
  const transformed: any = {};
  
  for (const [key, value] of Object.entries(record)) {
    // camelCase → snake_case
    const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    
    // Handle timestamp fields (text → timestamp)
    if (value && typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      transformed[snakeKey] = value; // Already ISO 8601
    }
    // Handle boolean (0/1 → true/false)
    else if (typeof value === "number" && (value === 0 || value === 1)) {
      transformed[snakeKey] = value === 1;
    }
    else {
      transformed[snakeKey] = value;
    }
  }
  
  return transformed;
}
```

### Sync Queue Management

**File:** `src/lib/sync/queue.ts`  
**Lines:** 1-300

**Main Functions:**

1. **queueSync()** - Add item to sync queue (Lines 76-157)
   ```typescript
   export async function queueSync(
     db: SqliteDatabase,
     tableName: SyncableTable,
     operation: "insert" | "update" | "delete",
     recordData: any
   ): Promise<void> {
     const queueId = generateId();
     const now = new Date().toISOString();
     
     await db.insert(syncQueue).values({
       id: queueId,
       tableName,
       operation,
       recordData: JSON.stringify(recordData),
       status: "pending",
       createdAt: now,
       lastModifiedAt: now,
     });
   }
   ```

2. **getPendingSyncItems()** - Get items to sync (Lines 174-187)
   ```typescript
   export async function getPendingSyncItems(
     db: SqliteDatabase,
     limit = 100
   ): Promise<SyncQueueItem[]> {
     return await db
       .select()
       .from(syncQueue)
       .where(eq(syncQueue.status, "pending"))
       .orderBy(syncQueue.createdAt)
       .limit(limit);
   }
   ```

3. **markSynced()** - Mark item as completed (Lines 189-196)
   ```typescript
   export async function markSynced(
     db: SqliteDatabase,
     queueId: string
   ): Promise<void> {
     await db.delete(syncQueue).where(eq(syncQueue.id, queueId));
   }
   ```

---

## Phase 5: UI Refresh

### Grid Data Query

**File:** `src/components/grids/TunesGridScheduled.tsx`  
**Lines:** 81-140

**Resource:** `dueTunesData`

```typescript
const [dueTunesData] = createResource(
  () => {
    const db = localDb();
    const playlistId = currentPlaylistId();
    const version = syncVersion(); // ← Triggers refetch on change
    const initialized = queueInitialized();
    
    return db && props.userId && playlistId && initialized
      ? { db, userId: props.userId, playlistId, version, queueReady: initialized }
      : null;
  },
  async (params) => {
    if (!params) return [];
    
    const delinquencyWindowDays = 7;
    return await getPracticeList(
      params.db,
      params.userId,
      params.playlistId,
      delinquencyWindowDays
    );
  }
);
```

### Practice List Query

**File:** `src/lib/db/queries/practice.ts`  
**Lines:** 161-280

**Main Function:** `getPracticeList()`

```typescript
export async function getPracticeList(
  db: SqliteDatabase,
  userId: string,
  playlistId: string,
  _delinquencyWindowDays: number = 7
): Promise<PracticeListStagedWithQueue[]>
```

**Key Steps:**

1. **Debug Queue Status** (Lines 184-223)
   ```typescript
   const queueRows = await db.all<{ count: number }>(sql`
     SELECT COUNT(*) as count FROM daily_practice_queue dpq
     WHERE dpq.user_ref = ${userId} AND dpq.playlist_ref = ${playlistId}
       AND dpq.active = 1
   `);
   
   const windowCheck = await db.all<{ window_start_utc: string; count: number }>(sql`
     SELECT window_start_utc, COUNT(*) as count
     FROM daily_practice_queue
     WHERE user_ref = ${userId} AND playlist_ref = ${playlistId}
       AND active = 1
     GROUP BY window_start_utc ORDER BY window_start_utc DESC
   `);
   ```

2. **Get Max Window** (Lines 225-234)
   ```typescript
   const maxWindow = await db.get<{ max_window: string }>(sql`
     SELECT MAX(window_start_utc) as max_window
     FROM daily_practice_queue
     WHERE user_ref = ${userId} AND playlist_ref = ${playlistId}
       AND active = 1
   `);
   
   const isoFormat = maxWindow?.max_window; // '2025-11-08T00:00:00'
   const spaceFormat = isoFormat?.replace("T", " "); // '2025-11-08 00:00:00'
   ```

3. **Query with GROUP BY** (Lines 246-267)
   ```sql
   SELECT 
     pls.*,
     MIN(dpq.bucket) as bucket,
     MIN(dpq.order_index) as order_index,
     MIN(dpq.completed_at) as completed_at
   FROM practice_list_staged pls
   INNER JOIN daily_practice_queue dpq 
     ON dpq.tune_ref = pls.id
     AND dpq.user_ref = pls.user_ref
     AND dpq.playlist_ref = pls.playlist_id
   WHERE dpq.user_ref = ${userId}
     AND dpq.playlist_ref = ${playlistId}
     AND dpq.active = 1
     AND dpq.completed_at IS NULL
     AND (
       dpq.window_start_utc = ${isoFormat}
       OR dpq.window_start_utc = ${spaceFormat}
     )
   GROUP BY pls.id
   ORDER BY MIN(dpq.bucket) ASC, MIN(dpq.order_index) ASC
   ```

4. **Return Rows** (Lines 269-280)
   ```typescript
   rows.forEach((row, i) => {
     console.log(`[getPracticeList] Row ${i}: tune=${row.id}, completed_at=${row.completed_at}`);
   });
   
   return rows;
   ```

### Practice List Staged VIEW

**File:** `src/lib/db/init-views.ts`  
**Lines:** 141-238

**Critical View:** Merges all data sources

```sql
CREATE VIEW IF NOT EXISTS practice_list_staged AS
SELECT
  tune.id,
  COALESCE(tune_override.title, tune.title) AS title,
  COALESCE(tune_override.type, tune.type) AS type,
  COALESCE(tune_override.mode, tune.mode) AS mode,
  playlist_tune.learned,
  
  -- COALESCE staging (table_transient_data) with historical (practice_record)
  COALESCE(td.goal, COALESCE(pr.goal, 'recall')) AS goal,
  playlist_tune.scheduled,
  playlist.user_ref,
  playlist.playlist_id,
  
  -- Latest practice state (staging OVERRIDES historical)
  COALESCE(td.state, pr.state) AS latest_state,
  COALESCE(td.practiced, pr.practiced) AS latest_practiced,
  COALESCE(td.quality, pr.quality) AS latest_quality,
  COALESCE(td.difficulty, pr.difficulty) AS latest_difficulty,
  COALESCE(td.easiness, pr.easiness) AS latest_easiness,
  COALESCE(td.stability, pr.stability) AS latest_stability,
  COALESCE(td.interval, pr.interval) AS latest_interval,
  COALESCE(td.repetitions, pr.repetitions) AS latest_repetitions,
  COALESCE(td.step, pr.step) AS latest_step,
  COALESCE(td.due, pr.due) AS latest_due,
  COALESCE(td.goal, pr.goal) AS latest_goal,
  COALESCE(td.technique, pr.technique) AS latest_technique,
  
  -- Evaluation from staging (if exists)
  td.recall_eval,
  CASE WHEN td.tune_id IS NOT NULL THEN 1 ELSE 0 END AS has_staged
  
FROM tune
INNER JOIN playlist_tune ON playlist_tune.tune_ref = tune.id
INNER JOIN playlist ON playlist.playlist_id = playlist_tune.playlist_ref
LEFT JOIN tune_override ON tune_override.tune_ref = tune.id
  AND (tune_override.user_ref IS NULL OR tune_override.user_ref = playlist.user_ref)
  
-- Latest practice_record for this tune/playlist
LEFT JOIN (
  SELECT pr.*
  FROM practice_record pr
  INNER JOIN (
    SELECT tune_ref, playlist_ref, MAX(id) as max_id
    FROM practice_record
    GROUP BY tune_ref, playlist_ref
  ) latest ON pr.tune_ref = latest.tune_ref
    AND pr.playlist_ref = latest.playlist_ref
    AND pr.id = latest.max_id
) practice_record ON practice_record.tune_ref = tune.id
  AND practice_record.playlist_ref = playlist_tune.playlist_ref
  
-- Staged/transient data (preview from evaluation staging)
LEFT JOIN table_transient_data td ON td.tune_id = tune.id
  AND td.playlist_id = playlist_tune.playlist_ref
  AND td.user_id = playlist.user_ref
```

**Key Point:** This VIEW does ALL the COALESCE operations. The grid query just filters by queue.

---

## Database Tables

### Core Tables

1. **tune** - Tune metadata (title, type, mode, structure, etc.)
2. **playlist** - User playlists
3. **playlist_tune** - Tunes in playlist (scheduled, learned)
4. **practice_record** - Historical practice events (immutable)
5. **daily_practice_queue** - Frozen daily snapshot (bucket, order_index, completed_at)
6. **table_transient_data** - Staging area for uncommitted evaluations
7. **user_profile** - Maps Supabase UUID to local integer ID

### daily_practice_queue Schema

**File:** `drizzle/schema-postgres.ts`  
**Lines:** 286-346

**Fields:**
- `id` (UUID, primary key)
- `user_ref` (UUID, references user_profile)
- `playlist_ref` (UUID, references playlist)
- `tune_ref` (UUID, references tune)
- `bucket` (integer: 1=Due Today, 2=Lapsed, 3=Backfill, 4=Old Lapsed)
- `order_index` (integer: stable ordering within bucket)
- `window_start_utc` (timestamp: start of practice window)
- `window_end_utc` (timestamp: end of practice window)
- `snapshot_coalesced_ts` (timestamp: captured scheduled/due date)
- `scheduled_snapshot` (timestamp: captured scheduled date)
- `latest_due_snapshot` (timestamp: captured latest practice date)
- `completed_at` (timestamp: when user submitted evaluation - NULL if not completed)
- `active` (boolean: 1=current queue, 0=superseded)
- ... (additional FSRS snapshot fields)

**Constraints:**
- UNIQUE (user_ref, playlist_ref, window_start_utc, tune_ref)
- Indexes on user/playlist/window/bucket/active

### practice_record Schema

**File:** `drizzle/schema-postgres.ts`  
**Lines:** 242-285

**Fields:**
- `id` (UUID, primary key)
- `playlist_ref` (UUID)
- `tune_ref` (UUID)
- `practiced` (timestamp: when evaluation was submitted)
- `quality` (integer: 1-4 rating from FSRS)
- `easiness` (real: SM2 field, NULL for FSRS)
- `interval` (integer: days until next review)
- `repetitions` (integer: successful review count)
- `due` (timestamp: next review date - ALSO stored in playlist_tune.current)
- `stability` (real: FSRS stability metric)
- `difficulty` (real: FSRS difficulty metric)
- `state` (integer: 1=Learning, 2=Review, 3=Relearning)
- `step` (integer: current step in learning sequence)
- `goal` (text: "recall", "fluency", etc.)
- `technique` (text: practice technique)
- `elapsed_days` (integer: days since last review)
- `lapses` (integer: forget events count)

**Constraints:**
- UNIQUE (tune_ref, playlist_ref, practiced)

### table_transient_data Schema

**File:** `supabase/migrations/20241101000000_initial_schema.sql`  
**Lines:** 335-360

**Fields:**
- `user_id` (UUID)
- `tune_id` (UUID)
- `playlist_id` (UUID)
- `purpose` (text)
- `recall_eval` (text: "again", "hard", "good", "easy")
- `practiced` (timestamp)
- `quality` (integer)
- `easiness` (real)
- `difficulty` (real)
- `stability` (real)
- `interval` (integer)
- `step` (integer)
- `repetitions` (integer)
- `due` (timestamp)
- `goal` (text)
- `technique` (text)
- `state` (integer)
- ... (sync metadata)

**Constraints:**
- UNIQUE (user_id, tune_id, playlist_id)

---

## Background Sync

### Automatic Sync Service

**File:** `src/lib/sync/service.ts`  
**Lines:** 269-299

**Auto Sync Strategy:**

```typescript
public startAutoSync(): void {
  // Periodic syncUp (frequent - push local changes)
  this.syncIntervalId = window.setInterval(async () => {
    const stats = await this.syncEngine.getSyncQueueStats();
    if (stats.pending > 0) {
      console.log(`[SyncService] Auto syncUp (${stats.pending} pending items)`);
      await this.syncUp();
    }
  }, 5 * 60 * 1000); // 5 minutes

  // Periodic syncDown (infrequent - pull remote changes)
  this.syncDownIntervalId = window.setInterval(() => {
    console.log("[SyncService] Running periodic syncDown...");
    void this.syncDown();
  }, 20 * 60 * 1000); // 20 minutes
}
```

### Supabase Realtime

**File:** `src/lib/sync/realtime.ts`  
**Lines:** 1-200

**Subscriptions:** Listen for changes from other devices

```typescript
export class RealtimeManager {
  public subscribe(config: RealtimeConfig): void {
    for (const tableName of config.tables) {
      const channel = this.supabase
        .channel(`public:${tableName}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: tableName,
            filter: `user_ref=eq.${this.userId}`,
          },
          (payload) => {
            console.log(`[Realtime] ${tableName} change:`, payload);
            this.handleChange(tableName, payload);
          }
        )
        .subscribe();

      this.channels.push(channel);
    }
  }

  private async handleChange(tableName: string, payload: any): Promise<void> {
    // Transform and merge into local database
    await this.syncEngine.syncDown(); // Pull latest from Supabase
    this.config.onUpdate?.(tableName, payload);
  }
}
```

---

## Key Invariants

1. **Immutability:**
   - `practice_record` rows are NEVER updated or deleted
   - `daily_practice_queue` rows remain stable throughout the day

2. **Uniqueness:**
   - `practice_record`: (tune_ref, playlist_ref, practiced) must be unique
   - `table_transient_data`: (user_id, tune_id, playlist_id) must be unique
   - `daily_practice_queue`: (user_ref, playlist_ref, window_start_utc, tune_ref) must be unique

3. **Timestamp Formats:**
   - SQLite stores as TEXT (ISO 8601: `'2025-11-08T12:00:00'`)
   - Supabase expects timestamp (also accepts ISO 8601)
   - Window keys use space format: `'2025-11-08 00:00:00'` (but may exist as ISO format too)

4. **Sync Order:**
   - ALWAYS syncUp before syncDown to prevent data loss
   - Persist to IndexedDB immediately after local changes
   - Queue all database changes for sync (never direct Supabase writes)

5. **Conflict Resolution:**
   - Last-write-wins (based on `last_modified_at` timestamp)
   - Duplicate practice_record timestamps handled by incrementing seconds

6. **UI Reactivity:**
   - `syncVersion` signal triggers resource refetch
   - Grid re-queries on sync version change
   - Completed items disappear when `completed_at IS NULL` filter applies

---

## Error Handling

### Submit Validation

**File:** `src/routes/practice/Index.tsx`  
**Lines:** 291-389

```typescript
if (!db || !playlistId || !userId) {
  toast.error("Cannot submit: Missing database or playlist data");
  return;
}

if (evaluationsCount() === 0) {
  toast.warning("No evaluations to submit");
  return;
}
```

### Sync Error Handling

**File:** `src/lib/sync/engine.ts`  
**Lines:** 219-283

```typescript
for (const item of pendingItems) {
  try {
    await this.processQueueItem(item);
    await markSynced(this.localDb, item.id!);
    synced++;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    errors.push(`Item ${item.id} (${item.tableName} ${item.operation}): ${errorMsg}`);
    await updateSyncStatus(this.localDb, item.id!, "failed", errorMsg);
    failed++;
  }
}
```

### Toast Notifications

**File:** `src/routes/practice/Index.tsx`  
**Lines:** 338-370

```typescript
if (result.success) {
  toast.success(`Successfully submitted ${result.count} evaluation(s)`, {
    duration: 3000, // Auto-dismiss after 3 seconds
  });
} else {
  toast.error(`Failed to submit: ${result.error}`, {
    duration: Number.POSITIVE_INFINITY, // Requires manual dismiss
  });
}
```

---

## Future Work

### Known Issues

1. **Dual Window Formats:**
   - Database contains both `'2025-11-08T00:00:00'` and `'2025-11-08 00:00:00'`
   - Query uses OR clause to match both
   - GROUP BY may be filtering incorrectly (only 10 rows returned instead of 15)

2. **Missing User Profile Lookup:**
   - `getDailyPracticeQueue()` expects integer user_profile.id
   - Currently receives Supabase UUID
   - Need to add user_profile.id lookup layer

### Planned Features

1. **Multi-Exposure Support:**
   - `exposures_required`, `exposures_completed` fields exist but unused
   - Support multiple passes of same tune in one session

2. **Bucket 3 & 4 (Backfill):**
   - Currently disabled
   - Enable user control over backfill quota

3. **Timezone Support:**
   - Capture timezone offset in queue generation
   - Handle mid-day timezone changes gracefully

4. **Optimistic UI:**
   - Show submitted tunes as "grayed out" instead of disappearing
   - Allow undo before sync completes

---

## Testing

### E2E Test Coverage

**File:** `e2e/tests/practice-003-submit.spec.ts`  
**Lines:** 1-150

**Key Tests:**
- Stage evaluation → verify preview in grid
- Change evaluation → verify preview updates
- Submit → verify practice_record created
- Submit → verify queue.completed_at set
- Submit → verify transient data cleared
- Show Submitted toggle → verify filtering

### Manual Testing

**File:** `_notes/practice-evaluation-staging-implementation.md`  
**Lines:** 660-690

**Checklist:**
1. Select evaluation → verify latest_* columns update
2. Change evaluation → verify preview updates (no duplicates)
3. Submit → verify practice_record, completed_at, staging cleared
4. Show Submitted toggle → verify visibility changes
5. Page reload → verify staged evaluation persists

---

## Performance Considerations

1. **Queue Generation:**
   - Runs once per day per playlist
   - Guards against empty database (waits for sync)
   - Capacity limits prevent oversized queries (max 10 tunes default)

2. **Staging:**
   - FSRS calculation is synchronous but fast (<10ms)
   - UPSERT to transient table is immediate
   - persistDb() writes to IndexedDB asynchronously

3. **Submission:**
   - Batch processes all staged evaluations
   - Each tune requires 4 database writes + 4 sync queue inserts
   - Typical session: 5-10 tunes = 40-80 operations

4. **Sync:**
   - Batched (100 items at a time)
   - Background (5min intervals for upload, 20min for download)
   - Realtime subscriptions for instant updates from other devices

5. **Grid Refresh:**
   - Triggered by syncVersion signal change
   - Re-queries practice_list_staged JOIN daily_practice_queue
   - Typical: 10-20 rows returned

---

## Summary

The practice flow follows an offline-first architecture with five distinct phases:

1. **Queue Generation** creates a frozen snapshot of tunes to practice
2. **Evaluation Staging** runs FSRS previews and stores in transient table
3. **Submission** commits evaluations to practice_record and marks queue completed
4. **Sync** uploads changes to Supabase asynchronously
5. **UI Refresh** re-queries database when sync completes

All database writes go through the sync queue to ensure offline resilience and eventual consistency with Supabase. The practice_list_staged VIEW automatically merges staging data with historical data, providing seamless preview capabilities.

---

**Document Version:** 1.0  
**Maintainer:** GitHub Copilot (per user @sboagy)
