# Phase 3: Practice Session Management (PWA Architecture)

**Created:** January 10, 2025  
**Status:** Draft - Revised Plan  
**Dependencies:** Phase 2 (Tune Management + Sync Layer Complete)  
**Duration:** 2-3 weeks

---

## Key Insight: Client-Side Practice Logic

**The PWA rewrite moves ALL practice logic to the browser.** There are no server-side practice endpoints. Everything runs locally with SQLite WASM + ts-fsrs, then syncs to Supabase as a background operation.

### What Changed from Legacy

| Legacy (Next.js/Python)                       | PWA (SolidJS/WASM)               |
| --------------------------------------------- | -------------------------------- |
| Server endpoints process practice submissions | Client-side FSRS calculations    |
| Backend builds practice queue                 | Client queries local SQLite      |
| Server-side scheduling algorithms             | `ts-fsrs` library in browser     |
| API calls for every practice action           | Local SQLite writes + async sync |
| Complex FastAPI routes                        | Simple Supabase sync layer       |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              Browser (SolidJS App)                      │
├─────────────────────────────────────────────────────────┤
│  Practice UI                                            │
│    ↓                                                    │
│  Practice Service (queries local SQLite)                │
│    ↓                                                    │
│  FSRS Service (ts-fsrs calculations)                    │
│    ↓                                                    │
│  SQLite WASM (practice_record, daily_practice_queue)    │
│    ↓                                                    │
│  Sync Queue (background worker)                         │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ↓
                  ┌────────────────┐
                  │    Supabase    │
                  │  (PostgreSQL)  │
                  └────────────────┘
```

**Key Principles:**

- ✅ All practice logic runs **client-side** (offline-first)
- ✅ FSRS calculations happen in the **browser** (ts-fsrs library)
- ✅ Practice queue built from **local SQLite** queries
- ✅ Rating submissions save **locally first**, then sync later
- ✅ No server-side practice endpoints needed

---

## Prerequisites (Already Complete ✅)

From earlier Phase 3 work:

1. ✅ **ts-fsrs installed** (v5.2.3)
2. ✅ **Practice schema defined** (Drizzle: `practice_record`, `prefs_spaced_repetition`, `daily_practice_queue`)
3. ✅ **TypeScript types created** (`PracticeRecord`, `FSRSRating`, `FSRSState`, etc.)
4. ✅ **FSRS Service implemented** (`src/lib/scheduling/fsrs-service.ts`)
5. ✅ **Database migration complete** (435 queue records + 3 views in Supabase)
6. ✅ **Sync layer ready** (from Phase 2: `queueSync()`, background worker)

---

## Phase 3 Tasks (Revised)

### Task 1: Practice Queue Service ⏳ NEXT

**File:** `src/lib/db/queries/practice.ts`

**Purpose:** Query local SQLite to build the practice queue (replaces legacy `query_practice_list_scheduled()`)

**Functions to implement:**

```typescript
/**
 * Get due tunes for practice session
 * Replaces: legacy/tunetrees/app/queries.py#query_practice_list_scheduled
 */
export async function getDueTunes(
  db: SqliteDatabase,
  playlistId: number,
  sitdownDate: Date,
  delinquencyWindowDays: number = 7
): Promise<PracticeQueueEntry[]> {
  // Query practice_list_joined view (or join tables)
  // COALESCE(playlist_tune.scheduled, latest_due) for next review
  // Filter: due date within [sitdownDate - window, sitdownDate]
  // Order by: bucket (1=Due Today, 2=Recently Lapsed, 3=Backfill)
  // Return enriched tune + scheduling info
}

/**
 * Get daily practice queue snapshot
 * Uses daily_practice_queue table for frozen daily plan
 */
export async function getDailyPracticeQueue(
  db: SqliteDatabase,
  userId: string,
  playlistId: number,
  queueDate: string
): Promise<DailyPracticeQueue[]> {
  // Query daily_practice_queue WHERE window includes queueDate
  // Return active queue entries with bucket classification
}

/**
 * Get latest practice record for a tune
 * Used by FSRS to retrieve history for scheduling
 */
