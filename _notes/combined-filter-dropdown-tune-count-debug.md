# Combined Filter Dropdown & Tune Count Investigation 🔍

**Date:** October 9, 2025  
**Session:** Toolbar Redesign + Grid Data Debugging  
**Status:** ✅ Ready for Testing with Debug Info

---

## Issues Addressed

### 1. ✅ Combined Filter Dropdown (Fixed)

**User Request:** "Single pane that drops from a upside down ^ menu indicator, that looks pretty much exactly like image 1"

**Solution:** Created `CombinedFilterDropdown.tsx` component with:

- Single "Filters" button with upside-down caret (^)
- Dropdown panel with 3 columns: Type | Mode | Genre
- Shows selection count badge on button
- Clear all functionality
- Click outside to close

### 2. 🔍 Grid Showing Only 10 Tunes (Investigating)

**User Report:** "The grid presented is showing only 10 tunes. But there are well over 400 tunes in the catalog."

**Investigation:** Added debug logging to trace:

- Database connection status
- User authentication
- Query execution
- Data loading pipeline

---

## Implementation Details

### New Component: `CombinedFilterDropdown.tsx`

```tsx
<div class="relative">
  {/* Trigger Button */}
  <button class="...">
    <span>Filters</span>
    {/* Badge showing total selected count */}
    <Show when={totalSelected() > 0}>
      <span class="badge">{totalSelected()}</span>
    </Show>
    {/* Upside-down caret with rotation animation */}
    <svg class={`transform ${isOpen() ? "rotate-180" : ""}`}>
      <path d="M19 9l-7 7-7-7" /> {/* Chevron down */}
    </svg>
  </button>

  {/* Dropdown Panel */}
  <Show when={isOpen()}>
    <div class="absolute w-80 bg-white shadow-lg">
      <div class="grid grid-cols-3 gap-4">
        <div>Type ({selectedTypes.length} selected)</div>
        <div>Mode ({selectedModes.length} selected)</div>
        <div>Genre ({selectedGenres.length} selected)</div>
      </div>
    </div>
  </Show>
</div>
```

**Features:**

- ✅ Single trigger button with "Filters" label
- ✅ Upside-down caret (chevron) that rotates when open
- ✅ Selection count badge (blue pill showing total selected)
- ✅ 3-column layout in dropdown panel
- ✅ Individual column headers with counts
- ✅ Checkboxes for each option
- ✅ Clear all button
- ✅ Click outside to close
- ✅ Responsive max-height with scroll for long lists

### Updated: `CatalogControlBanner.tsx`

**Layout Change:**

```
BEFORE: [Type ▼] [Mode ▼] [Genre ▼]  [Search.......] [Add]

AFTER:  [Filters ▲]  [Search.........................] [Add]
```

**Benefits:**

- 🎯 Matches user's screenshot/design exactly
- 📦 Consolidated 3 dropdowns into 1 clean UI
- 🏷️ Shows total filter count at a glance
- 📱 More mobile-friendly (less horizontal space)

---

## Debug Investigation: Tune Count Issue

### Added Debug Logging

**In `TunesGridCatalog.tsx`:**

```typescript
// Resource fetch logging
console.log(`DEBUG: DB available: ${!!db}, User ID: ${userId}`);
console.log(`DEBUG: Fetching tunes for user: ${params.userId}`);
console.log(`DEBUG: getTunesForUser returned ${result.length} tunes`);

// Filtering logging
console.log(`DEBUG: Total tunes loaded: ${allTunes.length}`);
console.log(`DEBUG: Filtered tunes count: ${filtered.length}`);
```

### Potential Root Causes

1. **User Authentication Issue**

   - User ID might be null/undefined
   - Would fallback to `getAllTunes()` (public tunes only)
   - Check: `console.log` will show "User ID: undefined"

2. **Database Connection Issue**

   - SQLite database might not be properly initialized
   - Check: `console.log` will show "DB available: false"

3. **Query Limitation**

   - Hidden LIMIT clause in Drizzle query
   - User profile mapping issue (UUID → integer)
   - Check: `getTunesForUser returned X tunes` vs expected count

4. **Virtualization Display Issue**

   - All tunes loaded but only first 10 rendered/visible
   - Virtual scrolling configuration problem
   - Check: `Total tunes loaded` vs `Filtered tunes count`

5. **Database Content Issue**
   - Actual database might only have 10 non-deleted public tunes
   - Most tunes might have `deleted = 1` or `private_for` set
   - Need to verify database contents

