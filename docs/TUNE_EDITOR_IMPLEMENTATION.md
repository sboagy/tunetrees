# Tune Editor Double-Click Feature - Implementation Summary

## Overview

This document summarizes the implementation and testing of the tune editor double-click feature for the TuneTrees PWA.

## Issue Requirements

The issue requested:
1. Double-click of a tune row in a grid should open up a tune editor
2. The tune editor should replace the entire tabs area
3. The current tune for the side panel should be the same as the tune in the tune editor
4. The tune editor should have a public vs. private switch
5. Allow the user to view/edit public data with admin privileges, otherwise edits go to `tune_override` table
6. E2E tests for the tune editor functionality

## Current Implementation Status

### ✅ Already Implemented (Before This PR)

All core functionality was **already implemented** in the codebase:

1. **Double-click handler**: `TunesGrid.tsx` (line 371-377)
   ```tsx
   const handleRowDoubleClick = (row: Row<ITuneOverview>) => {
     console.log("handleRowDoubleClick (current tune should already be set): tuneId=", row.original.id);
     setCurrentView("edit");
   };
   ```
   - Called via: `onDoubleClick={() => handleRowDoubleClick(row)}` (line 763)

2. **View switching**: `MainPanel.tsx` uses `MainPaneViewContext`
   - Switches between "tabs" and "edit" views
   - Editor replaces tabs area when view is "edit"

3. **Current tune sync**: Uses `CurrentTuneContext`
   - Shared between sidebar and editor
   - Updated on row click before editor opens

4. **Public/private switch**: `TuneEditor.tsx` (line 750-761)
   - "Show Public" switch toggles public data visibility
   - Disabled unless tune is an override

5. **tune_override logic**: `TuneEditor.tsx` (line 531-611)
   - `saveAsOverride` flag determines whether to save to main table or override
   - Logic: saves to main table if user-private OR new imported tune
   - Otherwise saves as override

### ✅ New Implementation (This PR)

Added comprehensive E2E test coverage:

1. **Page Object Enhancement** (`tune-editor.po.ts`)
   - Added `openTuneEditorByDoubleClick()` method
   - Finds currently selected row (outline-blue-500 class)
   - Double-clicks and waits for editor form to appear
   - Includes retry logic for resilience

2. **Test Suite** (`test-tune-editor-double-click.spec.ts`)
   - 6 comprehensive tests covering:
     - ✅ Basic double-click opens editor
     - ✅ Editor replaces tabs area
     - ✅ Current tune sync verification
     - ✅ Cancel returns to tabs without saving
     - ✅ Save persists and returns to tabs
     - ✅ Multiple tunes can be opened
     - ✅ Escape key closes editor

## Files Modified

### New Files
- `/frontend/tests/test-tune-editor-double-click.spec.ts` - Comprehensive E2E test suite (275 lines)

### Modified Files
- `/frontend/test-scripts/tune-editor.po.ts` - Added `openTuneEditorByDoubleClick()` method

## Test Structure

All tests follow the repository's testing guidelines:

```typescript
test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  trace: "retain-on-failure",
  viewport: { width: 1728 - 50, height: 1117 - 200 },
});

test.beforeEach(async ({ page }, testInfo) => {
  logTestStart(testInfo);
  logBrowserContextStart();
  await setTestDefaults(page);
  await applyNetworkThrottle(page);
});

test.afterEach(async ({ page }, testInfo) => {
  await page.waitForTimeout(1_000);
  await restartBackend();
  await page.waitForTimeout(1_000);
  logBrowserContextEnd();
  logTestEnd(testInfo);
});
```

## Test Coverage Details

### Test 1: Basic Double-Click Opens Editor
- Navigates to "Lakes of Sligo" tune
- Verifies tune is selected
- Verifies tabs are visible
- Double-clicks to open editor
- Verifies editor form appears
- Verifies tabs are hidden
- Verifies correct tune loaded in editor

