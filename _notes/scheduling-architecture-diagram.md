# TuneTrees Practice & Scheduling Architecture

**Created:** 2025-11-20  
**Purpose:** High-level architecture diagram showing core scheduling mechanism components

## Architecture Overview

```mermaid
graph TB
    subgraph "User Interface"
        UI[Practice Page UI<br/>SolidJS Components]
    end

    subgraph "Core Services (Client-Side)"
        QG[queue-generator.ts<br/>🎯 QUEUE GENERATION<br/>Creates frozen daily snapshot]
        PS[practice-staging.ts<br/>🔮 PREVIEW CALCULATIONS<br/>FSRS staging on dropdown]
        PR[practice-recording.ts<br/>💾 COMMIT EVALUATIONS<br/>Create practice_record]
        PQ[practice-queue.ts<br/>📋 QUEUE MANAGEMENT<br/>Bucket classification logic]
        FS[fsrs-service.ts<br/>🧮 FSRS ALGORITHM<br/>Calculates intervals/due dates]
    end

    subgraph "Local Storage (SQLite WASM)"
        DB[(SQLite Database<br/>IndexedDB-backed)]
        PT[playlist_tune<br/>next review dates]
        PRE[practice_record<br/>history + FSRS metrics]
        DPQ[daily_practice_queue<br/>frozen snapshot]
        TTD[table_transient_data<br/>staging preview]
    end

    subgraph "Sync Layer"
        SQ[Sync Queue<br/>queueSync()]
        SE[Sync Engine<br/>Bidirectional sync]
    end

    subgraph "Remote Storage"
        SP[(Supabase PostgreSQL)]
    end

    %% User initiates practice
    UI -->|"1. Load /practice"| QG
    UI -->|"2. Select evaluation"| PS
    UI -->|"3. Click Submit"| PR

    %% Queue Generation Flow
    QG -->|Uses| PQ
    PQ -->|Query| DB
    PQ -->|Classify into buckets| DPQ
    QG -->|Generate snapshot| DPQ
    DPQ -->|Queue sync| SQ

    %% Staging Flow (Preview)
    PS -->|Get latest| PRE
    PS -->|Calculate| FS
    FS -->|FSRS algorithm| PS
    PS -->|UPSERT staging| TTD
    TTD -->|Queue sync| SQ
    UI -->|Read preview| TTD

    %% Recording Flow (Commit)
    PR -->|Read staged| TTD
    PR -->|Calculate final| FS
    PR -->|INSERT| PRE
    PR -->|UPDATE current| PT
    PR -->|Mark completed| DPQ
    PR -->|DELETE staging| TTD
    PRE -->|Queue sync| SQ
    PT -->|Queue sync| SQ

    %% Sync Flow
    SQ -->|Background| SE
    SE <-->|Bidirectional| SP

    %% Return to UI
    DB -->|Reactive queries| UI

    style QG fill:#e1f5ff
    style PS fill:#fff4e1
    style PR fill:#e8f5e9
    style PQ fill:#f3e5f5
    style FS fill:#ffe0e0
    style DB fill:#f0f0f0
    style SP fill:#e3f2fd
```

## Component Responsibilities

### 1. **queue-generator.ts** 🎯 Queue Generation
**Purpose:** Creates frozen daily practice snapshot

**Key Functions:**
- `generateDailyQueue()` - Build queue for today's practice session
- Bucket classification (1=Due, 2=Lapsed, 3=New, 4=Old Lapsed)
- Ordering within buckets by due date / priority

**Outputs:**
- Rows in `daily_practice_queue` table
- Stable ordering that doesn't change during practice session

**When Called:** 
- On page load if queue doesn't exist for today
- On manual regeneration

---

### 2. **practice-staging.ts** 🔮 Preview Calculations
**Purpose:** FSRS preview when user selects evaluation dropdown

**Key Functions:**
- `stagePracticeEvaluation()` - Calculate FSRS metrics for preview
- Maps evaluation text → FSRS Rating (Again/Hard/Good/Easy)
- Applies minimum next-day constraint

