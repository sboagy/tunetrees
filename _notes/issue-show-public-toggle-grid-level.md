# GitHub Issue: Add "Show Public" Toggle at Grid Level

## Title
Add "Show Public" toggle to Catalog grid to view original public tune data

## Labels
- enhancement
- catalog
- tune-overrides
- ui

## Priority
Medium

## Description

Currently, the Catalog tab displays tune data from `practice_list_staged`, which merges public tunes with user-specific overrides. Users can view the original public data in the tune editor via the "Show Public" toggle, but there's no way to see this at the grid level.

### Problem

When a user has created tune overrides (e.g., changed the title of a public tune), the Catalog grid shows the overridden values. This makes it difficult to:

1. Compare the original public tune data with user overrides
2. See which tunes have been overridden
3. Understand what the "canonical" public tune data looks like

### Proposed Solution

Add a "Show Public" toggle button to the Catalog toolbar (similar to the one in the tune editor) that:

- **Toggle OFF (default):** Shows `practice_list_staged` data (with user overrides)
- **Toggle ON:** Shows original `tune` table data (without overrides)

### Implementation Details

#### UI Changes

1. **Add toggle to CatalogToolbar component**
   - Position: Near the search box or filter controls
   - Label: "Show Public"
   - Icon: Eye icon or similar
   - State: OFF by default

2. **Visual indicator when toggle is ON**
   - Show banner or badge indicating public view mode
   - Consider graying out or hiding certain columns (e.g., learned date, quality)

#### Backend Changes

1. **Create dual data source in catalog.tsx**
   ```typescript
   // Current (with overrides)
   const [allTunes] = createResource(() => getTunesStaged(db, userId));
   
   // New (public only)
   const [publicTunes] = createResource(() => getTunesForUser(db, userId));
   
   // Switch based on toggle state
   const displayedTunes = () => showPublic() ? publicTunes() : allTunes();
   ```

2. **Update column definitions**
   - Some columns (learned, quality, notes) should be hidden or disabled in public view
   - Add visual indicator (e.g., icon) for tunes that have overrides

#### Alternative Approaches

**Option A: Single query with conditional columns**
- Query both datasets and merge them
- Show override indicators inline (e.g., "Title (overridden)")
- Pro: Shows both public and override data simultaneously
- Con: More complex UI, potentially confusing

**Option B: Side-by-side comparison**
- Split screen showing public vs override data
- Pro: Easy to compare changes
- Con: Requires significant UI redesign

**Option C: Override indicator only**
- Keep current view, but add icon/badge to overridden tunes
- Clicking icon shows diff modal
- Pro: Minimal UI change
- Con: Doesn't solve the "view all public data" use case

### User Stories

**User Story 1: Compare Public Data**
> As a user with tune overrides  
> I want to toggle between public and override data in the Catalog grid  
> So that I can see what I've changed and compare with original data

**User Story 2: Identify Overridden Tunes**
> As a user  
> I want to see which tunes have been overridden  
> So that I can manage my customizations

**User Story 3: Reset to Public**
> As a user viewing public data  
> I want to reset a tune to its original public values  
> So that I can undo unwanted overrides

### Acceptance Criteria

- [ ] Toggle button visible in Catalog toolbar
- [ ] Toggle OFF (default) shows practice_list_staged data (with overrides)
- [ ] Toggle ON shows tune table data (public only)
- [ ] Visual indicator when in public view mode
- [ ] Grid updates immediately when toggle changes
- [ ] Performance: No significant slowdown (< 100ms switch time)
- [ ] User-specific columns (learned, quality) hidden in public view
- [ ] Toggle state persists to localStorage (optional)

### Testing Requirements

- [ ] E2E test: Toggle switches between public and override data
- [ ] E2E test: Grid displays correct data in each mode
- [ ] E2E test: User-specific columns hidden in public mode
- [ ] Unit test: Data source switching logic
- [ ] Visual test: UI indicator displays correctly

### Dependencies

- Requires `getTunesForUser()` to return clean public data (already implemented)
- Requires `getTunesStaged()` to return merged override data (already implemented)
- May need to update grid column definitions for conditional display

### Related Issues

- #289 - Tune importer and editor refactor (implements editor-level toggle)
- Related to tune override functionality
- Related to catalog filtering and display

### Estimated Effort

**Development:** 4-6 hours
- UI toggle: 1 hour
- Data source switching: 2 hours
- Column conditional logic: 1-2 hours
- Testing: 1-2 hours

**Priority Ranking:** Medium (nice-to-have, not blocking)

### Notes

- The tune editor already has "Show Public" toggle implemented (PR #289)
- This issue extends that concept to the grid level
- Consider adding similar toggle to Repertoire grid in the future
- May want to add "Reset to Public" bulk action when this is implemented

### Mockup / Wireframe

```
┌────────────────────────────────────────────────────────────┐
│ Catalog                                                     │
├────────────────────────────────────────────────────────────┤
│ [Search...] [Type ▼] [Mode ▼] [Genre ▼]  [Show Public ⊙] │
│                                                             │
│ ℹ️  Viewing public tune data (overrides hidden)            │
│                                                             │
│ ┌──────────┬─────────────────┬──────────┬────────────────┐│
│ │ Id       │ Title           │ Type     │ Mode           ││
│ ├──────────┼─────────────────┼──────────┼────────────────┤│
│ │ 1960     │ Toss the        │ Reel     │ D Major        ││
│ │          │ Feathers        │          │                ││
│ │ 3436     │ I Buried My     │ Jig      │ G Major        ││
│ │          │ Wife...         │          │                ││
│ └──────────┴─────────────────┴──────────┴────────────────┘│
└────────────────────────────────────────────────────────────┘
```

### Implementation Checklist

- [ ] Create feature branch: `feat/catalog-show-public-toggle`
- [ ] Add toggle to CatalogToolbar component
- [ ] Add state management for toggle in catalog.tsx
- [ ] Implement data source switching logic
- [ ] Add visual indicator for public view mode
- [ ] Update column definitions for conditional display
- [ ] Write E2E tests for toggle functionality
- [ ] Update documentation
- [ ] Create PR and request review
- [ ] Merge after approval

---

**Created:** November 17, 2025  
**Status:** Proposed  
**Related PR:** TBD
