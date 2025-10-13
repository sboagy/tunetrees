# Context Transfer: Practice Tab - Next Implementation Phase

**Date:** October 12, 2025  
**Branch:** `feat/pwa1`  
**Status:** Practice tab UI complete, toolbar functionality needs implementation

---

## Current State Summary

### ✅ Completed (UI Layer)

**Practice Tab Grid (`TunesGridScheduled`)**

- ✅ Grid rendering with virtual scrolling
- ✅ Column visibility, sorting, resizing, reordering
- ✅ Sticky headers with shared styling (46px toolbar, 48.5px headers)
- ✅ RecallEvalComboBox component (easy/good/hard/again dropdown)
- ✅ Goal selection dropdown (recall/perform)
- ✅ Bucket column (Due Today/Overdue badges)
- ✅ Scheduled column (overdue indicators like "5d overdue")
- ✅ Evaluation count tracking
- ✅ Empty states and footer

**Practice Toolbar (`PracticeControlBanner`)**

- ✅ Submit button (enabled when evaluations > 0, shows count badge)
- ✅ Display Submitted toggle (eye icon, green when active)
- ✅ Add Tunes button (purple, opens dialog - not implemented)
- ✅ Queue dropdown (Today/Yesterday/Tomorrow/Custom Date/Reset - not implemented)
- ✅ Flashcard Mode toggle (orange when active - not implemented)
- ✅ Columns menu (working, reuses ColumnVisibilityMenu)
- ✅ History button (placeholder - not implemented)

**Shared Styling System**

- ✅ `shared-toolbar-styles.ts` - Centralized toolbar constants (all 3 tabs use same styles)
- ✅ `shared-grid-styles.ts` - Centralized grid header constants
- ✅ Consistent heights: 46px toolbars, 48.5px headers
- ✅ 2px contrasting border between toolbar and headers
- ✅ All tabs (Practice/Repertoire/Catalog) visually consistent

**Sync Optimization**

- ✅ Conditional syncUp (only runs when pending changes exist)
- ✅ `getSyncQueueStats()` for monitoring queue
- ✅ `forceSyncDown()` in AuthContext (manual sync button in TopNav)
- ✅ Comprehensive logging for sync operations

**Documentation**

- ✅ `TOOLBAR_STYLES_SUMMARY.md` - Toolbar standardization
- ✅ `GRID_STYLING_FIX.md` - Grid header fixes
- ✅ `practice-tab-implementation-complete.md` - Practice tab UI details
- ✅ `STYLING_GUIDE.md` - Grid styling guide

---

## ⚠️ NOT Yet Implemented (Business Logic)

### Critical Missing Functionality

**1. Submit Evaluations (HIGH PRIORITY)**

- **File:** `src/routes/practice/Index.tsx` - `handleSubmitEvaluations()`
- **Current:** Placeholder that just logs to console
- **Needs:**
  - Save staged evaluations to `practice_record` table
  - Update `last_practiced_date` in tune records
  - Calculate new `scheduled_date` using FSRS algorithm
  - Clear evaluation state after successful submit
  - Queue sync to Supabase
  - Show success/error feedback to user

**2. Display Submitted Toggle**

- **File:** `src/routes/practice/Index.tsx` - `handleShowSubmittedChange()`
- **Current:** State changes but no filtering applied
- **Needs:**
  - Filter grid to show/hide already-submitted evaluations for today
  - Query practice records to identify submitted tunes
  - Update grid data source based on toggle state

**3. Add Tunes to Queue**

- **File:** `src/components/practice/PracticeControlBanner.tsx` - "Add Tunes" button
- **Current:** Placeholder that logs to console
- **Needs:**
  - Open dialog/modal to select tunes from repertoire
  - Allow multi-select from repertoire list
  - Add selected tunes to practice queue (create practice_record entries)
  - Set initial `scheduled_date` to today
  - Refresh grid after adding

**4. Queue Date Filtering**