export async function getLatestPracticeRecord(
  db: SqliteDatabase,
  tuneId: number,
  playlistId: number
): Promise<PracticeRecord | null> {
  // SELECT * FROM practice_record
  // WHERE tune_ref = tuneId AND playlist_ref = playlistId
  // ORDER BY practiced DESC LIMIT 1
}

/**
 * Get user's FSRS preferences
 */
export async function getUserPreferences(
  db: SqliteDatabase,
  userId: string
): Promise<PrefsSpacedRepetition | null> {
  // SELECT * FROM prefs_spaced_repetition WHERE user_id = userId
}

/**
 * Get practice history for a tune (for history view)
 */
export async function getPracticeHistory(
  db: SqliteDatabase,
  tuneId: number,
  playlistId: number
): Promise<PracticeRecordWithTune[]> {
  // SELECT * FROM practice_record with JOIN to tunes
  // WHERE tune_ref = tuneId AND playlist_ref = playlistId
  // ORDER BY practiced DESC
}
```

**Reference:** `legacy/tunetrees/app/queries.py` (lines 287-500) for business logic

---

### Task 2: Practice Recording Service

**File:** `src/lib/services/practice-recording.ts` (new)

**Purpose:** Handle practice rating submissions (replaces legacy `update_practice_feedbacks()`)

**Core function:**

```typescript
/**
 * Record a practice rating
 * Replaces: legacy/tunetrees/app/schedule.py#update_practice_feedbacks
 */
