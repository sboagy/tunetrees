# Toolbar Implementation Plan

**Date:** October 13, 2025  
**Status:** Planning Phase  
**Purpose:** Comprehensive plan for implementing all unimplemented toolbar features

---

## Executive Summary

This document provides a detailed plan for implementing all toolbar features across the three main tabs (Practice, Repertoire, Catalog). The analysis compares current SolidJS implementation with the legacy Next.js implementation to ensure feature parity while improving the architecture.

---

## Current State Analysis

### Practice Tab Toolbar (PracticeControlBanner)

**Implemented ✅:**

- Submit button with badge (evaluations count)
- Display Submitted toggle (eye icon)
- Columns dropdown menu
- History button (navigation)
- Responsive design
- Visual states (enabled/disabled)

**Partially Implemented ⚠️:**

- Add Tunes button (UI only, no functionality)
- Queue control dropdown (UI only, no functionality)
- Flashcard Mode toggle (UI only, no view switching)

**Not Implemented ❌:**

- Submit handler (backend integration)
- Add Tunes dialog and logic
- Queue date filtering (Today, Yesterday, Tomorrow, Custom, Reset)
- Flashcard view component
- Practice history page

---

### Repertoire Tab Toolbar (RepertoireToolbar)

**Implemented ✅:**

- Search input (functional)
- Filter panel (Type, Mode, Genre)
- Columns dropdown menu
- Responsive design

**Partially Implemented ⚠️:**

- Add To Review button (UI only, no functionality)
- Remove From Repertoire button (prop exists, not wired)

**Not Implemented ❌:**

- Add To Review logic (add selected tunes to practice queue)
- Add Tune navigation (exists but no page)
- Remove From Repertoire handler
- Delete Tunes handler
- Row selection integration

---

### Catalog Tab Toolbar (CatalogToolbar)

**Implemented ✅:**

- Search input (functional)
- Filter panel (Type, Mode, Genre, Playlist)
- Columns dropdown menu
- Responsive design

**Partially Implemented ⚠️:**

- Add To Repertoire button (UI only, no functionality)

**Not Implemented ❌:**

- Add To Repertoire logic (add tunes to playlist)
- Add Tune navigation (exists but no page)
- Delete Tunes handler
- Row selection integration

---

## Legacy Implementation Analysis

### Legacy Practice Tab Features

**From `TunesGridScheduled.tsx`:**

1. **Submit Practiced Tunes**

   - Calls `submitPracticeFeedbacks()`
   - Sends all staged recall evaluations to backend
   - Updates practice records with FSRS scheduling
   - Clears transient data after submit
   - Triggers global refresh
   - Background refresh of "tomorrow" preview if stale

2. **Display Submitted Toggle**

   - Persisted to `tab_group_main_state` table
   - Filters grid to show/hide already-submitted tunes
   - State synced with localStorage

3. **Add Tunes Dialog**

   - Opens dialog with count input (default 5, max 50)
   - Calls `refillPracticeQueueAction(userId, playlistId, sitdownDate, count)`
   - Adds tunes from backlog to practice queue
   - Only enabled when queue is empty
   - Shows loading state during refill

4. **Practice Date Chooser (Queue Control)**

   - Integrated component `<PracticeDateChooser>`
   - Options: Today, Yesterday, Tomorrow, Custom Date, Reset
   - Persists to localStorage: `TT_REVIEW_SITDOWN_DATE`
   - Manual flag: `TT_REVIEW_SITDOWN_MANUAL` when not "today"
   - Triggers snapshot refetch with new date
   - **Tomorrow Preview:** Shows tomorrow's generated queue
     - Tracks `tomorrowGeneratedAtRef` timestamp
     - Auto-regenerates if stale (after submit)

5. **Flashcard Mode**

   - Toggle between "grid" and "flashcard" modes
   - Persisted to `tab_group_main_state.practice_mode_flashcard`
   - Renders `<FlashcardPanel>` component when enabled
   - Full flashcard interface for reviewing tunes

6. **Footer Metrics**

   - Lapsed Count, Current Count, Future Count
   - Queued Count, Reviewed Today Count, To Be Practiced Count
   - Metrics dialog with detailed breakdown
   - Calculated from `fullQueueSnapshot`