- **File:** `src/components/practice/PracticeControlBanner.tsx` - Queue dropdown
- **Current:** Dropdown UI exists but options don't filter
- **Needs:**
  - Filter grid by selected date (Today/Yesterday/Tomorrow)
  - Custom Date picker integration
  - Reset to default (Today) option
  - Update query in `src/lib/db/queries/practice.ts`

**5. Flashcard Mode**

- **File:** `src/components/practice/PracticeControlBanner.tsx` - Flashcard toggle
- **Current:** State changes, logs to console
- **Needs:**
  - Switch grid view to flashcard interface
  - Create flashcard component (show tune name, reveal ABC notation/notes)
  - Navigate through tunes with keyboard (spacebar to reveal, arrow keys)
  - Still track evaluations in flashcard mode
  - Toggle back to grid view

**6. Practice History**

- **File:** `src/components/practice/PracticeControlBanner.tsx` - History button
- **Current:** Placeholder
- **Needs:**
  - Open history modal/page showing past practice sessions
  - Query `practice_record` table grouped by date
  - Show tunes practiced, evaluations given, dates
  - Allow filtering by date range
  - Link to individual tune practice history

**7. Recall Evaluation Persistence**

- **File:** `src/components/grids/TunesGridScheduled.tsx` - `handleRecallEvalChange()`
- **Current:** Passed to parent but not persisted
- **Needs:**
  - Stage evaluation locally (in-memory or temp table)
  - Track which tunes have evaluations set
  - Update evaluation count badge
  - Prevent duplicate evaluations for same tune
  - Clear staging after submit

**8. Goal Change Persistence**

- **File:** `src/routes/practice/Index.tsx` - `handleGoalChange()`
- **Current:** Placeholder that logs to console
- **Needs:**
  - Update `goal` field in `practice_record` table
  - Queue sync to Supabase
  - Immediate UI feedback (dropdown shows selected value)

---

## Database Schema Considerations

**Practice Record Table** (`practice_record`)

```sql
CREATE TABLE practice_record (
  id INTEGER PRIMARY KEY,
  tune_ref INTEGER NOT NULL,
  user_ref INTEGER NOT NULL,
  scheduled_date TEXT,           -- ISO date when tune is due
  last_practiced_date TEXT,      -- ISO date of last practice
  recall_eval TEXT,              -- 'easy', 'good', 'hard', 'again'
  incipit TEXT,
  goal TEXT,                     -- 'recall', 'perform'
  -- FSRS fields
  stability REAL,
  difficulty REAL,
  elapsed_days INTEGER,
  scheduled_days INTEGER,
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  state INTEGER DEFAULT 0,       -- 0=New, 1=Learning, 2=Review, 3=Relearning
  last_review TEXT,
  FOREIGN KEY (tune_ref) REFERENCES tune(id),
  FOREIGN KEY (user_ref) REFERENCES user_profile(id)
);
```

**Key Fields for Implementation:**

- `recall_eval` - Set by RecallEvalComboBox, used in Submit
- `scheduled_date` - Calculated by FSRS after evaluation
- `last_practiced_date` - Set to today on Submit
- `goal` - Set by Goal dropdown
- FSRS fields (`stability`, `difficulty`, etc.) - Updated by FSRS algorithm

---

## FSRS Integration Points

**FSRS Library:** `ts-fsrs` (already installed)

**Key Functions Needed:**

```typescript
import { fsrs, Rating, State } from "ts-fsrs";

// Initialize FSRS scheduler
const f = fsrs();

// Calculate next review date based on rating
const card = {
  due: new Date(),
  stability: 0,
  difficulty: 0,
  elapsed_days: 0,
  scheduled_days: 0,
  reps: 0,
  lapses: 0,
  state: State.New,
  last_review: new Date(),
};

// Map recall_eval to FSRS Rating
const ratingMap = {
  again: Rating.Again, // 1
  hard: Rating.Hard, // 2
  good: Rating.Good, // 3
  easy: Rating.Easy, // 4
};

// Get scheduling info
const scheduling_info = f.repeat(card, now);
const selectedGrade = scheduling_info[ratingMap["good"]];

// Update card with new values
const updatedCard = selectedGrade.card;
// updatedCard.due is next scheduled_date
// updatedCard.stability, difficulty, etc. are new FSRS values
```

