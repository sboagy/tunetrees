# Spaced Repetition Reference

Technical reference for TuneTrees scheduling algorithms.

## Overview

TuneTrees uses the **FSRS algorithm** (Free Spaced Repetition Scheduler) for scheduling tune reviews, with SM2 as a fallback option.

## FSRS Algorithm

### Library

Uses [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) for calculations.

### Core Concepts

| Term | Description |
|------|-------------|
| **Stability** | How well you remember the item (higher = better) |
| **Difficulty** | Inherent item difficulty (0-10 scale) |
| **State** | Learning stage: New, Learning, Review, Relearning |
| **Interval** | Days until next review |

### States

```
New → Learning → Review ←→ Relearning
                    ↑___________|
                    (on lapse)
```

1. **New (0)**: Never reviewed
2. **Learning (1)**: Initial learning phase (short intervals)
3. **Review (2)**: Graduated to regular reviews
4. **Relearning (3)**: Failed review, back to learning

### Rating Scale

| Rating | Value | Effect |
|--------|-------|--------|
| Again | 1 | Forgot completely, reset to learning |
| Hard | 2 | Struggled, shorter interval |
| Good | 3 | Normal recall, scheduled interval |
| Easy | 4 | Perfect recall, longer interval |

### Calculation

```typescript
import { createEmptyCard, fsrs, Rating } from "ts-fsrs";

const f = fsrs();
const card = createEmptyCard();
const now = new Date();

// Calculate next state for each possible rating
const schedulingCards = f.repeat(card, now);

// Get result for "Good" rating
const nextCard = schedulingCards[Rating.Good].card;
console.log({
  stability: nextCard.stability,
  difficulty: nextCard.difficulty,
  interval: nextCard.scheduled_days,
  due: nextCard.due,
});
```

## Implementation

### Staging Service

**File:** `src/lib/services/practice-staging.ts`

```typescript
export async function stagePracticeEvaluation(
  db: SqliteDatabase,
  userId: string,
  playlistId: string,
  tuneId: string,
  evaluation: string,  // "again" | "hard" | "good" | "easy"
  goal: string,
  technique: string
): Promise<FSRSPreviewMetrics>
```

1. Get latest practice_record for this tune
2. Convert to FSRS Card object
3. Run FSRS calculation
4. Store preview in `table_transient_data`
5. Return preview metrics for UI

### Commit Service

**File:** `src/lib/services/practice-recording.ts`

```typescript
export async function commitStagedEvaluations(
  db: SqliteDatabase,
  userId: string,
  playlistId: string,
  windowStartUtc?: string
): Promise<{ success: boolean; count: number }>
```

1. Read staged evaluations from `table_transient_data`
2. Create `practice_record` for each
3. Update `playlist_tune.current` (next due date)
4. Mark queue items as completed
5. Clear staging data

## Database Schema

### practice_record

Immutable history of all practice events:

```sql
CREATE TABLE practice_record (
  id TEXT PRIMARY KEY,
  playlist_ref TEXT NOT NULL,
  tune_ref TEXT NOT NULL,
  practiced TEXT NOT NULL,     -- ISO timestamp
  quality INTEGER NOT NULL,    -- 1-4 rating
  interval INTEGER,            -- days until next
  repetitions INTEGER,         -- successful review count
  due TEXT,                    -- next review date
  stability REAL,              -- FSRS stability
  difficulty REAL,             -- FSRS difficulty (0-10)
  state INTEGER,               -- FSRS state
  step INTEGER,                -- learning step
  elapsed_days INTEGER,        -- days since last review
  lapses INTEGER,              -- forget count
  goal TEXT,                   -- "recall", "fluency"
  technique TEXT,              -- practice technique
  UNIQUE(tune_ref, playlist_ref, practiced)
);
```

### playlist_tune

Current scheduling state:

```sql
CREATE TABLE playlist_tune (
  playlist_ref TEXT NOT NULL,
  tune_ref TEXT NOT NULL,
  scheduled TEXT,              -- next scheduled review
  current TEXT,                -- calculated due date
  learned TEXT,                -- when marked as learned
  PRIMARY KEY (playlist_ref, tune_ref)
);
```

### daily_practice_queue

Frozen daily snapshot:

```sql
CREATE TABLE daily_practice_queue (
  id TEXT PRIMARY KEY,
  user_ref TEXT NOT NULL,
  playlist_ref TEXT NOT NULL,
  tune_ref TEXT NOT NULL,
  bucket INTEGER NOT NULL,         -- 1=Due, 2=Lapsed, 3=Backfill
  order_index INTEGER NOT NULL,    -- ordering within bucket
  window_start_utc TEXT NOT NULL,  -- practice day start
  completed_at TEXT,               -- when submitted (NULL if not done)
  -- Snapshot fields (frozen at queue creation)
  snapshot_coalesced_ts TEXT,
  scheduled_snapshot TEXT,
  latest_due_snapshot TEXT,
  UNIQUE(user_ref, playlist_ref, window_start_utc, tune_ref)
);
```

## Practice Queue Generation

**File:** `src/lib/services/practice-queue.ts`

### Buckets

| Bucket | Description | Priority |
|--------|-------------|----------|
| 1 | Due today (scheduled within window) | Highest |
| 2 | Recently lapsed (within delinquency window) | High |
| 3 | New/unscheduled tunes (backfill) | Medium |
| 4 | Old lapsed (beyond delinquency) | Low |

### Algorithm

```typescript
function generateQueue(userId, playlistId, date):
  1. Compute scheduling windows (startTs, endTs, windowFloorTs)
  2. Check if queue exists for today → return if found
  3. Query practice_list_staged VIEW for each bucket
  4. Build queue rows with bucket + order_index
  5. Insert into daily_practice_queue
  6. Return frozen queue
```

### Queue Stability

The queue is frozen for the entire day:
- New practice events update `practice_record` and `playlist_tune.scheduled`
- But `daily_practice_queue` ordering doesn't change
- Completed items marked with `completed_at`

## UI Integration

### Evaluation Flow

```
User selects "Good"
       ↓
handleRecallEvalChange()
       ↓
stagePracticeEvaluation()
       ↓
FSRS calculates preview
       ↓
Store in table_transient_data
       ↓
UI shows preview (next due, interval)
       ↓
User clicks "Submit"
       ↓
commitStagedEvaluations()
       ↓
Create practice_record
       ↓
Update playlist_tune.current
       ↓
Mark queue item completed
       ↓
Clear staging data
```

### Practice List VIEW

The `practice_list_staged` VIEW merges:
- Tune metadata
- Playlist association
- Latest practice_record
- Staged evaluation (if any)

This allows the UI to show real-time previews before commit.

## SM2 Fallback

SM2 algorithm available as alternative:

```typescript
// playlist.sr_alg_type = "sm2"
```

Uses classic SuperMemo 2 algorithm with EF (easiness factor).

---

For practice flow details, see [practice_flow.md](../practice_flow.md).