7. **Practice History**
   - Separate page/route (not in toolbar directly)
   - Shows historical practice sessions

### Legacy Repertoire Tab Features

**From `TunesGridRepertoire.tsx` (inferred):**

1. **Add To Review**

   - Adds selected tunes to practice queue
   - Uses row selection state
   - Creates practice records if needed
   - Schedules for immediate review

2. **Remove From Repertoire**

   - Soft deletes playlist_tune association
   - Removes from current playlist only (tune stays in catalog)
   - Requires confirmation dialog
   - Updates sync queue

3. **Delete Tunes**
   - Hard delete from tune table
   - Requires confirmation with warning
   - Cascades to practice records
   - Updates sync queue

### Legacy Catalog Tab Features

**From `TunesGridCatalog.tsx` (inferred):**

1. **Add To Repertoire**

   - Opens playlist selection dialog
   - Creates playlist_tune association
   - Initializes practice record
   - Adds to sync queue

2. **Delete Tunes**
   - Same as Repertoire tab
   - Hard delete from tune table
   - Confirmation dialog

---

## Database Integration Points

### Tables Involved

1. **`practice_record`**

   - Submit creates/updates records
   - FSRS scheduling calculations
   - Tracks recall evaluations

2. **`playlist_tune`**

   - Add To Review/Repertoire creates entries
   - Remove From Repertoire soft deletes
   - Links tunes to playlists

3. **`tune`**

   - Delete Tunes soft deletes
   - Cascades affect practice records

4. **`practice_queue_entry`**

   - Add Tunes refills queue
   - Snapshot-based queue system
   - Generated based on sitdown date

5. **`tab_group_main_state`**

   - Persists UI preferences
   - `practice_show_submitted`
   - `practice_mode_flashcard`

6. **`sync_queue`**
   - All mutations queue for Supabase sync
   - Background sync to cloud

---

## Implementation Plan

### Phase 1: Practice Tab Core Features (High Priority)

#### Task 1.1: Submit Practice Evaluations ⭐⭐⭐

**Priority:** Critical  
**Complexity:** High  
**Dependencies:** practice-recording.ts, sync queue

**Implementation:**

1. Wire up `handleSubmit` in PracticeControlBanner
2. Call `submitPracticeFeedbacks()` from practice-recording service
3. Pass evaluations from grid state
4. Update practice records with FSRS calculations
5. Queue sync to Supabase
6. Clear staged evaluations after submit
7. Trigger grid refresh
8. Show success toast

**Files to Modify:**

- `src/routes/practice/Index.tsx` - Pass submit handler
- `src/components/practice/PracticeControlBanner.tsx` - Wire handler
- `src/lib/services/practice-recording.ts` - Verify submit logic
- `src/lib/sync/service.ts` - Ensure sync queuing

**Acceptance Criteria:**

- [ ] Click Submit button sends all evaluations to backend
- [ ] Practice records updated with new schedule dates
- [ ] Grid refreshes to show updated data
- [ ] Sync queue contains new records
- [ ] Success toast displayed
- [ ] Button disabled after submit until new evaluations

---

#### Task 1.2: Add Tunes Dialog & Logic ⭐⭐

**Priority:** High  
**Complexity:** Medium  
**Dependencies:** queue-generator.ts, playlist-tune queries

**Implementation:**

1. Create `AddTunesDialog` component with count input
2. Add state for dialog open/closed
3. Implement `refillPracticeQueue()` function
4. Call backend queue refill API
5. Refresh grid after adding tunes
6. Show loading state during refill

**Files to Create:**

- `src/components/practice/AddTunesDialog.tsx`

**Files to Modify:**

- `src/components/practice/PracticeControlBanner.tsx` - Add dialog
- `src/lib/services/queue-generator.ts` - Verify refill logic
- `src/routes/practice/Index.tsx` - Wire refill handler

**Acceptance Criteria:**

- [ ] Dialog opens with count input (default 5, max 50)
- [ ] Refill adds N tunes from backlog to queue
- [ ] Grid refreshes to show new tunes
- [ ] Loading spinner during refill
- [ ] Success/error toast feedback
- [ ] Button only enabled when queue empty (future enhancement)

