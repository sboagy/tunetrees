# TuneEditor Refactoring Plan

**Date:** January 2025  
**Status:** Draft - Awaiting Approval  
**Branch:** `copilot/fix-editor-user-fi` → will create new branch for implementation  
**Related Issues:** Part of TuneEditor cleanup effort

---

## Executive Summary

Simplify TuneEditor by:
1. Removing private notes (already shown in side panel)
2. Removing FSRS/SM2 collapsible sections (moving to new Practice History panel)
3. Adding `playlist_tune` fields: learned, goal, scheduled, current (read-only)
4. Adding navigation to a new Practice History panel
5. Adding tooltips for ALL editable fields

The refactored editor will focus on tune metadata and scheduling overrides, with practice history accessible via a dedicated route.

---

## Current State

TuneEditor currently manages data from 5 tables:
- `tune` - Core tune metadata (title, type, structure, mode, incipit, genre)
- `tune_override` - User-specific overrides for public tunes
- `playlist_tune` - Per-playlist settings (currently only shows learned date)
- `practice_record` - Latest FSRS/SM2 scheduling data (shown in collapsible sections)
- `note` - Private notes (shown in collapsible section)

**Problems:**
- Private notes duplicated in side panel
- FSRS/SM2 fields are read-only and belong in a history view
- Missing key `playlist_tune` fields (goal, scheduled, current)
- No easy way to view full practice history

---

## Proposed Changes

### Fields to REMOVE from TuneEditor

1. **Private Notes Section** - Already displayed in side panel; remove redundancy
2. **FSRS Collapsible Section** - All fields (stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review)
3. **SM2 Collapsible Section** - All fields (easiness, interval, repetitions, review_date, quality)

### Fields to ADD to TuneEditor

Under "Your Playlist Settings" (playlist_tune table):

| Field | Type | Editable | Description |
|-------|------|----------|-------------|
| Learned Date | Date picker | Yes | When you learned this tune |
| Practice Goal | Dropdown | Yes | Your target proficiency level |
| Schedule Override | Date picker | Yes | Force tune into queue on this date (cleared on next practice commit) |
| Next Review (Computed) | Date display | No (read-only) | FSRS-computed next review date (mirrors practice_record.due) |

**Practice Goal Options:**
- Initial Learn
- Recall
- Fluency
- Session Ready
- Performance Polish

### Navigation Elements to ADD

1. **TuneEditor**: Button labeled "View Practice History →" that navigates to `/tunes/[id]/practice-history`
2. **TuneInfoHeader**: Small link below tune ID that reads "Practice History" linking to same route

---

## Tooltip Specifications

All TuneEditor fields must have tooltips using HelpCircle icon with title attribute.

### Tune Metadata Fields (tune / tune_override)

| Field | Tooltip Text |
|-------|-------------|
| Genre | The musical genre or tradition this tune belongs to (e.g., Irish, Scottish, Old-Time) |
| Title | The name of the tune. Overrides apply only to your view. |
| Type | The tune form (e.g., jig, reel, hornpipe, waltz) |
| Structure | The parts and their sequence (e.g., AABB, AABBCC) |
| Mode | The musical mode (e.g., major, dorian, mixolydian) |
| Incipit | The opening notes in ABC notation - helps identify the tune |
| Tags | Custom labels for organizing and filtering your tunes |
| Request Public | Submit your tune data to the shared catalog for others to use |

### Playlist Settings Fields (playlist_tune)

| Field | Tooltip Text |
|-------|-------------|
| Learned Date | The date you consider yourself to have learned this tune |
| Practice Goal | Your target proficiency level - affects how the tune appears in practice lists |
| Schedule Override | Force this tune into your practice queue on this date. Cleared after you practice it. |
| Next Review (Computed) | The FSRS-calculated next review date. This is read-only and updates automatically after each practice. |

---

## New Routes