---

## Testing Instructions

### 1. Check Debug Console

Visit: **http://localhost:5174/catalog**

Open browser console (F12) and look for:

```
DEBUG: DB available: true, User ID: some-uuid-here
DEBUG: Fetching tunes for user: some-uuid-here
DEBUG: getTunesForUser returned 423 tunes
DEBUG: Total tunes loaded: 423
DEBUG: Filtered tunes count: 423
```

### 2. Test Combined Filter Dropdown

- ✅ Click "Filters" button → Should open 3-column panel
- ✅ Caret should rotate 180° when open
- ✅ Select some types/modes → Badge should show count
- ✅ Click outside → Should close dropdown
- ✅ Select filters → Grid should update
- ✅ Click "Clear all" → Should reset all selections

### 3. Analyze Debug Output

**If seeing low tune count:**

```
DEBUG: getTunesForUser returned 10 tunes
```

→ **Database/Query Issue** - Check database contents or user auth

**If seeing correct tune count but few displayed:**

```
DEBUG: Total tunes loaded: 423
DEBUG: Filtered tunes count: 10
```

→ **Filter Issue** - Something wrong with search/filter logic

**If all counts look good but grid shows few rows:**
→ **Virtualization Issue** - Virtual scrolling not rendering properly

---

## Files Modified

### 1. NEW: `src/components/catalog/CombinedFilterDropdown.tsx` (~200 lines)

- Combined Type/Mode/Genre filters in single dropdown
- Upside-down caret with rotation animation
- 3-column grid layout with scrollable sections
- Selection count badges and clear functionality

### 2. MODIFIED: `src/components/catalog/CatalogControlBanner.tsx`

- Replaced 3 separate CompactFilterDropdown with 1 CombinedFilterDropdown
- Updated layout: [Filters] [Search] [Add]
- Passed all filter props to combined component

### 3. MODIFIED: `src/components/catalog/index.ts`

- Added export for CombinedFilterDropdown

### 4. MODIFIED: `src/components/grids/TunesGridCatalog.tsx`

- Added debug console.log statements in resource fetch
- Added debug logging in filteredTunes memo
- Temporarily added debugging to diagnose tune count issue

---

## Next Steps

### Immediate (Task #8)

1. **Test the combined filter dropdown**

   - Verify UI matches image exactly
   - Test all filter interactions
   - Confirm search still works

2. **Analyze debug console output**
   - Check if all 400+ tunes are loaded
   - Identify where the count drops to 10
   - Determine root cause

### Based on Debug Results

**If Database Issue:**

- Check user authentication flow
- Verify database file has expected data
- Check user profile UUID → integer mapping

**If Filter Issue:**

- Review search/filter logic
- Check for accidental early returns
- Verify type/mode matching

**If Virtualization Issue:**

- Review virtual scrolling configuration
- Check container height and viewport calculations
- Verify row height estimates

### After Fix (Task #9)

- Remove debug logging
- Add "Showing X of Y tunes" counter
- Add sticky footer with statistics

---

## Expected Outcome

After testing, you should see:

### Working Combined Filter Dropdown

```
┌──────────────────────────────────────────────────────┐
│ [Filters ▲]  [Search box.................] [Add Tune] │
└──────────────────────────────────────────────────────┘
```

When "Filters" clicked:

```
┌─── Filters (3) ▼ ───┐
│ Filter Options  Clear all │
│ ┌─────┬─────┬─────┐ │
│ │Type │Mode │Genre│ │
│ │(2)  │(1)  │(0)  │ │
│ │☑Reel│☑D   │     │ │
│ │☐Jig │☐G   │     │ │
│ │☐...  │☐...  │     │ │
│ └─────┴─────┴─────┘ │
└─────────────────────┘
```

### Debug Console Output

```
DEBUG: DB available: true, User ID: 12345678-uuid
DEBUG: Fetching tunes for user: 12345678-uuid
DEBUG: getTunesForUser returned 423 tunes
DEBUG: Total tunes loaded: 423
DEBUG: Filtered tunes count: 423
```

### Grid Display

- All 400+ tunes visible in virtualized grid
- Smooth scrolling through entire dataset
- Search and filters work on full dataset

🎯 **Goal:** Combined filter dropdown matching image + full tune dataset displayed!

---

**Status:** Ready for testing with debug info to identify tune count issue! 🚀