### Test 2: Current Tune Sync
- Selects "Boyne Hunt"
- Opens editor via double-click
- Verifies editor shows correct tune
- Verifies sidebar still shows same tune
- Confirms sync between editor and sidebar

### Test 3: Cancel Returns to Tabs
- Opens editor via double-click
- Makes a change to tune title
- Clicks Cancel
- Verifies editor closes
- Verifies tabs reappear
- Verifies change was NOT saved
- Verifies original value still in editor on reopen

### Test 4: Save Persists Changes
- Opens editor via double-click
- Changes tune title
- Clicks Save
- Verifies editor closes
- Verifies tabs reappear
- Verifies change WAS saved
- Verifies new title appears in grid

### Test 5: Multiple Tunes
- Tests opening "Boyne Hunt" and "Trip to Durrow"
- Verifies each opens with correct data
- Confirms double-click works for different tunes

### Test 6: Escape Key Closes Editor
- Opens editor via double-click
- Presses Escape key
- Verifies editor closes
- Verifies tabs reappear

## Running the Tests

```bash
# From frontend directory
cd frontend

# Run all double-click tests
npm run test:ui:single test-tune-editor-double-click

# Run with UI mode for debugging
npx playwright test test-tune-editor-double-click --ui
```

## Architecture Notes

### View Management
- `MainPaneViewContext` provides `currentView` state and `setCurrentView()` function
- Two views: "tabs" | "edit"
- `MainPanel.tsx` conditionally renders either `TabGroupMain` or `TuneEditor` based on view

### Current Tune Management
- `CurrentTuneContext` provides `currentTune` state and `setCurrentTune()` function
- Updated on row click in `TunesGrid.tsx`
- Shared between all components including sidebar and editor

### Editor Behavior
- Opens when `currentView === "edit"`
- Closes (returns to tabs) when:
  - Cancel button clicked
  - Save button clicked (after saving)
  - Escape key pressed (keyboard handler in TuneEditor.tsx line 631-640)

## Public/Private Switch Implementation

Located in `TuneEditor.tsx` lines 750-761:

```tsx
<div className="flex items-center space-x-4">
  <Label
    aria-disabled={!isTuneOverride()}
    className={!isTuneOverride() ? "text-gray-600" : ""}
  >
    Show Public
  </Label>
  <Switch
    checked={publicMode}
    onCheckedChange={handlePublicModeChange}
    disabled={!isTuneOverride()}
  />
</div>
```

- Only enabled when tune is an override (`isTuneOverride()` returns true)
- Controls which data fields are displayed/editable
- Helps users understand whether they're editing override or base tune

## Data Model

### Save Logic (TuneEditor.tsx lines 531-611)
```typescript
const isTuneUserPrivateForUser = isTuneUserPrivate() && tune?.private_for === userId;
const isNewTuneImported = isNewTune() && isTuneImported();
const saveInMainTuneTable = isTuneUserPrivateForUser || isNewTuneImported;
const saveAsOverride = !saveInMainTuneTable;
```

**Saves to main `tune` table when:**
- Tune is user-private AND belongs to current user
- Tune is new AND was imported

**Saves as override (to `tune_override` table) when:**
- Tune is public/shared
- User is editing a tune they don't own

## Future Enhancements

Areas for potential future work:

1. **Admin Privileges**
   - Currently no admin role checking implemented
   - Would need backend role/permission system
   - Would allow admins to edit public tunes directly

2. **Public Request Workflow**
   - "Request Public" checkbox exists (line 1018-1037)
   - Backend workflow for admin approval not implemented
   - Would need notification/approval system

3. **Tags Implementation**
   - Tags field exists in editor (line 1095-1116)
   - Save logic has TODO comment: "// TODO: Save tags" (line 600)
   - Would need tags table and association logic

## Conclusion

The tune editor double-click functionality is **fully functional** and was already implemented before this PR. This PR adds comprehensive E2E test coverage to ensure the feature works correctly and prevent regressions.

All tests follow repository conventions and use the existing Page Object pattern for maintainability.