---

#### Task 1.3: Queue Date Control (Sitdown Date) ⭐⭐

**Priority:** Medium-High  
**Complexity:** Medium  
**Dependencies:** practice_queue_entry queries

**Implementation:**

1. Create `PracticeDateChooser` component (or reuse from legacy)
2. Add state for sitdown date
3. Persist to localStorage: `TT_REVIEW_SITDOWN_DATE`
4. Implement date options:
   - Today (reset to now)
   - Yesterday (decrement by 1 day)
   - Tomorrow (increment by 1 day)
   - Custom Date (date picker dialog)
   - Reset (clear localStorage, use default)
5. Trigger grid refresh on date change
6. Show current date in dropdown button

**Files to Create:**

- `src/components/practice/PracticeDateChooser.tsx`

**Files to Modify:**

- `src/components/practice/PracticeControlBanner.tsx` - Integrate chooser
- `src/routes/practice/Index.tsx` - Pass date state
- `src/components/grids/TunesGridScheduled.tsx` - Use sitdown date in query

**Acceptance Criteria:**

- [ ] Dropdown shows date options
- [ ] Selecting date updates localStorage
- [ ] Grid refreshes with new queue for selected date
- [ ] Current date displayed in button
- [ ] Tomorrow preview shows generated queue
- [ ] Reset clears custom date, uses "today"

---

#### Task 1.4: Flashcard Mode ⭐

**Priority:** Low-Medium  
**Complexity:** High  
**Dependencies:** New flashcard component, practice evaluations

**Implementation:**

1. Create `FlashcardView` component
2. Implement flashcard UI:
   - Front: Tune title, type, mode
   - Back: ABC notation, audio player, structure
   - Flip animation
3. Add evaluation controls on flashcard
4. Navigation: Previous/Next tune
5. Progress indicator
6. Persist mode to tab_group_main_state
7. Toggle renders FlashcardView vs TunesGridScheduled

**Files to Create:**

- `src/components/practice/FlashcardView.tsx`
- `src/components/practice/FlashcardCard.tsx`

**Files to Modify:**

- `src/components/practice/PracticeControlBanner.tsx` - Wire toggle
- `src/routes/practice/Index.tsx` - Conditional rendering
- `src/lib/db/queries/settings.ts` - Persist mode preference

**Acceptance Criteria:**

- [ ] Toggle switches between grid and flashcard views
- [ ] Flashcard shows tune details
- [ ] Flip animation works smoothly
- [ ] Evaluation controls functional
- [ ] Navigation between tunes
- [ ] Progress indicator visible
- [ ] Mode preference persists

**Note:** This is a major feature, consider deferring to Phase 3.

---

### Phase 2: Repertoire & Catalog Actions (Medium Priority)

#### Task 2.1: Add To Review (Repertoire) ⭐⭐

**Priority:** High  
**Complexity:** Low-Medium  
**Dependencies:** playlist-tune queries, practice record creation

**Implementation:**

1. Get selected rows from grid
2. For each selected tune:
   - Check if playlist_tune exists
   - Create if missing
   - Update `scheduled` to now (immediate review)
   - Update `goal` to "recall"
3. Queue sync for all changes
4. Refresh Practice tab queue
5. Show success toast with count

**Files to Modify:**

- `src/components/repertoire/RepertoireToolbar.tsx` - Wire handler
- `src/routes/repertoire.tsx` - Pass selection state and handler
- `src/lib/db/queries/playlists.ts` - Add/update playlist-tune entries
- `src/lib/services/queue-generator.ts` - Trigger queue recalculation

**Acceptance Criteria:**

- [ ] Button enabled only when rows selected
- [ ] Selected tunes added to practice queue
- [ ] Scheduled date set to "now"
- [ ] Practice tab shows new tunes
- [ ] Success toast: "Added N tunes to review"
- [ ] Sync queue updated

---

#### Task 2.2: Add To Repertoire (Catalog) ⭐⭐

**Priority:** High  
**Complexity:** Medium  
**Dependencies:** playlist selection, playlist-tune creation

**Implementation:**

