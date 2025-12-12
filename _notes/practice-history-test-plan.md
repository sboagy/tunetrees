# Practice History Page - E2E Test Plan

**File:** `src/routes/tunes/[id]/practice-history/index.tsx`  
**Test File:** `e2e/tests/practice-history.spec.ts` (to be created)  
**Priority:** High  
**Date:** December 11, 2025

## Overview

The practice history page displays and manages all practice records for a specific tune in a user's playlist. Users can view historical practice data, add new records manually, edit existing records, and delete records.

## Current Test Coverage

✅ **Navigation Tests** (in `tune-editor-004-user-fields.spec.ts`):
- Navigate from tune editor to practice history
- Navigate from sidebar to practice history
- Verify page loads and displays container

❌ **Missing Functionality Tests**:
- View practice records grid
- Add new practice records
- Edit existing practice records
- Delete practice records
- Filter/sort records
- Validate field constraints

---

## Test Scenarios

### 1. Viewing Practice Records

#### 1.1 Display Empty State
**Given:** A tune with no practice history  
**When:** User navigates to practice history page  
**Then:** 
- Empty state message is displayed
- "Add" button is visible
- Grid shows no rows

#### 1.2 Display Existing Records
**Given:** A tune with multiple practice records  
**When:** User navigates to practice history page  
**Then:**
- Grid displays all practice records
- Records show: practiced date, quality, state, FSRS fields (difficulty, stability, etc.)
- Records are sorted by practiced date (most recent first)
- Each row has edit/delete actions

#### 1.3 Display Read-Only View
**Given:** User is viewing a tune they don't own  
**When:** User navigates to practice history page  
**Then:**
- Grid displays records (read-only)
- Add/Edit/Delete buttons are disabled or hidden

---

### 2. Adding Practice Records

#### 2.1 Add New Record (Valid Data)
**Given:** User is on practice history page  
**When:** User clicks "Add" button  
**Then:** 
- New empty row appears in grid (inline edit mode)
- All fields are editable
- Default values populated where applicable

**When:** User fills in:
- Practiced: `2024-12-01T10:00`
- Quality: `Good`
- Goal: `recall`
- (Optional: technique field)

**And:** User clicks save/confirm  
**Then:**
- Record is saved to database
- Grid refreshes and shows new record
- New record appears at top of list
- Success message displayed (optional)

#### 2.2 Add New Record (Missing Required Fields)
**Given:** User is adding a new record  
**When:** User leaves required fields empty (practiced, quality)  
**And:** User attempts to save  
**Then:**
- Validation error displayed
- Record is not saved
- Focus returns to first invalid field

#### 2.3 Add New Record (Invalid Date)
**Given:** User is adding a new record  
**When:** User enters a future date for "practiced"  
**And:** User attempts to save  
**Then:**
- Validation error: "Practice date cannot be in the future"
- Record is not saved

#### 2.4 Cancel Adding Record
**Given:** User is adding a new record  
**When:** User clicks "Cancel" button  
**Then:**
- New row is removed from grid
- No changes saved to database
- Grid returns to previous state

---

### 3. Editing Practice Records

#### 3.1 Edit Existing Record (Valid Changes)
**Given:** User is viewing practice history with existing records  
**When:** User clicks edit button on a record  
**Then:**
- Row enters edit mode
- All editable fields are enabled
- Current values are displayed

**When:** User modifies:
- Quality: `Good` → `Easy`
- Goal: `recall` → `fluency`

**And:** User clicks save  
**Then:**
- Changes are saved to database
- Grid refreshes and shows updated values
- FSRS fields may recalculate (if applicable)

#### 3.2 Edit Record (Invalid Data)
**Given:** User is editing a record  
**When:** User enters invalid data (e.g., quality = 5, out of range)  
**And:** User attempts to save  
**Then:**
- Validation error displayed
- Record is not saved
- User can correct or cancel

#### 3.3 Edit Record (No Changes)
**Given:** User enters edit mode  
**When:** User makes no changes  
**And:** User clicks save  
**Then:**
- No database write occurs
- Row exits edit mode normally

#### 3.4 Cancel Editing Record
**Given:** User is editing a record  
**When:** User modifies fields  
**And:** User clicks "Cancel"  
**Then:**
- Changes are discarded
- Row exits edit mode
- Original values are restored

---

### 4. Deleting Practice Records

#### 4.1 Delete Single Record (Soft Delete)
**Given:** User is viewing practice history  
**When:** User clicks delete button on a record  
**Then:**
- Confirmation dialog appears: "Delete this practice record?"

**When:** User confirms deletion  
**Then:**
- Record is soft-deleted (marked as deleted, not removed from DB)
- Grid refreshes and record disappears
- Undo option displayed (optional)

#### 4.2 Delete Single Record (Cancel)
**Given:** User clicks delete button  
**When:** Confirmation dialog appears  
**And:** User clicks "Cancel"  
**Then:**
- Record is not deleted
- Grid remains unchanged

#### 4.3 Delete Last Record
**Given:** Tune has only one practice record  
**When:** User deletes it  
**Then:**
- Record is deleted
- Empty state is displayed
- User can still add new records

---

### 5. Grid Interaction and Navigation

#### 5.1 Sort Records by Column
**Given:** Practice history has multiple records  
**When:** User clicks column header (e.g., "Practiced")  
**Then:**
- Records are sorted ascending
**When:** User clicks again  
**Then:**
- Records are sorted descending

#### 5.2 Navigate Back to Editor
**Given:** User is on practice history page  
**When:** User clicks "Cancel" or "Back to Editor" button  
**Then:**
- User is returned to tune editor
- No unsaved changes are lost

