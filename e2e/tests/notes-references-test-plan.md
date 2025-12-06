# Notes and References - E2E Test Plan

## Overview

**Feature:** Notes and References Sidebar Panels (Issue #250, PR #299)  
**Priority:** Critical  
**Scope:** CRUD operations, drag-and-drop reordering, persistence

This test plan follows `e2e/AGENTS.md` conventions:
- Path: `e2e/tests/notes-001-crud.spec.ts`, `e2e/tests/refs-001-crud.spec.ts`, etc.
- Use `TuneTreesPage` locators exclusively
- Use `setupForRepertoireTestsParallel` for test setup
- Explicit timeouts (≥10s for visibility)

---

## Application Overview

The Notes and References feature allows users to manage personal notes and external links (references) associated with tunes in TuneTrees. These panels appear in the sidebar when a tune is selected.

### Key Features

**Notes Panel:**
- Display all notes for selected tune (ordered by display_order, then created date)
- Create new notes with rich text editor (Jodit)
- Edit existing notes with auto-save (2-second debounce)
- Delete notes (soft delete)
- Drag-and-drop reordering via grip handle
- Persistence to SQLite WASM → sync queue → Supabase

**References Panel:**
- Display all references for selected tune (ordered by display_order)
- Add new references with auto-detected type (video, sheet-music, article, social, other)
- Edit existing references (URL, title, type, comment, favorite)
- Delete references (soft delete)
- Drag-and-drop reordering
- Open links in new tab
- Grouped display by type (optional)

---

## Test Scenarios

### 1. Notes - Create Note

**Seed:** `e2e/tests/seed.spec.ts` with tune selected

#### 1.1 Create Note with Text Content
**Preconditions:**
- User is logged in
- A tune is selected in repertoire/catalog grid
- Sidebar is visible

**Steps:**
1. Locate the Notes panel in the sidebar
2. Click the "+ Add" button next to "Notes" header
3. Wait for the Jodit rich text editor to appear
4. Type "Test note content" in the editor
5. Click the "Save" button

**Expected Results:**
- New note editor appears with placeholder text
- After save, note appears in the notes list
- Note count header updates (e.g., "1 note")
- Note shows creation timestamp
- Editor closes after save

#### 1.2 Create Note and Cancel
**Steps:**
1. Click the "+ Add" button
2. Type some content in the editor
3. Click the "Cancel" button

**Expected Results:**
- Editor closes without saving
- No new note appears in the list
- Note count remains unchanged

#### 1.3 Create Note with Empty Content
**Steps:**
1. Click the "+ Add" button
2. Leave editor empty
3. Observe the "Save" button state

**Expected Results:**
- "Save" button is disabled when editor is empty
- Clicking disabled save button has no effect

---

### 2. Notes - Edit Note

#### 2.1 Edit Existing Note
**Preconditions:**
- At least one note exists for the selected tune

**Steps:**
1. Locate an existing note in the notes list
2. Click the "Edit" button on the note
3. Modify the note text
4. Wait 2+ seconds for auto-save

**Expected Results:**
- Editor opens with existing note content
- "Edit" button changes to "Cancel"
- Content is auto-saved after 2 seconds
- Note list updates with modified content

#### 2.2 Cancel Edit Without Changes
**Steps:**
1. Click "Edit" on an existing note
2. Click "Cancel" without making changes

**Expected Results:**
- Editor closes
- Original content is preserved

#### 2.3 Rich Text Formatting
**Steps:**
1. Edit a note
2. Use toolbar to apply bold, italic, underline
3. Create a bulleted list
4. Add a link
5. Wait for auto-save

**Expected Results:**
- Formatting is applied in editor
- Formatting persists after save
- Formatting displays correctly in read mode

---

### 3. Notes - Delete Note

#### 3.1 Delete Note with Confirmation
**Preconditions:**
- At least one note exists

**Steps:**
1. Click "Delete" button on a note
2. Confirm deletion in dialog

**Expected Results:**
- Confirmation dialog appears
- Note is removed from list after confirmation
- Note count decreases

#### 3.2 Cancel Delete
**Steps:**
1. Click "Delete" button
2. Cancel in confirmation dialog

**Expected Results:**
- Note remains in list
- No changes made

---

### 4. Notes - Drag and Drop Reordering

**Preconditions:**
- At least 2 notes exist for the selected tune

#### 4.1 Reorder Notes by Dragging
**Steps:**
1. Hover over grip handle (⋮⋮) on first note
2. Drag first note below second note
3. Release

**Expected Results:**
- Visual feedback during drag (opacity change, highlight on target)
- Notes reorder in the list
- New order persists after page refresh

#### 4.2 Reorder Notes - Persistence After Refresh
**Steps:**
1. Reorder notes via drag-and-drop
2. Wait for sync (observe console or wait 5+ seconds)
3. Refresh the page
4. Navigate back to same tune

**Expected Results:**
- Notes appear in the new order after refresh
- display_order values are updated in database

---

### 5. Notes - Persistence

#### 5.1 Note Persists to SQLite WASM
**Steps:**
1. Create a new note
2. Open browser DevTools → Application → IndexedDB
3. Inspect tunetrees-storage database

**Expected Results:**
- Note data appears in IndexedDB
- Note has valid UUID, tune_ref, note_text fields

#### 5.2 Note Syncs to Supabase
**Steps:**
1. Create a new note
2. Wait for background sync (default 5 second interval)
3. Check Supabase dashboard for note table

**Expected Results:**
- Note appears in Supabase note table
- Fields match local data

#### 5.3 Note Content Survives Browser Refresh
**Steps:**
1. Create a note with specific content
2. Refresh browser
3. Navigate to same tune

**Expected Results:**
- Note appears with saved content
- Rich text formatting preserved

---

### 6. References - Create Reference

#### 6.1 Create Reference with YouTube URL
**Steps:**
1. Click "+ Add" button in References panel
2. Enter YouTube URL: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
3. Observe auto-detection
4. Click Submit/Save

**Expected Results:**
- Type auto-detects to "Video" (🎥)
- Title auto-fills with video ID
- Reference appears in list with video icon

#### 6.2 Create Reference with Sheet Music URL
**Steps:**
1. Add reference with URL: `https://thesession.org/tunes/2`

**Expected Results:**
- Type auto-detects to "Sheet Music" (🎼)
- Title suggests "The Session: [tune-name]"

#### 6.3 Create Reference with Custom Fields
**Steps:**
1. Add reference with any URL
2. Manually change type dropdown
3. Enter custom title
4. Add a comment
5. Toggle favorite checkbox
6. Save

**Expected Results:**
- All custom values are saved
- Favorite star appears if toggled on

#### 6.4 Create Reference - Invalid URL
**Steps:**
1. Enter invalid URL (e.g., "not a url")
2. Observe validation

**Expected Results:**
- Error message: "Please enter a valid URL"
- Form does not submit

#### 6.5 Create Reference - Cancel
**Steps:**
1. Open add reference form
2. Enter some data
3. Click Cancel

**Expected Results:**
- Form closes without saving
- No new reference in list

---

### 7. References - Edit Reference

#### 7.1 Edit Reference URL
**Preconditions:**
- At least one reference exists

**Steps:**
1. Click edit button on a reference
2. Change the URL
3. Save

**Expected Results:**
- URL is updated
- Type may auto-update based on new URL
- Changes persist

#### 7.2 Edit Reference Metadata
**Steps:**
1. Edit an existing reference
2. Change title, type, comment, favorite
3. Save

**Expected Results:**
- All fields update correctly
- UI reflects changes immediately

---

### 8. References - Delete Reference

#### 8.1 Delete Reference
**Steps:**
1. Click delete button on a reference
2. Confirm deletion

**Expected Results:**
- Reference removed from list
- Soft delete (deleted flag set, not hard deleted)

---

### 9. References - Drag and Drop Reordering

**Preconditions:**
- At least 2 references exist

#### 9.1 Reorder References
**Steps:**
1. Drag first reference below second using grip handle
2. Release

**Expected Results:**
- References swap positions
- Visual feedback during drag

#### 9.2 Reorder Persistence
**Steps:**
1. Reorder references
2. Refresh page
3. Return to same tune

**Expected Results:**
- New order persists after refresh

---

### 10. References - Open Links

#### 10.1 Click Reference Opens in New Tab
**Steps:**
1. Click on a reference link text

**Expected Results:**
- Link opens in new browser tab
- Original TuneTrees tab remains

---

### 11. Cross-Feature: Tune Selection

#### 11.1 Notes/References Update When Tune Changes
**Steps:**
1. Select Tune A (which has notes)
2. Observe notes panel shows Tune A's notes
3. Select Tune B (different notes or none)

**Expected Results:**
- Notes panel updates to show Tune B's notes
- References panel updates similarly
- No cross-contamination of data

#### 11.2 Empty State When No Tune Selected
**Steps:**
1. Deselect all tunes (if possible) or navigate to view without selection

**Expected Results:**
- Notes panel shows "Select a tune to view notes"
- References panel shows similar message

---

### 12. Edge Cases

#### 12.1 Very Long Note Content
**Steps:**
1. Create note with 10,000+ characters

**Expected Results:**
- Content saves successfully
- Display truncates or scrolls appropriately

#### 12.2 Special Characters in Note
**Steps:**
1. Create note with: `<script>alert('xss')</script>` and emoji 🎵🎶

**Expected Results:**
- Script is escaped/not executed
- Emoji displays correctly

#### 12.3 Concurrent Edits (Multi-tab)
**Steps:**
1. Open TuneTrees in two browser tabs
2. Edit same note in both tabs
3. Save in both

**Expected Results:**
- Last write wins (no data corruption)
- One tab may need refresh to see other's changes

#### 12.4 Network Disconnection During Save
**Steps:**
1. Disable network (DevTools → Network → Offline)
2. Create/edit a note
3. Re-enable network

**Expected Results:**
- Local save succeeds immediately
- Sync queue processes when network returns
- Data eventually consistent

---

### 13. Performance

#### 13.1 Many Notes Display Performance
**Preconditions:**
- Tune with 50+ notes

**Steps:**
1. Select the tune
2. Observe notes panel load time

**Expected Results:**
- Notes load within 2 seconds
- Scrolling is smooth
- No UI blocking

---

## Code Examples

### Test Suite: NOTES-001 - Notes CRUD Operations

**File:** `e2e/tests/notes-001-crud.spec.ts`

```typescript
import { expect } from "@playwright/test";
import { TEST_TUNE_BANISH_ID } from "../../tests/fixtures/test-data";
import { setupForRepertoireTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * NOTES-001: Notes CRUD Operations
 * Priority: Critical
 *
 * Tests for creating, reading, editing, and deleting notes.
 */

let ttPage: TuneTreesPage;

test.describe.serial("NOTES-001: Notes CRUD Operations", () => {
  test.beforeEach(async ({ page, testUser }) => {
    await setupForRepertoireTestsParallel(page, testUser, {
      repertoireTunes: [TEST_TUNE_BANISH_ID],
      scheduleTunes: false,
    });
    ttPage = new TuneTreesPage(page);
    
    // Select tune to show sidebar panels
    await ttPage.clickTune("Banish Misfortune", ttPage.repertoireGrid);
    await expect(ttPage.notesPanel).toBeVisible({ timeout: 10000 });
  });

  test("should display notes panel with empty state", async () => {
    await expect(ttPage.notesPanel).toBeVisible({ timeout: 10000 });
    await expect(ttPage.notesCount).toContainText("0 notes");
    await expect(ttPage.notesEmptyMessage).toBeVisible({ timeout: 5000 });
    await expect(ttPage.notesAddButton).toBeVisible({ timeout: 5000 });
  });

  test("should create a new note with text content", async ({ page }) => {
    // Click Add button
    await ttPage.notesAddButton.click();
    await expect(ttPage.notesNewEditor).toBeVisible({ timeout: 10000 });
    
    // Type in Jodit editor
    const joditEditor = ttPage.notesNewEditor.locator(".jodit-wysiwyg");
    await joditEditor.click();
    await joditEditor.fill("Test note content");
    
    // Save
    await expect(ttPage.notesSaveButton).toBeEnabled();
    await ttPage.notesSaveButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    
    // Verify note appears
    await expect(ttPage.notesCount).toContainText("1 note");
    await expect(ttPage.getAllNoteItems()).toHaveCount(1);
  });

  test("should disable save button when editor is empty", async () => {
    await ttPage.notesAddButton.click();
    await expect(ttPage.notesNewEditor).toBeVisible({ timeout: 10000 });
    await expect(ttPage.notesSaveButton).toBeDisabled();
  });

  test("should cancel note creation without saving", async () => {
    await ttPage.notesAddButton.click();
    await expect(ttPage.notesNewEditor).toBeVisible({ timeout: 10000 });
    
    // Type content
    const joditEditor = ttPage.notesNewEditor.locator(".jodit-wysiwyg");
    await joditEditor.click();
    await joditEditor.fill("This will be cancelled");
    
    // Cancel
    await ttPage.notesCancelButton.click();
    
    // Verify editor closed and no note created
    await expect(ttPage.notesNewEditor).not.toBeVisible();
    await expect(ttPage.notesCount).toContainText("0 notes");
  });
});
```

---

### Test Suite: NOTES-002 - Notes Drag Reorder

**File:** `e2e/tests/notes-002-drag-reorder.spec.ts`

```typescript
import { expect } from "@playwright/test";
import { TEST_TUNE_BANISH_ID } from "../../tests/fixtures/test-data";
import { setupForRepertoireTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * NOTES-002: Notes Drag-and-Drop Reordering
 * Priority: High
 *
 * Tests for drag-and-drop reordering of notes.
 * Requires at least 2 notes to exist.
 */

let ttPage: TuneTreesPage;

test.describe.serial("NOTES-002: Notes Drag Reorder", () => {
  test.beforeEach(async ({ page, testUser }) => {
    await setupForRepertoireTestsParallel(page, testUser, {
      repertoireTunes: [TEST_TUNE_BANISH_ID],
      scheduleTunes: false,
    });
    ttPage = new TuneTreesPage(page);
    
    // Select tune and create 2 notes for reordering tests
    await ttPage.clickTune("Banish Misfortune", ttPage.repertoireGrid);
    await expect(ttPage.notesPanel).toBeVisible({ timeout: 10000 });
    
    // Create first note
    await ttPage.addNote("First note");
    // Create second note
    await ttPage.addNote("Second note");
    
    await expect(ttPage.getAllNoteItems()).toHaveCount(2, { timeout: 10000 });
  });

  test("should display drag handles on notes", async () => {
    const noteItems = ttPage.getAllNoteItems();
    const firstNoteTestId = await noteItems.first().getAttribute("data-testid");
    const noteId = firstNoteTestId?.replace("note-item-", "");
    
    if (noteId) {
      await expect(ttPage.getNoteDragHandle(noteId)).toBeVisible({ timeout: 5000 });
    }
  });

  test("should reorder notes via drag-and-drop", async ({ page }) => {
    // Get initial order
    const noteItems = ttPage.getAllNoteItems();
    const firstNoteTestId = await noteItems.first().getAttribute("data-testid");
    const secondNoteTestId = await noteItems.nth(1).getAttribute("data-testid");
    
    const firstNoteId = firstNoteTestId?.replace("note-item-", "") || "";
    const secondNoteId = secondNoteTestId?.replace("note-item-", "") || "";
    
    // Drag first note to second position
    const firstDragHandle = ttPage.getNoteDragHandle(firstNoteId);
    const secondNoteItem = ttPage.getNoteItem(secondNoteId);
    
    await firstDragHandle.dragTo(secondNoteItem);
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    
    // Verify order changed - second note should now be first
    const newFirstNoteTestId = await noteItems.first().getAttribute("data-testid");
    expect(newFirstNoteTestId).toBe(`note-item-${secondNoteId}`);
  });
});
```

---

### Test Suite: REFS-001 - References CRUD Operations

**File:** `e2e/tests/refs-001-crud.spec.ts`

```typescript
import { expect } from "@playwright/test";
import { TEST_TUNE_BANISH_ID } from "../../tests/fixtures/test-data";
import { setupForRepertoireTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * REFS-001: References CRUD Operations
 * Priority: Critical
 *
 * Tests for creating, reading, editing, and deleting references.
 */

let ttPage: TuneTreesPage;

test.describe.serial("REFS-001: References CRUD Operations", () => {
  test.beforeEach(async ({ page, testUser }) => {
    await setupForRepertoireTestsParallel(page, testUser, {
      repertoireTunes: [TEST_TUNE_BANISH_ID],
      scheduleTunes: false,
    });
    ttPage = new TuneTreesPage(page);
    
    await ttPage.clickTune("Banish Misfortune", ttPage.repertoireGrid);
    await expect(ttPage.referencesPanel).toBeVisible({ timeout: 10000 });
  });

  test("should display references panel with empty state", async () => {
    await expect(ttPage.referencesPanel).toBeVisible({ timeout: 10000 });
    await expect(ttPage.referencesCount).toContainText("0 references");
    await expect(ttPage.referencesAddButton).toBeVisible({ timeout: 5000 });
  });

  test("should create a reference with YouTube URL", async ({ page }) => {
    await ttPage.referencesAddButton.click();
    await expect(ttPage.referenceForm).toBeVisible({ timeout: 10000 });
    
    await ttPage.referenceUrlInput.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    
    // Wait for auto-detection
    await page.waitForTimeout(500);
    
    // Verify type auto-detected to video
    await expect(ttPage.referenceTypeSelect).toHaveValue("video");
    
    await ttPage.referenceSubmitButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    
    // Verify reference appears
    await expect(ttPage.referencesCount).toContainText("1 reference");
    await expect(ttPage.getAllReferenceItems()).toHaveCount(1);
  });

  test("should show validation error for invalid URL", async () => {
    await ttPage.referencesAddButton.click();
    await expect(ttPage.referenceForm).toBeVisible({ timeout: 10000 });
    
    await ttPage.referenceUrlInput.fill("not a valid url");
    
    // Validation error should appear
    await expect(ttPage.page.getByText(/valid URL/i)).toBeVisible({ timeout: 5000 });
  });

  test("should cancel reference creation", async () => {
    await ttPage.referencesAddButton.click();
    await expect(ttPage.referenceForm).toBeVisible({ timeout: 10000 });
    
    await ttPage.referenceUrlInput.fill("https://example.com");
    await ttPage.referenceCancelButton.click();
    
    await expect(ttPage.referenceForm).not.toBeVisible();
    await expect(ttPage.referencesCount).toContainText("0 references");
  });
});
```

---

### Test Suite: REFS-002 - References Drag Reorder

**File:** `e2e/tests/refs-002-drag-reorder.spec.ts`

```typescript
import { expect } from "@playwright/test";
import { TEST_TUNE_BANISH_ID } from "../../tests/fixtures/test-data";
import { setupForRepertoireTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * REFS-002: References Drag-and-Drop Reordering
 * Priority: High
 *
 * Tests for drag-and-drop reordering of references.
 */

let ttPage: TuneTreesPage;

test.describe.serial("REFS-002: References Drag Reorder", () => {
  test.beforeEach(async ({ page, testUser }) => {
    await setupForRepertoireTestsParallel(page, testUser, {
      repertoireTunes: [TEST_TUNE_BANISH_ID],
      scheduleTunes: false,
    });
    ttPage = new TuneTreesPage(page);
    
    await ttPage.clickTune("Banish Misfortune", ttPage.repertoireGrid);
    await expect(ttPage.referencesPanel).toBeVisible({ timeout: 10000 });
    
    // Create 2 references for reordering tests
    await ttPage.addReference("https://www.youtube.com/watch?v=abc123");
    await ttPage.addReference("https://thesession.org/tunes/2");
    
    await expect(ttPage.getAllReferenceItems()).toHaveCount(2, { timeout: 10000 });
  });

  test("should display drag handles on references", async () => {
    const refItems = ttPage.getAllReferenceItems();
    const firstRefTestId = await refItems.first().getAttribute("data-testid");
    const refId = firstRefTestId?.replace("reference-item-", "");
    
    if (refId) {
      await expect(ttPage.getReferenceDragHandle(refId)).toBeVisible({ timeout: 5000 });
    }
  });

  test("should reorder references via drag-and-drop", async ({ page }) => {
    const refItems = ttPage.getAllReferenceItems();
    const firstRefTestId = await refItems.first().getAttribute("data-testid");
    const secondRefTestId = await refItems.nth(1).getAttribute("data-testid");
    
    const firstRefId = firstRefTestId?.replace("reference-item-", "") || "";
    const secondRefId = secondRefTestId?.replace("reference-item-", "") || "";
    
    // Drag first reference to second position
    const firstDragHandle = ttPage.getReferenceDragHandle(firstRefId);
    const secondRefItem = ttPage.getReferenceItem(secondRefId);
    
    await firstDragHandle.dragTo(secondRefItem);
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    
    // Verify order changed
    const newFirstRefTestId = await refItems.first().getAttribute("data-testid");
    expect(newFirstRefTestId).toBe(`reference-item-${secondRefId}`);
  });
});
```

---

## Test Implementation Notes

### Wait Strategies
- Wait for Jodit editor initialization: check for `.jodit-wysiwyg` element
- Wait for auto-save: 2500ms minimum after typing
- Wait for sync: check sync queue or wait 6+ seconds
- After drag-drop: `waitForLoadState('networkidle')`

### Test Data Cleanup
- Each test should clean up created notes/references
- Use soft delete or direct database cleanup
- Consider using dedicated test playlist/tunes

---

## Priority Matrix

| Test | Priority | Complexity |
|------|----------|------------|
| 1.1 Create Note | Critical | Low |
| 2.1 Edit Note | Critical | Medium |
| 3.1 Delete Note | Critical | Low |
| 4.1 Drag Reorder Notes | High | High |
| 4.2 Reorder Persistence | High | Medium |
| 6.1 Create Reference | Critical | Low |
| 7.1 Edit Reference | High | Medium |
| 8.1 Delete Reference | High | Low |
| 9.1 Drag Reorder Refs | High | High |
| 9.2 Reorder Persistence | High | Medium |
| 11.1 Tune Selection | Critical | Low |
| 12.4 Offline Save | Medium | High |

---

## Data-testid Attributes (Implemented)

### Notes Panel (`NotesPanel.tsx`)
- `notes-panel` - Container
- `notes-count` - Header count text
- `notes-add-button` - Add note button
- `notes-new-editor` - New note editor container
- `notes-save-button` - Save button
- `notes-cancel-button` - Cancel button
- `notes-list` - Notes list ul
- `notes-empty-message` - Empty state message
- `notes-no-tune-message` - No tune selected message
- `notes-loading` - Loading message
- `note-item-{id}` - Individual note item
- `note-drag-handle-{id}` - Drag handle
- `note-edit-button-{id}` - Edit button
- `note-delete-button-{id}` - Delete button
- `note-content-{id}` - Content display
- `note-editor-{id}` - Editor (edit mode)
- `note-date-{id}` - Date display

### References Panel (`ReferencesPanel.tsx`, `ReferenceList.tsx`, `ReferenceForm.tsx`)
- `references-panel` - Container
- `references-count` - Header count text
- `references-add-button` - Add button
- `references-add-form` - Add form container
- `references-edit-form` - Edit form container
- `references-list` - References list ul
- `references-no-tune-message` - No tune message
- `references-loading` - Loading message
- `reference-item-{id}` - Individual reference item
- `reference-drag-handle-{id}` - Drag handle
- `reference-link-{id}` - Link button
- `reference-edit-button-{id}` - Edit button
- `reference-delete-button-{id}` - Delete button
- `reference-form` - Form element
- `reference-url-input` - URL input
- `reference-title-input` - Title input
- `reference-type-select` - Type dropdown
- `reference-comment-input` - Comment textarea
- `reference-favorite-checkbox` - Favorite checkbox
- `reference-submit-button` - Submit button
- `reference-cancel-button` - Cancel button

---

## Related

- Issue: https://github.com/sboagy/tunetrees/issues/250
- PR: https://github.com/sboagy/tunetrees/pull/299

---

**Created:** November 29, 2025  
**Updated:** November 29, 2025  
**Author:** GitHub Copilot (for @sboagy)