1. Get selected rows from grid
2. Open playlist selection dialog (use current playlist by default)
3. For each selected tune:
   - Create playlist_tune entry
   - Initialize practice record with defaults
   - Set `scheduled` to null (not in queue yet)
   - Set `goal` to "recall"
4. Queue sync for all changes
5. Refresh Repertoire tab
6. Show success toast

**Files to Create:**

- `src/components/catalog/PlaylistSelectionDialog.tsx` (optional, can use current playlist)

**Files to Modify:**

- `src/components/catalog/CatalogToolbar.tsx` - Wire handler
- `src/routes/catalog.tsx` - Pass selection state and handler
- `src/lib/db/queries/playlists.ts` - Create playlist-tune entries
- `src/lib/db/queries/practice.ts` - Initialize practice records

**Acceptance Criteria:**

- [ ] Button enabled only when rows selected
- [ ] Dialog shows available playlists (future enhancement)
- [ ] Tunes added to current playlist
- [ ] Practice records initialized
- [ ] Repertoire tab shows new tunes
- [ ] Success toast: "Added N tunes to repertoire"
- [ ] Sync queue updated

---

#### Task 2.3: Remove From Repertoire ⭐

**Priority:** Medium  
**Complexity:** Low  
**Dependencies:** playlist-tune soft delete

**Implementation:**

1. Get selected rows from grid
2. Show confirmation dialog: "Remove N tunes from this playlist?"
3. For each selected tune:
   - Soft delete playlist_tune entry (set deleted=1)
   - Leave practice records intact (history preservation)
4. Queue sync
5. Refresh grid (remove from view)
6. Show success toast

**Files to Create:**

- `src/components/common/ConfirmDialog.tsx` (reusable)

**Files to Modify:**

- `src/components/repertoire/RepertoireToolbar.tsx` - Wire handler
- `src/routes/repertoire.tsx` - Pass handler
- `src/lib/db/queries/playlists.ts` - Soft delete logic

**Acceptance Criteria:**

- [ ] Button enabled only when rows selected
- [ ] Confirmation dialog appears
- [ ] Cancel aborts action
- [ ] Confirm soft deletes playlist_tune entries
- [ ] Grid refreshes (removed tunes disappear)
- [ ] Practice records preserved
- [ ] Success toast: "Removed N tunes from repertoire"
- [ ] Sync queue updated

---

#### Task 2.4: Delete Tunes (Repertoire & Catalog) ⭐

**Priority:** Low  
**Complexity:** Medium  
**Dependencies:** tune soft delete, cascade considerations

**Implementation:**

1. Get selected rows from grid
2. Show warning dialog: "Delete N tunes? This will remove them from ALL playlists and delete practice history. This cannot be undone."
3. Require explicit confirmation (type "DELETE" or similar)
4. For each selected tune:
   - Soft delete tune entry (set deleted=1)
   - Cascade soft deletes to:
     - All playlist_tune entries
     - All practice_record entries (optional, or preserve)
5. Queue sync
6. Refresh grid
7. Show success toast

**Files to Modify:**

- `src/components/repertoire/RepertoireToolbar.tsx` - Wire handler
- `src/components/catalog/CatalogToolbar.tsx` - Wire handler
- `src/routes/repertoire.tsx` - Pass handler
- `src/routes/catalog.tsx` - Pass handler
- `src/lib/db/queries/tunes.ts` - Soft delete with cascade

**Acceptance Criteria:**

- [ ] Button enabled only when rows selected
- [ ] Warning dialog with strong language
- [ ] Require explicit confirmation
- [ ] Cancel aborts action
- [ ] Confirm soft deletes tune and cascades
- [ ] Grid refreshes (deleted tunes disappear)
- [ ] Success toast: "Deleted N tunes"
- [ ] Sync queue updated

**Note:** Consider implementing "hard delete" vs "soft delete" option.

---

### Phase 3: Advanced Features (Lower Priority)

#### Task 3.1: Practice History Page ⭐

**Priority:** Low  
**Complexity:** High  
**Dependencies:** practice_record queries, visualization

**Implementation:**

1. Create `/practice/history` route
2. Query practice records grouped by session/date
3. Display table/list of historical sessions
4. Show metrics: tunes reviewed, average quality, time spent
5. Filter by date range
6. Export to CSV (future)