**Files to Modify:**

- Create `src/lib/scheduling/fsrs.ts` - FSRS helper functions
- Update `src/routes/practice/Index.tsx` - Call FSRS on submit
- Update `src/lib/db/queries/practice.ts` - Save FSRS fields

---

## Implementation Priority

### Phase 1: Core Evaluation Flow (HIGHEST)

1. **Submit Evaluations** - Make the Submit button actually work

   - Save to database
   - Calculate next review dates with FSRS
   - Clear evaluations after submit
   - Update grid

2. **Recall Evaluation Staging** - Track pending evaluations
   - Store in component state or temp structure
   - Update count badge
   - Prevent duplicates

### Phase 2: Queue Management

3. **Add Tunes to Queue** - Grow the practice queue

   - Dialog to select from repertoire
   - Create practice records
   - Refresh grid

4. **Queue Date Filtering** - View different days
   - Today/Yesterday/Tomorrow filters
   - Custom date picker

### Phase 3: Enhanced Views

5. **Display Submitted Toggle** - See what was practiced today

   - Filter logic
   - Query submitted records

6. **Flashcard Mode** - Alternative practice interface
   - Flashcard component
   - Keyboard navigation
   - Evaluation tracking in flashcard view

### Phase 4: History & Analytics

7. **Practice History** - Review past practice

   - History modal/page
   - Date range filtering
   - Statistics view

8. **Goal Persistence** - Track learning goals
   - Save goal changes
   - Sync to Supabase

---

## Code Locations Reference

**Practice Tab Files:**

- `src/routes/practice/Index.tsx` - Main page, orchestrates grid and toolbar
- `src/components/practice/PracticeControlBanner.tsx` - Toolbar with all buttons
- `src/components/grids/TunesGridScheduled.tsx` - Practice queue grid
- `src/components/grids/RecallEvalComboBox.tsx` - Evaluation dropdown
- `src/lib/db/queries/practice.ts` - Practice-related database queries

**Shared Grid Files:**

- `src/components/grids/shared-toolbar-styles.ts` - Toolbar styling constants
- `src/components/grids/shared-grid-styles.ts` - Grid header styling constants
- `src/components/grids/TuneColumns.tsx` - Column definitions (getScheduledColumns)
- `src/components/grids/types.ts` - TypeScript interfaces

**Database Files:**

- `src/lib/db/schema.ts` - Drizzle schema definitions
- `src/lib/db/client.ts` - Database client setup
- `drizzle/` - Migration files

**Sync Files:**

- `src/lib/sync/service.ts` - Sync service (optimized for conditional syncUp)
- `src/lib/sync/engine.ts` - Sync engine (with getSyncQueueStats)
- `src/lib/auth/AuthContext.tsx` - Auth context (with forceSyncDown)

---

## Testing Checklist

When implementing functionality, verify:

**Submit Evaluations:**

- [ ] Evaluation saved to practice_record table
- [ ] scheduled_date calculated correctly with FSRS
- [ ] last_practiced_date set to today
- [ ] FSRS fields updated (stability, difficulty, reps, etc.)
- [ ] Grid refreshes showing new scheduled dates
- [ ] Sync queue has pending upload
- [ ] Submit button disabled after submit (no evaluations)
- [ ] Count badge shows 0 after submit

**Add Tunes:**

- [ ] Dialog opens with repertoire list
- [ ] Can select multiple tunes
- [ ] practice_record entries created
- [ ] scheduled_date set to today for new entries
- [ ] Grid refreshes showing new tunes
- [ ] Dialog closes after adding

**Queue Filtering:**

- [ ] Today filter shows tunes due today
- [ ] Yesterday/Tomorrow filters work
- [ ] Custom date picker functional
- [ ] Reset returns to Today view
- [ ] Grid data updates when filter changes