**Outputs:**
- UPSERT to `table_transient_data` (temporary staging)
- Preview metrics shown in grid (stability, due date, interval)

**When Called:**
- Every time user selects an evaluation dropdown
- Before submission (shows "what if" preview)

---

### 3. **practice-recording.ts** 💾 Commit Evaluations
**Purpose:** Finalize and persist practice ratings

**Key Functions:**
- `commitStagedEvaluations()` - Main commit function
- `recordPracticeRating()` - Single tune recording
- Handles duplicate practice timestamps (increments by 1 second)

**Outputs:**
- INSERT into `practice_record` (permanent history)
- UPDATE `playlist_tune.current` (next review date)
- UPDATE `daily_practice_queue.completed_at` (mark done)
- DELETE from `table_transient_data` (clear staging)

**When Called:**
- User clicks "Submit" button
- Processes all staged evaluations in batch

---

### 4. **practice-queue.ts** 📋 Queue Management
**Purpose:** Bucket classification and queue utilities

**Key Functions:**
- `computeSchedulingWindows()` - Calculate day boundaries (UTC)
- `classifyQueueBucket()` - Determine bucket 1/2/3/4
- `generateOrGetPracticeQueue()` - Main orchestrator

**Bucket Logic:**
- **Q1 (Due Today):** scheduled ∈ [startOfDay, endOfDay)
- **Q2 (Recently Lapsed):** scheduled ∈ [windowFloor, startOfDay) — 0-7 days overdue
- **Q3 (New/Unscheduled):** never scheduled, no practice history
- **Q4 (Old Lapsed):** scheduled < windowFloor — >7 days overdue

**When Called:**
- By `queue-generator.ts` during queue generation
- Provides reusable bucket classification logic

---

### 5. **fsrs-service.ts** 🧮 FSRS Algorithm
**Purpose:** Core spaced repetition calculations

**Key Functions:**
- `processFirstReview()` - Handle new cards (state=New)
- `processReview()` - Handle repeat reviews (state=Learning/Review)
- `createPracticeRecord()` - Build practice_record from FSRS output
- `getPreviewSchedules()` - Calculate all 4 rating options

**FSRS Outputs:**
- `nextDue` - Next review date
- `stability` - Memory strength metric
- `difficulty` - Card difficulty metric
- `interval` - Days until next review
- `state` - Learning state (0=New, 1=Learning, 2=Review, 3=Relearning)

**When Called:**
- By `practice-staging.ts` for previews
- By `practice-recording.ts` for final commits

---

## Data Flow Summary

### 🌅 Morning: Queue Generation
```
User opens /practice
  → queue-generator creates frozen snapshot
  → Uses practice-queue bucket logic
  → Queries practice_list_staged VIEW
  → Inserts daily_practice_queue rows
  → UI displays ordered grid
```

### 🎵 During Practice: Staging
```
User selects "Good" for Tune A
  → practice-staging calls fsrs-service
  → FSRS calculates preview metrics
  → UPSERT to table_transient_data
  → UI re-queries and shows preview
```

### ✅ End of Practice: Commit
```
User clicks "Submit"
  → practice-recording reads table_transient_data
  → Calls fsrs-service for final calculations
  → INSERT practice_record
  → UPDATE playlist_tune.current
  → UPDATE daily_practice_queue.completed_at
  → DELETE table_transient_data
  → Sync queue triggers background upload
```

### 🔄 Background: Sync
```
Sync engine processes queue
  → Upload changes to Supabase PostgreSQL
  → Download changes from other devices
  → Merge with local SQLite
  → UI reactively updates via signals
```

---

## Key Constraints & Patterns

### Minimum Next-Day Enforcement
**File:** `src/lib/utils/practice-date.ts` → `ensureMinimumNextDay()`

```typescript
// Prevents same-day scheduling (causes "today" loop bug)
if (daysDiff < 1) {
  return new Date(referenceDate.getTime() + (25 * 60 * 60 * 1000)); // +25 hours
}
```

**Why 25 hours?** 24h + 1h buffer to guarantee next day even after render delays.

**Applied in:**
- `practice-staging.ts` line 167 (preview calculations)
- Ensures FSRS output never schedules for same day