**Files to Create:**

- `src/routes/practice/history.tsx`
- `src/components/practice/PracticeHistoryTable.tsx`

**Acceptance Criteria:**

- [ ] Page shows list of practice sessions
- [ ] Metrics displayed per session
- [ ] Filter by date range
- [ ] Click session shows details
- [ ] Responsive design

---

#### Task 3.2: Add Tune Page ⭐

**Priority:** Medium  
**Complexity:** High  
**Dependencies:** Tune editor component, ABC notation, file upload

**Implementation:**

1. Create `/tunes/new` route
2. Form with fields: title, type, mode, structure, genre, ABC notation, audio URL
3. ABC notation editor with live preview
4. File upload for audio
5. Validation
6. Create tune in SQLite
7. Queue sync to Supabase

**Files to Create:**

- `src/routes/tunes/new.tsx`
- `src/components/tunes/TuneForm.tsx`
- `src/components/tunes/AbcEditor.tsx`

**Acceptance Criteria:**

- [ ] Form renders with all fields
- [ ] ABC notation preview works
- [ ] Audio upload works
- [ ] Validation errors shown
- [ ] Submit creates tune
- [ ] Redirect to catalog after create
- [ ] Success toast

---

#### Task 3.3: Display Submitted Preference Persistence ⭐

**Priority:** Low  
**Complexity:** Low  
**Dependencies:** localStorage, queries

**Implementation:**

1. Persist `showSubmitted` to localStorage or user settings
2. Load on mount
3. Save on change

**Files to Modify:**

- `src/routes/practice/Index.tsx` - Load/save preference
- `src/lib/db/queries/settings.ts` - User settings table

**Acceptance Criteria:**

- [ ] Toggle state persists across sessions
- [ ] Loads correctly on mount

---

#### Task 3.4: Footer Metrics (Practice Tab) ⭐

**Priority:** Low  
**Complexity:** Medium  
**Dependencies:** practice_queue_entry aggregation

**Implementation:**