**Flashcard Mode:**

- [ ] Grid hides, flashcard shows
- [ ] Tune name visible initially
- [ ] Spacebar reveals notation/notes
- [ ] Arrow keys navigate tunes
- [ ] Can set evaluation in flashcard mode
- [ ] Toggle returns to grid view

---

## Common Pitfalls to Avoid

1. **FSRS Date Handling:** FSRS returns `Date` objects, but SQLite stores ISO strings. Always convert.

   ```typescript
   // ✅ Correct
   scheduled_date: selectedGrade.card.due.toISOString().split("T")[0];

   // ❌ Wrong
   scheduled_date: selectedGrade.card.due;
   ```

2. **Sync Queue Conflicts:** When updating practice_record, ensure sync queue handles conflicts properly.

   - Use `last_modified_at` timestamps
   - Implement conflict resolution (server wins? client wins? merge?)

3. **Evaluation State Management:** Track evaluations in a Map or object, not an array.

   ```typescript
   // ✅ Correct
   const [evaluations, setEvaluations] = createSignal<Map<number, string>>(
     new Map()
   );

   // ❌ Wrong - hard to update/check
   const [evaluations, setEvaluations] = createSignal<
     { tuneId: number; eval: string }[]
   >([]);
   ```

4. **Grid Refresh After DB Changes:** Always increment `syncVersion` or trigger data refetch.

   ```typescript
   // After database update
   setSyncVersion((prev) => prev + 1); // Triggers grid to reload
   ```

5. **Toolbar Button States:** Disable buttons when actions not available.
   ```typescript
   // Submit button should be disabled when evaluationsCount === 0
   <button disabled={evaluationsCount() === 0}>Submit</button>
   ```

---

## Environment Setup

**Required Dependencies:** (already installed)

- `ts-fsrs` - FSRS scheduling algorithm
- `@tanstack/solid-table` - Table management
- `drizzle-orm` - Database ORM
- `@solidjs/router` - Routing
- `lucide-solid` - Icons

**Dev Server:**

```bash
npm run dev  # Runs on http://localhost:5173
```

**Database:**

- SQLite WASM (client-side)
- Location: `tunetrees_local.sqlite3`
- Migrations in `drizzle/` folder

---

## Next Session Goals

**Immediate Tasks:**

1. Implement `handleSubmitEvaluations()` with FSRS integration
2. Create evaluation staging mechanism
3. Wire up "Add Tunes" dialog
4. Implement queue date filtering

**Success Criteria:**

- User can select evaluations and submit them
- FSRS calculates next review dates correctly
- Grid updates after submission
- Can add new tunes to practice queue
- Can filter queue by date

---

## Questions for User

Before starting implementation, clarify:

1. **FSRS Parameters:** Use default FSRS parameters or custom? (default is usually fine)
2. **Conflict Resolution:** Server wins or client wins when sync conflicts occur?
3. **Flashcard UI:** Prefer modal or replace grid entirely? Keyboard shortcuts?
4. **History View:** Separate page or modal overlay?
5. **Add Tunes Dialog:** Simple list or advanced filtering (type/mode/genre)?

---

## Recent Commits (for context)

```
14d8ee8 📝 docs: Add grid styling guide and repertoire tab completion notes
823a6e6 ♻️ refactor: Enhance grids with column updates and sync controls
fd791ce ✨ feat: Implement Practice tab with TunesGridScheduled
eb41cc9 ⚡ perf: Optimize sync behavior to reduce unnecessary network calls
3487ea5 ✨ feat: Standardize toolbar and grid header styling across all tabs
```

---

## Key Insight

**The UI is 100% complete.** All buttons, dropdowns, and grid features work visually. What's missing is the business logic behind them—saving to database, FSRS scheduling, filtering, and state management. The next phase is pure backend integration and data flow.

---

**Last Updated:** October 12, 2025  
**Prepared By:** GitHub Copilot  
**For:** Next chat session continuation