export async function recordPracticeRating(
  db: SqliteDatabase,
  input: {
    tuneId: number;
    playlistId: number;
    userId: string;
    rating: FSRSRating; // 1=Again, 2=Hard, 3=Good, 4=Easy
    sitdownDate: Date;
    goal?: string; // 'recall', 'fluency', etc.
    technique?: string;
  }
): Promise<NextReviewSchedule> {
  // 1. Get user's FSRS preferences
  const prefs = await getUserPreferences(db, input.userId);

  // 2. Get latest practice record for this tune
  const latestRecord = await getLatestPracticeRecord(
    db,
    input.tuneId,
    input.playlistId
  );

  // 3. Initialize FSRS service with prefs
  const fsrsService = new FSRSService(prefs);

  // 4. Calculate next review schedule
  let nextSchedule: NextReviewSchedule;

  if (!latestRecord || input.goal !== "recall") {
    // First review OR non-recall goal
    if (input.goal && input.goal !== "recall") {
      // Use goal-based heuristic
      nextSchedule = fsrsService.calculateGoalSpecificDue({
        rating: input.rating,
        goal: input.goal,
        technique: input.technique,
        practiced: input.sitdownDate,
        previousRepetitions: latestRecord?.repetitions ?? 0,
      });
    } else {
      // First FSRS review
      nextSchedule = fsrsService.processFirstReview({
        rating: input.rating,
        practiced: input.sitdownDate,
      });
    }
  } else {
    // Repeat review with history
    nextSchedule = fsrsService.processReview({
      rating: input.rating,
      card: {
        due: new Date(latestRecord.due),
        stability: latestRecord.stability ?? 0,
        difficulty: latestRecord.difficulty ?? 0,
        elapsed_days: latestRecord.elapsed_days ?? 0,
        scheduled_days: latestRecord.interval ?? 0,
        reps: latestRecord.repetitions ?? 0,
        lapses: latestRecord.lapses ?? 0,
        state: latestRecord.state ?? 0,
        last_review: new Date(latestRecord.practiced),
      },
      now: input.sitdownDate,
    });
  }

  // 5. Create new practice_record in local SQLite
  const newRecord: NewPracticeRecord = {
    playlist_ref: input.playlistId,
    tune_ref: input.tuneId,
    practiced: input.sitdownDate.toISOString(),
    quality: input.rating,
    due: nextSchedule.nextDue.toISOString(),
    interval: nextSchedule.scheduled_days,
    stability: nextSchedule.stability,
    difficulty: nextSchedule.difficulty,
    state: nextSchedule.state,
    repetitions: nextSchedule.reps,
    lapses: nextSchedule.lapses,
    elapsed_days: nextSchedule.elapsed_days,
    goal: input.goal ?? "recall",
    technique: input.technique,
    sync_version: 0,
    last_modified_at: new Date().toISOString(),
    device_id: getDeviceId(), // From auth context
  };

  await db.insert(practiceRecords).values(newRecord);

  // 6. Queue for Supabase sync
  await queueSync(db, "practice_record", newRecord.id!, "insert", newRecord);

  // 7. Update playlist_tune.scheduled (next review date)
  await db
    .update(playlistTunes)
    .set({
      current: nextSchedule.nextDue.toISOString(),
      last_modified_at: new Date().toISOString(),
    })
    .where(
      and(
        eq(playlistTunes.playlist_ref, input.playlistId),
        eq(playlistTunes.tune_ref, input.tuneId)
      )
    );

  await queueSync(
    db,
    "playlist_tune",
    `${input.playlistId}-${input.tuneId}`,
    "update",
    {
      scheduled: nextSchedule.nextDue.toISOString(),
    }
  );

  return nextSchedule;
}
```

**Reference:** `legacy/tunetrees/app/schedule.py` (lines 726-850) - `_process_single_tune_feedback()`

---

### Task 3: Practice Session UI

**File:** `src/routes/practice.tsx`

**Purpose:** Practice session page with queue display and rating buttons

**Components:**

```tsx
export default function PracticePage() {
  const params = useParams();
  const playlistId = () => Number(params.playlistId);

  // Load practice queue from local SQLite
  const [queue] = createResource(async () => {
    const db = getDb(); // Get SQLite instance
    return await getDueTunes(db, playlistId(), new Date());
  });

  // Current tune being practiced
  const [currentIndex, setCurrentIndex] = createSignal(0);
  const currentTune = () => queue()?.[currentIndex()];

  // Handle rating submission
  const handleRating = async (rating: FSRSRating) => {
    const db = getDb();
    const tune = currentTune();
    if (!tune) return;

    const nextSchedule = await recordPracticeRating(db, {
      tuneId: tune.tune_ref,
      playlistId: playlistId(),
      userId: useAuth().user()?.id!,
      rating,
      sitdownDate: new Date(),
      goal: "recall",
    });

    // Show preview of next due date
    console.log("Next review:", nextSchedule.nextDue);

    // Move to next tune
    setCurrentIndex((i) => i + 1);
  };

  return (
    <div class="practice-session">
      <Show when={currentTune()} fallback={<p>No tunes due!</p>}>
        <h2>{currentTune()!.title}</h2>
        <p>Type: {currentTune()!.type}</p>

        {/* Rating buttons */}
        <div class="rating-buttons">
          <button onClick={() => handleRating(1)}>Again</button>
          <button onClick={() => handleRating(2)}>Hard</button>
          <button onClick={() => handleRating(3)}>Good</button>
          <button onClick={() => handleRating(4)}>Easy</button>
        </div>

        <p>
          Progress: {currentIndex() + 1} / {queue()?.length}
        </p>
      </Show>
    </div>
  );
}
```

**Port from:** `legacy/frontend/app/(main)/pages/practice/` (UI patterns only, not server actions)

---

### Task 4: Practice Queue Generation (Daily Snapshot)

**File:** `src/lib/services/queue-generator.ts` (new)

**Purpose:** Build daily practice queue snapshot (replaces backend queue generation)

```typescript
/**
 * Generate daily practice queue snapshot
 * Runs client-side, stores in daily_practice_queue table
 */