1. Calculate metrics from full queue snapshot:
   - Lapsed (due < sitdown_date - 7 days)
   - Current (due within 7 days)
   - Future (due > today)
   - Queued (in today's practice_queue_entry)
   - Reviewed Today (submitted count)
   - To Be Practiced (pending evaluations)
2. Display in footer bar or dialog
3. Update reactively

**Files to Create:**

- `src/components/practice/PracticeMetrics.tsx`

**Files to Modify:**

- `src/routes/practice/Index.tsx` - Calculate and display metrics

**Acceptance Criteria:**

- [ ] Metrics calculated correctly
- [ ] Displayed in footer
- [ ] Updates reactively
- [ ] Responsive design

---

## Technical Considerations

### 1. Row Selection State

**Current State:**

- Grids support row selection via TanStack Table
- Selection state managed internally by grid
- Not exposed to toolbar components

**Solution:**

- Lift selection state to parent route component
- Pass to both grid and toolbar
- Use `onRowSelectionChange` callback

**Example:**

```tsx
// src/routes/repertoire.tsx
const [rowSelection, setRowSelection] = createSignal<RowSelectionState>({});

<RepertoireToolbar
  selectedRowsCount={Object.keys(rowSelection()).length}
  onRemoveFromRepertoire={() => handleRemove(rowSelection())}
/>

<TunesGridRepertoire
  rowSelection={rowSelection()}
  onRowSelectionChange={setRowSelection}
/>
```

---

### 2. Dialog Management

**Pattern:**

- Create reusable dialog components
- Use SolidJS Portal for modals
- Manage open/close state in parent

**Components to Create:**

- `ConfirmDialog` - Generic confirmation
- `AddTunesDialog` - Practice queue refill
- `PlaylistSelectionDialog` - Choose playlist
- `DeleteWarningDialog` - Destructive action warning

---

### 3. Sync Queue Integration

**All mutations must:**

1. Update local SQLite immediately
2. Add entry to `sync_queue` table
3. Trigger background sync worker
4. Handle sync failures gracefully

**Pattern:**

```tsx
// 1. Update local DB
await db
  .update(playlist_tune)
  .set({ deleted: 1 })
  .where(eq(playlist_tune.id, tuneId));

// 2. Queue sync
await queueSync(db, "playlist_tune", tuneId, "update");

// 3. Trigger sync worker (automatic via SyncService)
```

---

### 4. Error Handling

**Pattern:**

- All async operations wrapped in try/catch
- User-friendly error toasts
- Console logging for debugging
- Optimistic UI updates with rollback on error

**Example:**

```tsx
try {
  await removeTuneFromPlaylist(db, playlistId, tuneId);
  toast.success("Removed tune from repertoire");
  triggerRefresh(); // Refresh grid
} catch (error) {
  console.error("Remove tune failed:", error);
  toast.error("Failed to remove tune. Please try again.");
}
```

---

### 5. Performance Considerations

**Batch Operations:**

- When operating on multiple selected rows, batch database operations
- Use single transaction for all updates
- Avoid N+1 queries

**Example:**

```tsx
await db.transaction(async (tx) => {
  for (const tuneId of selectedTuneIds) {
    await tx
      .update(playlist_tune)
      .set({ deleted: 1 })
      .where(eq(playlist_tune.id, tuneId));
  }
});
```

---

## Testing Strategy

### Unit Tests

- Test individual handlers (submit, add, remove, delete)
- Mock database queries
- Verify state updates

### Integration Tests

- Test complete flows (select → action → refresh)
- Verify sync queue entries
- Test error paths

### E2E Tests (Playwright)

- Test toolbar buttons clickable
- Test dialogs open/close
- Test grid refreshes after actions
- Test success/error toasts

---

## Phased Rollout

### Phase 1 (Week 1-2)

- Task 1.1: Submit Practice Evaluations ⭐⭐⭐
- Task 1.2: Add Tunes Dialog ⭐⭐
- Task 2.1: Add To Review ⭐⭐
- Task 2.2: Add To Repertoire ⭐⭐

### Phase 2 (Week 3-4)

- Task 1.3: Queue Date Control ⭐⭐
- Task 2.3: Remove From Repertoire ⭐
- Task 2.4: Delete Tunes ⭐

### Phase 3 (Week 5+)

- Task 1.4: Flashcard Mode ⭐
- Task 3.1: Practice History ⭐
- Task 3.2: Add Tune Page ⭐
- Task 3.3: Display Submitted Persistence ⭐
- Task 3.4: Footer Metrics ⭐

---

## Success Criteria

### Practice Tab

- [ ] All toolbar buttons functional
- [ ] Submit creates practice records
- [ ] Add Tunes refills queue
- [ ] Queue date control works
- [ ] Flashcard mode toggle (stretch)

### Repertoire Tab

- [ ] Add To Review schedules tunes
- [ ] Remove From Repertoire soft deletes
- [ ] Delete Tunes with confirmation
- [ ] Row selection integrated

### Catalog Tab

- [ ] Add To Repertoire creates playlist entries
- [ ] Delete Tunes with confirmation
- [ ] Row selection integrated

### General

- [ ] All actions queue for sync
- [ ] Error handling with user feedback
- [ ] Loading states during operations
- [ ] Responsive design maintained
- [ ] Test coverage >80%

---

## Risk Mitigation

### Risk 1: Complex Database Transactions

**Mitigation:** Start with simple cases, add complexity incrementally. Test with sample data extensively.

### Risk 2: Sync Conflicts

**Mitigation:** Implement robust conflict resolution in sync layer. Use last-write-wins with timestamps.

### Risk 3: Performance with Large Datasets

**Mitigation:** Profile database queries. Add indexes if needed. Implement pagination for large result sets.

### Risk 4: State Management Complexity

**Mitigation:** Keep state close to components. Use SolidJS signals for reactivity. Document state flow clearly.

---

## Documentation Updates

After implementation, update:

- [ ] User guide with toolbar feature explanations
- [ ] Developer docs with architecture diagrams
- [ ] API docs for new database functions
- [ ] Testing docs with coverage reports

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Prioritize tasks** based on user feedback
3. **Set up tracking** (GitHub issues or similar)
4. **Start Phase 1** with highest priority tasks
5. **Iterate based on feedback**

---

**Last Updated:** October 13, 2025  
**Maintained By:** GitHub Copilot Agent