### Frozen Queue Snapshot
**Pattern:** Queue generated once per day, remains stable

**Why?** Prevents tunes from appearing/disappearing mid-practice as evaluations change due dates.

**Implementation:**
- `daily_practice_queue.window_start_utc` groups by day
- `completed_at` tracks which tunes finished (not deleted)
- Grid filters to incomplete tunes

### Staging → Commit Flow
**Pattern:** Two-phase commit (preview, then persist)

**Phase 1 - Staging:**
- User selects dropdown → UPSERT `table_transient_data`
- Grid shows preview via COALESCE in `practice_list_staged` VIEW
- No permanent changes yet

**Phase 2 - Commit:**
- User clicks Submit → INSERT `practice_record`
- UPDATE permanent fields (`playlist_tune.current`)
- DELETE staging data
- All-or-nothing batch operation

---

## File Size & Complexity

| File | Lines | Complexity | Purpose |
|------|-------|------------|---------|
| `fsrs-service.ts` | ~330 | Medium | Pure FSRS algorithm wrapper |
| `practice-queue.ts` | ~820 | High | Bucket classification, windows |
| `queue-generator.ts` | ~350 | Medium | Queue creation logic |
| `practice-staging.ts` | ~260 | Low | Simple FSRS preview |
| `practice-recording.ts` | ~710 | High | Batch commit, duplicate handling |

**Total LOC:** ~2,470 lines of core scheduling logic

---

## Common Operations

### "How do I add a tune to today's queue?"
1. INSERT into `playlist_tune` (via repertoire management)
2. Set `scheduled = NOW()` to make it "due today"
3. Regenerate queue OR wait for next day's queue generation
4. Tune appears in Q1 (Due Today) bucket

### "How does FSRS calculate the next review date?"
1. Get latest `practice_record` for tune (previous FSRS state)
2. Reconstruct FSRS `Card` from record (stability, difficulty, state)
3. Call `fsrs.repeat(card, now)` with user's rating
4. Extract `nextCard.due` from result
5. Apply `ensureMinimumNextDay()` constraint
6. Return adjusted due date (minimum next day)

### "What happens if I practice the same tune twice in one day?"
**Prevented by queue design:**
- Queue frozen at start of day
- Once `completed_at` is set, tune removed from UI
- Cannot evaluate same tune twice in same queue session

**If forced via API:**
- `practice_record` has unique constraint on `(tune_ref, playlist_ref, practiced)`
- `practice-recording.ts` increments `practiced` by 1 second if duplicate detected

### "Why does 'Easy' sometimes not advance the date far enough?"
**Root Cause (Hypothesis):**
- Bug may be in FSRS parameter configuration (weights, retention target)
- Or in how previous practice history is reconstructed into FSRS `Card`
- Or in `ensureMinimumNextDay()` logic (though this only affects same-day, not multi-day)

**To Debug:**
1. Check FSRS weights in user preferences
2. Verify `practice_record` history is correct
3. Log FSRS `Card` input before calling `fsrs.repeat()`
4. Log raw FSRS output before `ensureMinimumNextDay()`
5. Compare to expected FSRS intervals from algorithm spec

---

## Testing Strategy

### Unit Tests
- `fsrs-service.ts`: Mock ts-fsrs library, test quality mapping
- `practice-queue.ts`: Test bucket classification with known dates
- `ensureMinimumNextDay()`: Test edge cases (midnight, timezone shifts)

### Integration Tests
- Staging → Commit flow (full round-trip)
- Queue generation → practice → submission
- Duplicate practice timestamp handling

### E2E Tests (This PR)
- Multi-day scenarios with clock control
- FSRS interval progression (Again/Hard/Good/Easy)
- Queue regeneration across day boundaries
- "Repeated Easy" bug reproduction

---

## References

- **FSRS Algorithm:** https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
- **ts-fsrs Library:** https://github.com/open-spaced-repetition/ts-fsrs
- **Practice Flow Sequence:** `docs/practice_flow.md` (detailed Mermaid diagram)
- **Test Plan:** `_notes/scheduling-comprehensive-test-plan.md`