export async function generateDailyQueue(
  db: SqliteDatabase,
  userId: string,
  playlistId: number,
  queueDate: Date
): Promise<void> {
  // 1. Get user preferences (capacity, delinquency window)
  const prefs = await getUserPreferences(db, userId);

  // 2. Query due tunes
  const dueTunes = await getDueTunes(
    db,
    playlistId,
    queueDate,
    prefs.delinquency_window
  );

  // 3. Classify into buckets (1=Due Today, 2=Recently Lapsed, 3=Backfill)
  const buckets = classifyTunes(dueTunes, queueDate, prefs.delinquency_window);

  // 4. Insert into daily_practice_queue
  for (const [bucket, tunes] of Object.entries(buckets)) {
    for (let i = 0; i < tunes.length; i++) {
      const tune = tunes[i];
      await db.insert(dailyPracticeQueue).values({
        user_ref: userId,
        playlist_ref: playlistId,
        window_start_utc: startOfDay(queueDate).toISOString(),
        window_end_utc: endOfDay(queueDate).toISOString(),
        tune_ref: tune.tune_ref,
        bucket: Number(bucket),
        order_index: i,
        snapshot_coalesced_ts: tune.due,
        generated_at: new Date().toISOString(),
        // ... other snapshot fields
      });
    }
  }

  // 5. Queue for sync
  await queueSync(
    db,
    "daily_practice_queue",
    `${userId}-${playlistId}-${queueDate}`,
    "insert"
  );
}
```

---

### Task 5: Practice History View

**File:** `src/routes/practice/history.tsx`

**Purpose:** Display practice history table

```tsx
export default function PracticeHistoryPage() {
  const [history] = createResource(async () => {
    const db = getDb();
    return await getPracticeHistory(db, tuneId, playlistId);
  });

  const table = createSolidTable({
    get data() {
      return history() ?? [];
    },
    columns: [
      { accessorKey: "practiced", header: "Date" },
      { accessorKey: "quality", header: "Rating" },
      { accessorKey: "stability", header: "Stability" },
      { accessorKey: "difficulty", header: "Difficulty" },
      { accessorKey: "due", header: "Next Review" },
    ],
  });

  return <Table table={table} />;
}
```

---

### Task 6: Testing & Validation

**Tests to write:**

1. **Unit Tests** (`src/lib/db/queries/practice.test.ts`):

   - `getDueTunes()` returns correct tunes based on due dates
   - `recordPracticeRating()` creates correct practice_record
   - FSRS calculations match expected intervals

2. **E2E Tests** (Playwright):
   - User loads practice page → sees due tunes
   - User rates a tune → sees next tune
   - User completes session → queue clears
   - Offline mode: practice works without internet
   - Sync: changes appear in Supabase after sync

**Reference:** `legacy/frontend/tests/test-practice-*.spec.ts` for scenarios

---

## Key Differences from Legacy

| Aspect                  | Legacy                        | PWA                                |
| ----------------------- | ----------------------------- | ---------------------------------- |
| **Queue Building**      | Server-side Python query      | Client-side SQLite query           |
| **FSRS Calculations**   | Server-side Python `fsrs` lib | Client-side `ts-fsrs`              |
| **Practice Submission** | POST to `/submit_feedbacks`   | Local SQLite write + sync queue    |
| **Data Source**         | PostgreSQL via FastAPI        | SQLite WASM (synced from Supabase) |
| **Offline Support**     | None                          | Full offline practice              |
| **Sync**                | N/A (always online)           | Background worker syncs later      |

---

## Success Criteria

✅ **Phase 3 Complete When:**

1. User can see practice queue (due tunes from local SQLite)
2. User can rate tunes (Again/Hard/Good/Easy)
3. FSRS calculates next review dates correctly
4. Practice records save to local SQLite
5. Changes sync to Supabase automatically
6. Practice history view displays past sessions
7. All E2E tests passing
8. Works offline (no internet required for practice)

---

## Migration Notes

**What NOT to port from legacy:**

- ❌ FastAPI routes (`tunetrees/api/tunetrees.py`)
- ❌ Server-side scheduling functions
- ❌ Backend queue generation logic
- ❌ SQLAlchemy ORM queries

**What TO port:**

- ✅ Business logic patterns (bucket classification, goal-based scheduling)
- ✅ FSRS parameter calculations (already in `ts-fsrs`)
- ✅ Queue ordering rules
- ✅ UI component layouts

---

## Timeline Estimate

| Task                          | Duration | Status  |
| ----------------------------- | -------- | ------- |
| 1. Practice Queue Service     | 2-3 days | 🔜 Next |
| 2. Practice Recording Service | 2-3 days | Pending |
| 3. Practice Session UI        | 3-4 days | Pending |
| 4. Queue Generation           | 2 days   | Pending |
| 5. History View               | 1-2 days | Pending |
| 6. Testing                    | 2-3 days | Pending |

**Total:** ~2-3 weeks

---

**Document Status:** Draft - Ready for Review  
**Next Action:** Review with user, then implement Task 1 (Practice Queue Service)