| Route | Purpose | Components |
|-------|---------|------------|
| `/tunes/[id]/practice-history` | View and edit practice history with FSRS/SM2 data | PracticeHistoryGrid |

### Practice History Grid Features

The practice history route displays an **editable grid** of all practice records for the tune:

**Columns:**
- Date (practiced_at) - Editable date picker
- Quality (0-5) - Editable dropdown
- Stability - Read-only (FSRS computed)
- Difficulty - Read-only (FSRS computed)
- Due - Editable date picker
- Elapsed Days - Read-only (computed)
- Scheduled Days - Read-only (computed)
- Reps - Read-only (counter)
- Lapses - Read-only (counter)
- State - Read-only (FSRS state)

**Grid Actions:**
- Edit individual cells inline
- Delete practice records (with confirmation)
- Add new practice record manually
- Save all changes button
- Discard changes button

**Layout:**
- Header with tune title and "Back to Editor" link
- Summary section showing current FSRS/SM2 parameters
- Editable TanStack Solid Table grid
- Action bar at bottom

---

## Implementation Phases

### Phase 1: Remove Private Notes Section
- Remove the collapsible "Notes" section from TuneEditor
- Remove note-related state and queries from TuneEditor
- Verify side panel continues to work correctly

### Phase 2: Remove FSRS/SM2 Sections, Add playlist_tune Fields
- Remove FSRS collapsible section and all related state
- Remove SM2 collapsible section and all related state
- Add four new fields under "Your Playlist Settings": learned, goal, scheduled, current
- Add "View Practice History →" button with navigation

### Phase 3: Create Practice History Route and Editable Grid
- Create route at `/tunes/[id]/practice-history`
- Create PracticeHistoryGrid component with:
  - TanStack Solid Table with inline editing
  - Editable columns: practiced_at, quality, due
  - Read-only columns: stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state
  - Add/delete practice record functionality
  - Save/discard changes actions
  - Summary section showing current FSRS/SM2 parameters
  - Navigation back to tune editor

### Phase 4: Add Navigation Elements
- Add link in TuneInfoHeader below tune ID
- Ensure consistent navigation between TuneEditor and PracticeHistoryPanel
- Add breadcrumb or back navigation

### Phase 5: Add Tooltips to All Fields
- Implement HelpCircle tooltip pattern for all fields listed above
- Ensure consistent styling and placement

### Phase 6: Update E2E Tests
- Update tune-editor.spec.ts to reflect removed sections
- Add tests for new playlist_tune fields
- Add tests for practice history navigation
- Verify new.tsx (create new tune) still works

---

## File Impact Summary

### Files to Modify
- `src/routes/tunes/[id]/edit.tsx` - TuneEditor refactoring
- `src/components/TuneInfoHeader.tsx` - Add practice history link
- `e2e/tune-editor.spec.ts` - Update tests

### Files to Create
- `src/routes/tunes/[id]/practice-history/index.tsx` - Practice history route with editable grid
- `src/components/PracticeHistoryGrid.tsx` - Editable TanStack Solid Table component

### Files Unchanged
- `src/routes/tunes/new.tsx` - Should continue working (creates new tunes)
- Side panel note display - Unaffected by TuneEditor changes

---

## Questions / Decisions Needed

1. **Schedule Override Behavior**: Should clearing happen automatically on practice commit, or should user manually clear?
   - *Current assumption: Auto-clear on commit*

2. **Back Navigation**: From PracticeHistoryPanel, should "Back" go to TuneEditor or to the grid?
   - *Current assumption: Back to TuneEditor*

---

## Approval Checklist

- [ ] Agree with fields to remove (private notes, FSRS, SM2)
- [ ] Agree with fields to add (learned, goal, scheduled, current)
- [ ] Agree with new routes structure
- [ ] Agree with tooltip text for all fields
- [ ] Confirm auto-clear behavior for scheduled override
- [ ] Approve implementation order

---

**Ready for approval. No code changes will be made until this plan is approved.**