#### 5.3 Navigate Back via Sidebar
**Given:** User is on practice history page  
**When:** User clicks different tune in sidebar  
**Then:**
- Context switches to new tune
- Practice history page updates for new tune (if staying on same route)
- Or navigates away appropriately

---

### 6. Field-Level Validation

#### 6.1 Quality Field Constraints
**Given:** User is adding/editing a record  
**When:** User selects quality dropdown  
**Then:**
- Only valid options shown: Again (1), Hard (2), Good (3), Easy (4)

#### 6.2 Practiced Date Field
**Given:** User is setting practiced date  
**When:** User enters date in past  
**Then:** ✅ Valid
**When:** User enters today's date  
**Then:** ✅ Valid
**When:** User enters future date  
**Then:** ❌ Validation error

#### 6.3 FSRS Fields (Read-Only)
**Given:** Record has FSRS calculated fields (difficulty, stability, interval, etc.)  
**Then:**
- These fields are displayed as read-only
- User cannot edit them directly
- They update only via FSRS recalculation

---

### 7. Edge Cases and Error Handling

#### 7.1 Concurrent Edits (Multi-Device)
**Given:** Same tune open on two devices  
**When:** User A edits a record on device 1  
**And:** User B edits same record on device 2  
**Then:**
- Last write wins (per sync strategy)
- Conflict indicator shown (future enhancement)

#### 7.2 Network Error During Save
**Given:** User is adding/editing a record  
**When:** Save is triggered  
**And:** Network fails  
**Then:**
- Local SQLite save succeeds (offline-first)
- Record queued for background sync
- User sees record in grid immediately

#### 7.3 Invalid Tune ID
**Given:** User navigates to `/tunes/invalid-uuid/practice-history`  
**Then:**
- Error state displayed: "Tune not found"
- Option to return to repertoire

---

## Test Data Requirements

### Seed Data for Tests

```typescript
// Tune with no practice history (empty state)
- Tune: "Banish Misfortune" (from catalog)
- Playlist: User's default playlist
- Practice records: 0

// Tune with multiple practice records
- Tune: "Cooley's Reel" (from catalog)
- Practice records: 5
  - Record 1: 2024-12-10, Quality: Good, Goal: recall
  - Record 2: 2024-12-08, Quality: Easy, Goal: recall
  - Record 3: 2024-12-05, Quality: Hard, Goal: fluency
  - Record 4: 2024-12-01, Quality: Good, Goal: recall
  - Record 5: 2024-11-28, Quality: Again, Goal: recall

// Tune with single practice record (edge case)
- Tune: "Kesh Jig" (from catalog)
- Practice records: 1
  - Record 1: 2024-12-09, Quality: Good, Goal: session_ready
```

---

## Implementation Notes

### Test File Structure

```typescript
// e2e/tests/practice-history.spec.ts

test.describe("PRACTICE-HISTORY: View and Manage Records", () => {
  test.beforeEach(async ({ page, testUser }) => {
    // Seed data setup
    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [...],
      seedPracticeRecords: [...],
    });
  });

  test.describe("Viewing Records", () => {
    test("should display empty state...", ...);
    test("should display existing records...", ...);
  });

  test.describe("Adding Records", () => {
    test("should add new record with valid data...", ...);
    test("should validate required fields...", ...);
  });

  test.describe("Editing Records", () => {
    test("should edit existing record...", ...);
    test("should cancel editing...", ...);
  });

  test.describe("Deleting Records", () => {
    test("should delete record with confirmation...", ...);
  });
});
```

### Key Selectors (data-testid)

- `practice-history-container` ✅ (already exists)
- `practice-history-grid`
- `practice-history-add-button` ✅ (already exists)
- `practice-history-empty-state`
- `practice-history-row-{index}`
- `practice-history-edit-button-{index}`
- `practice-history-delete-button-{index}`
- `practice-history-cancel-button` ✅ (already exists)
- `practice-history-save-button-{index}`
- `practice-history-input-practiced-{index}`
- `practice-history-select-quality-{index}`
- `practice-history-select-goal-{index}`

---

## Priority Matrix

| Test Scenario | Priority | Complexity | Dependencies |
|--------------|----------|------------|--------------|
| 1.2 Display existing records | **High** | Low | Seed data |
| 2.1 Add new record | **High** | Medium | Grid API |
| 3.1 Edit existing record | **High** | Medium | Grid API |
| 4.1 Delete record | **High** | Low | Confirmation modal |
| 1.1 Empty state | Medium | Low | None |
| 2.2 Validation errors | Medium | Low | Add flow |
| 5.1 Sort records | Low | Low | Grid sorting |
| 7.2 Network error | Low | High | Sync testing |

---

## Success Criteria

- [ ] All CRUD operations (Create, Read, Update, Delete) are tested
- [ ] Validation rules are enforced and tested
- [ ] UI feedback (errors, confirmations) is verified
- [ ] Navigation flows work correctly
- [ ] Grid interaction (sorting, editing) works
- [ ] Edge cases handled gracefully
- [ ] Tests pass on Chromium, Firefox, WebKit
- [ ] Tests pass on mobile viewports

---

## Related Files

- **Implementation:** `src/routes/tunes/[id]/practice-history/index.tsx`
- **Queries:** `src/lib/db/queries/practice-records.ts`
- **Types:** `src/lib/db/types.ts` (PracticeRecord interface)
- **Existing Tests:** `e2e/tests/tune-editor-004-user-fields.spec.ts` (navigation only)
- **Page Object:** `e2e/page-objects/TuneTreesPage.ts` (may need practice history helpers)

---

## Next Steps

1. Create `e2e/tests/practice-history.spec.ts`
2. Implement seed data helper for practice records
3. Add missing data-testid selectors to practice-history component
4. Write tests following priority matrix
5. Run tests and fix issues
6. Add to CI pipeline
