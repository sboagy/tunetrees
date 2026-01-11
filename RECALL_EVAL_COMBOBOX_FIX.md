# RecallEvalComboBox Test Flakes Fix

## Problem Statement

Tests were experiencing high flake rates when interacting with the `RecallEvalComboBox` component, particularly in flashcard-related tests. The affected tests were:

- `tests/flashcard-003-submit.spec.ts:254`
- `tests/flashcard-004-show-submitted.spec.ts:84`
- `tests/flashcard-005-grid-coordination.spec.ts:84`
- `tests/scheduling-001-basic-progression.spec.ts:83`
- `tests/scheduling-003-repeated-easy.spec.ts:110`

## Root Causes

### 1. Missing Controlled Open State in FlashcardCard
The `FlashcardCard` component was not passing `open` and `onOpenChange` props to `RecallEvalComboBox`, unlike the grid implementation. This meant that when the parent component re-rendered (e.g., after an evaluation change), the dropdown would lose its open state and close unexpectedly.

### 2. Grid Refresh Race Condition
When a user selects an evaluation, the following sequence occurs:
1. User clicks dropdown option
2. `onChange` handler is called
3. Parent component updates evaluation state
4. `incrementPracticeListStagedChanged()` is called (line 441 in `src/routes/practice/Index.tsx`)
5. Grid re-renders
6. Dropdown can close before the click event completes

### 3. Event Handling Issues
The dropdown trigger didn't have proper event propagation prevention, which could cause unintended interactions with parent components during re-renders.

### 4. Race Condition in handleSelect
Explicitly calling `onOpenChange(false)` in the `handleSelect` handler while Kobalte's `closeOnSelect` was also trying to close the menu could cause timing issues.

## Solution

### Changes to `RecallEvalComboBox.tsx`

1. **Added `onPointerDown` handler** to prevent event bubbling:
   ```tsx
   onPointerDown={(e) => {
     // Prevent event bubbling that could interfere with dropdown behavior
     e.stopPropagation();
   }}
   ```

2. **Added `handleSelect` wrapper** that calls `onChange` without manually closing:
   ```tsx
   const handleSelect = (value: string) => {
     // Call onChange with the new value
     props.onChange(value);
     // Note: closeOnSelect={true} on DropdownMenu.Item handles closing
     // No need to explicitly call onOpenChange here to avoid race conditions
   };
   ```

3. **Added `closeOnSelect={true}` to menu items** to ensure proper closing behavior:
   ```tsx
   <DropdownMenu.Item
     onSelect={() => handleSelect(option.value)}
     closeOnSelect={true}
   >
   ```

### Changes to `FlashcardCard.tsx`

1. **Added controlled open state** signal:
   ```tsx
   const [isEvalDropdownOpen, setIsEvalDropdownOpen] = createSignal(false);
   ```

2. **Added effect to close dropdown** when tune changes:
   ```tsx
   createEffect(() => {
     const tuneId = props.tune.id;
     // Close the dropdown whenever the tune changes
     setIsEvalDropdownOpen(false);
   });
   ```

3. **Passed open state to RecallEvalComboBox**:
   ```tsx
   <RecallEvalComboBox
     tuneId={props.tune.id}
     value={props.currentEvaluation}
     open={isEvalDropdownOpen()}
     onOpenChange={setIsEvalDropdownOpen}
     onChange={handleEvalChange}
   />
   ```

## How It Works

### Controlled Open State Pattern

The controlled open state pattern allows the dropdown to maintain its open/closed state across parent re-renders:

1. **Parent maintains state**: `FlashcardCard` and `TunesGridScheduled` both maintain a signal for tracking which dropdown is open
2. **State passed to child**: The `open` and `onOpenChange` props are passed to `RecallEvalComboBox`
3. **Kobalte respects controlled state**: When `open` is provided, Kobalte's DropdownMenu component will preserve the open state even if the parent re-renders
4. **Automatic cleanup**: When the tune/row changes, the parent resets the open state to `false`

### Event Flow

**Before Fix:**
```
User clicks option
  → onChange called
  → Parent re-renders
  → Dropdown loses open state
  → Click might not complete
  → FLAKE!
```

**After Fix:**
```
User clicks option
  → onChange called
  → Parent re-renders
  → Dropdown preserves open state (controlled)
  → closeOnSelect closes dropdown cleanly
  → ✓ Reliable behavior
```

## Testing Strategy

The fixes should be validated by:

1. **Running the affected tests multiple times** to ensure flakes are eliminated:
   ```bash
   npm run test:e2e:retest-failed:repeat-10
   ```

2. **Checking flashcard evaluation flow**:
   - Open flashcard mode
   - Select evaluation from dropdown
   - Verify dropdown closes cleanly
   - Verify evaluation is recorded

3. **Checking grid evaluation flow**:
   - Select evaluation from grid row dropdown
   - Verify dropdown closes cleanly
   - Verify grid refreshes without closing other open dropdowns

## Additional Notes

### Why Not Use Modal Mode?

The component uses `modal={false}` because:
- Modal mode would steal focus aggressively
- The dropdown needs to coexist with other UI elements
- Non-modal is the standard pattern for inline dropdowns

### Why closeOnSelect Instead of Manual Close?

Using Kobalte's built-in `closeOnSelect` is more reliable because:
- It's part of the component's internal lifecycle
- It handles edge cases automatically
- Avoids race conditions with manual state management

### Grid Already Had Open State Management

The `TunesGridScheduled` component already implemented the controlled open state pattern (lines 86-90 in `TunesGridScheduled.tsx`). This fix brings `FlashcardCard` to parity with that implementation.

## Related Files

- `src/components/grids/RecallEvalComboBox.tsx` - The dropdown component
- `src/components/practice/FlashcardCard.tsx` - Flashcard UI that uses the dropdown
- `src/components/grids/TunesGridScheduled.tsx` - Grid that already had the pattern
- `src/routes/practice/Index.tsx` - Parent that triggers re-renders via `incrementPracticeListStagedChanged()`
- `e2e/page-objects/TuneTreesPage.ts` - Test helpers with retry logic for the dropdown

## Migration Guide

If you need to use `RecallEvalComboBox` in a new component:

1. Add a signal to track open state:
   ```tsx
   const [isDropdownOpen, setIsDropdownOpen] = createSignal(false);
   ```

2. Pass the controlled state to the component:
   ```tsx
   <RecallEvalComboBox
     tuneId={tuneId}
     value={currentValue}
     open={isDropdownOpen()}
     onOpenChange={setIsDropdownOpen}
     onChange={handleChange}
   />
   ```

3. Add an effect to reset state when the context changes (optional but recommended):
   ```tsx
   createEffect(() => {
     const contextId = props.contextId;
     setIsDropdownOpen(false);
   });
   ```
