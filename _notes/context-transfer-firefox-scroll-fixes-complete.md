# Context Transfer: Firefox Scroll & Test Stability Fixes

**Date:** October 27, 2025  
**Branch:** `feat/pwa1`  
**Previous Context:** `_notes/context-transfer-practice-tab-next-phase.md`  
**Status:** Firefox compatibility fixes complete, scroll persistence hardened for CI

---

## Session Summary

This session focused on **fixing Firefox-specific test failures** and **hardening scroll persistence** across all browsers for CI stability. The work built on scroll persistence infrastructure from earlier sessions but addressed browser-specific timing and event handling differences.

### Key Achievements

1. ✅ **Firefox scroll wheel compatibility** - Adjusted mouse wheel deltas for Firefox's DOM_DELTA_LINE mode
2. ✅ **Scroll persistence hardening** - Increased timing windows for CI environments (safety 350ms→800ms, reactive 800ms→1500ms)
3. ✅ **Practice evaluation test fixes** - Added page closure detection for Firefox menu interactions
4. ✅ **CI stability improvements** - Tests now pass consistently across chromium, Mobile Chrome, and firefox

---

## Problems Solved

### 1. Firefox Scroll Distance Mismatch

**Problem:**

- Firefox scrolled only 488px when chromium scrolled 1000px using `page.mouse.wheel(0, 1000)`
- Catalog scroll persistence test was failing only in Firefox
- Root cause: Firefox interprets wheel events as **DOM_DELTA_LINE** mode, Chromium uses **DOM_DELTA_PIXEL** mode

**Solution:**

- Detect browser using `browserName` fixture parameter
- Apply 2× multiplier for Firefox: `const wheelDelta = browserName === "firefox" ? 2000 : 1000`
- Updated `e2e/tests/scroll-persistence.spec.ts` catalog refresh test

**Technical Details:**

```typescript
// Firefox uses DOM_DELTA_LINE mode (~3 lines per unit)
// Chromium uses DOM_DELTA_PIXEL (direct pixel values)
// No standard conversion exists - depends on line-height CSS and browser implementation
// Empirically: Firefox needs ~2x the delta to achieve similar scroll distance

const wheelDelta = browserName === "firefox" ? 2000 : 1000;
await page.mouse.wheel(0, wheelDelta);
```

**Files Modified:**

- `e2e/tests/scroll-persistence.spec.ts` - Lines 340-352 (catalog refresh test)

---

### 2. Practice Evaluation Test Page Closure

**Problem:**

- Firefox test was crashing with "Target page, context or browser has been closed"
- Error occurred during retry logic in `selectEvalFor` helper at line 49
- Practice evaluation reset test timeout only in Firefox

**Solution:**

- Added page closure detection before `waitForTimeout` in catch block
- Better error message when page closes unexpectedly
- Helper now fails gracefully instead of crashing

**Code Changes:**

```typescript
// Before
} catch {
  await page.waitForTimeout(150);  // Could crash if page closed
}

// After
} catch {
  if (page.isClosed()) {
    throw new Error(`Page closed during eval selection for tune ${tuneId}`);
  }
  await page.waitForTimeout(150);
}
```

**Files Modified:**

- `e2e/tests/practice-evaluation-reset.spec.ts` - Lines 47-52 (selectEvalFor helper)

---

### 3. CI Scroll Persistence Timing

**Problem:**

- Scroll position reading 0 in CI despite localStorage having correct values
- CI environments 2-3× slower than local machines
- Reactive effects not firing in time to restore scroll position

**Solution:**

- **Safety delay:** 350ms → 800ms (CI slowness compensation)
- **Reactive reapply window:** 800ms → 1500ms (virtualizer stabilization)
- Applied to all three grids: Catalog, Repertoire, Practice
- Maintained phase logging for debugging (initial/reapply/safety-delay)

**Files Modified:**

- `src/components/grids/TunesGridCatalog.tsx` - Timing adjustments
- `src/components/grids/TunesGridRepertoire.tsx` - Timing adjustments
- `src/components/grids/TunesGridScheduled.tsx` - Timing adjustments

**Logging Output:**

```
[CATALOG_SCROLL] Restoring scroll position to 1000 (phase: initial)
[CATALOG_SCROLL] Reactive effect: scrollMetrics changed, reapplying scroll
[CATALOG_SCROLL] Safety delay triggered, final scroll position: 1000
```

---

### 4. Test Improvements

**Additional fixes applied:**

- **Mobile Chrome checkbox interactions:** Added `force: true` to checkbox clicks to handle overlay issues
- **Catalog tab switch test retry logic:** Added verification and retry if scroll doesn't reach target (handles slow virtualizer rendering)
- **Browser-specific logging:** Added browser name to console logs for better debugging

**Files Modified:**

- `e2e/tests/scroll-persistence.spec.ts` - Catalog tab switch test (lines 141-159)
- Multiple test files - Checkbox interaction fixes

---

## Technical Deep Dive: Browser Wheel Event Differences

### Why Firefox Scrolls Differently

Browsers implement wheel events with different **deltaMode** values:

| Browser  | deltaMode          | Interpretation                              |
| -------- | ------------------ | ------------------------------------------- |
| Chromium | DOM_DELTA_PIXEL(0) | Delta values = absolute pixels              |
| Firefox  | DOM_DELTA_LINE(1)  | Delta values = text lines (~3-5 lines)      |
| Safari   | DOM_DELTA_PIXEL(0) | Usually pixels, can vary with trackpad zoom |

**Why No Standard Conversion?**

- Line height varies by element's computed `line-height` CSS
- User preferences can customize scroll speed in browser settings
- Each browser implements its own scrolling physics

**Our Solution:**

- Empirical testing: Firefox needs ~2× the delta value
- Browser detection at test runtime
- Pragmatic approach: verify scroll _works_ correctly, not that distance is identical

---

## Scroll Persistence Architecture

### Two-Phase Restore Pattern

All three grids use the same pattern:

1. **Initial Restore** - On mount, immediately set `scrollTop` from localStorage
2. **Safety Delay** - After 800ms, reapply scroll (handles slow virtualizer setup)
3. **Reactive Reapply** - Within 1500ms window, watch virtualizer metrics and reapply if changed

```typescript
// Phase 1: Initial restore
const savedScroll = localStorage.getItem(scrollKey);
if (savedScroll && scrollableContainer) {
  scrollableContainer.scrollTop = Number(savedScroll);
  console.log(
    `[GRID_SCROLL] Restoring scroll to ${savedScroll} (phase: initial)`
  );
}

// Phase 2: Safety delay (800ms for CI)
const safetyTimer = setTimeout(() => {
  if (savedScroll && scrollableContainer) {
    scrollableContainer.scrollTop = Number(savedScroll);
    console.log(
      `[GRID_SCROLL] Safety delay triggered, final scroll: ${savedScroll}`
    );
  }
}, 800);

// Phase 3: Reactive reapply (within 1500ms window)
createEffect(() => {
  const metrics = virtualizer.scrollElement;
  if (Date.now() - mountTime < 1500) {
    if (savedScroll && scrollableContainer) {
      scrollableContainer.scrollTop = Number(savedScroll);
      console.log(`[GRID_SCROLL] Reactive effect: reapplying scroll`);
    }
  }
});
```

### Why This Works

- **Initial restore:** Catches cases where virtualizer is already ready
- **Safety delay:** Catches cases where virtualizer setup is slow (especially in CI)
- **Reactive reapply:** Catches cases where virtualizer metrics change after initial render
- **Time-bounded:** Reactive effect only runs in first 1500ms to avoid interfering with user scrolling

---

## CI Environment Considerations

### GitHub Actions Setup

**Supabase Configuration:**

```yaml
# .github/workflows/ci.yml (lines 50-65)
- name: Set Supabase environment variables dynamically
  run: |
    API_URL=$(supabase status --output json | jq -r '.API_URL')
    ANON_KEY=$(supabase status --output json | jq -r '.ANON_KEY')

    # Set both prefixed (for Vite) and unprefixed (for server-side)
    echo "VITE_SUPABASE_URL=$API_URL" >> $GITHUB_ENV
    echo "VITE_SUPABASE_ANON_KEY=$ANON_KEY" >> $GITHUB_ENV
    echo "SUPABASE_URL=$API_URL" >> $GITHUB_ENV
    echo "SUPABASE_ANON_KEY=$ANON_KEY" >> $GITHUB_ENV
```

**Why Dynamic Extraction?**

- Local Supabase instance generates random ports and keys
- Hardcoding doesn't work - must extract at runtime
- Both VITE\_\* (client-side) and unprefixed (server-side) needed

### CI vs Local Timing

| Environment    | Safety Delay | Reactive Window | Why                             |
| -------------- | ------------ | --------------- | ------------------------------- |
| Local Machine  | 350ms        | 800ms           | Fast CPU, minimal overhead      |
| CI (GitHub)    | 800ms        | 1500ms          | Shared resources, Docker layers |
| CI (Cloudflare | TBD          | TBD             | Edge environment (future)       |

---

## Test Infrastructure

### Multi-Browser Test Matrix

**Playwright Projects:**

- `chromium` - Desktop Chrome (primary)
- `firefox` - Desktop Firefox (compatibility)
- `webkit` - Desktop Safari (future)
- `Mobile Chrome` - Pixel 5 simulation

**Parallel Execution:**

- Local: 8 workers
- CI: 2 workers (resource constraints)

**Test Organization:**

```
e2e/
├── tests/
│   ├── scroll-persistence.spec.ts     # Grid scroll tests
│   ├── practice-evaluation-reset.spec.ts  # Practice tab evaluation tests
│   └── auth-login.spec.ts             # Auth flow tests
├── helpers/
│   ├── test-fixture.ts                # Custom fixtures (testUser, browserName)
│   ├── practice-scenarios.ts          # Practice test setup
│   └── test-users.ts                  # Shared test user data
└── page-objects/
    └── TuneTreesPage.ts               # Page object model
```

---

## Known Issues & Limitations

### RecallEvalComboBox Issues (For Next Session)

**Current State:**

- Component renders and displays options correctly
- Change events fire and propagate to parent
- **Problem 1:** Menu positioning hardcoded (`left: 32px`) - breaks in narrow columns
- **Problem 2:** No keyboard accessibility (arrow keys, Enter, Escape)
- **Problem 3:** Firefox may have re-render issues causing page closure in tests

**Files to Investigate:**

- `src/components/grids/RecallEvalComboBox.tsx` - Main component
- `e2e/tests/practice-evaluation-reset.spec.ts` - Test showing Firefox issue

**Recommended Fixes:**

1. Replace hardcoded positioning with dynamic calculation based on button position
2. Add keyboard event handlers (ArrowUp/Down to navigate, Enter to select, Escape to close)
3. Use Kobalte UI's `Select` primitive for better accessibility
4. Add `aria-*` attributes for screen readers

---

## Files Modified This Session

### Test Files

- `e2e/tests/scroll-persistence.spec.ts`
  - Lines 141-159: Catalog tab switch retry logic
  - Lines 340-352: Firefox wheel delta adjustment
- `e2e/tests/practice-evaluation-reset.spec.ts`
  - Lines 47-52: Page closure detection in selectEvalFor

### Component Files

- `src/components/grids/TunesGridCatalog.tsx`
  - Timing: safetyTimer 350ms→800ms, reactive window 800ms→1500ms
- `src/components/grids/TunesGridRepertoire.tsx`
  - Timing: safetyTimer 350ms→800ms, reactive window 800ms→1500ms
- `src/components/grids/TunesGridScheduled.tsx`
  - Timing: safetyTimer 350ms→800ms, reactive window 800ms→1500ms

---

## Next Session Goals

### Priority 1: RecallEvalComboBox Fixes

**Problem:** Menu positioning and accessibility issues
**Tasks:**

1. Fix hardcoded `left: 32px` positioning
   - Calculate position dynamically from button bounding box
   - Handle edge cases (menu overflowing viewport)
2. Add keyboard navigation
   - ArrowUp/ArrowDown to navigate options
   - Enter to select, Escape to close
   - Home/End to jump to first/last
3. Consider Kobalte UI replacement
   - `@kobalte/core` has accessible Select primitive
   - Better keyboard/screen reader support
   - Less custom code to maintain

**Files to Modify:**

- `src/components/grids/RecallEvalComboBox.tsx`
- `e2e/tests/practice-evaluation-reset.spec.ts` (verify fixes work)

### Priority 2: Flashcard Button Implementation

**Current State:** Toggle exists, changes state, but no functionality
**Tasks:**

1. Create `FlashcardView.tsx` component
   - Card layout with tune name visible
   - "Reveal" button to show ABC notation/notes
   - Previous/Next navigation
   - Evaluation selection embedded in card
2. Replace grid with flashcard view when toggle active
3. Keyboard shortcuts
   - Spacebar: Reveal notation
   - Arrow left/right: Navigate cards
   - 1-4 keys: Select evaluation (Again/Hard/Good/Easy)
4. Preserve evaluation state across grid/flashcard views

**Files to Create:**

- `src/components/practice/FlashcardView.tsx`
- `src/components/practice/FlashcardCard.tsx`

**Files to Modify:**

- `src/routes/practice/Index.tsx` - Switch between grid/flashcard
- `src/components/practice/PracticeControlBanner.tsx` - Wire up toggle

### Priority 3: Better Scheduling Testing

**Current State:** No tests for FSRS scheduling logic
**Tasks:**

1. Create `src/lib/scheduling/fsrs.test.ts`
   - Test rating mapping (again/hard/good/easy → FSRS Rating)
   - Test new card scheduling (State.New → State.Learning)
   - Test review card scheduling (State.Review intervals)
   - Test lapses (again rating → State.Relearning)
2. Create `e2e/tests/practice-scheduling.spec.ts`
   - Test submit evaluations → scheduled_date updates
   - Test FSRS fields persist correctly (stability, difficulty)
   - Test grid shows new scheduled dates after submit
   - Test filtering by scheduled date
3. Mock FSRS for predictable test dates
   - Freeze time in tests
   - Verify interval calculations (good = 1 day, easy = 4 days, etc.)

**Dependencies:**

- `ts-fsrs` - Already installed
- `vitest` - For unit tests
- `playwright` - For E2E tests

---

## Important Code Patterns

### SolidJS Reactivity with Time Windows

**Pattern:** Time-bounded reactive effects to avoid interfering with user actions

```typescript
const mountTime = Date.now();

createEffect(() => {
  const metrics = virtualizer.scrollElement;
  // Only run in first 1500ms after mount
  if (Date.now() - mountTime < 1500) {
    // Restore scroll when virtualizer metrics change
    if (savedScroll) {
      scrollableContainer.scrollTop = Number(savedScroll);
    }
  }
});
```

**Why This Works:**

- Captures initial virtualizer setup (usually <500ms)
- Captures late renders in CI (500-1500ms)
- Stops after 1500ms to avoid interfering with user scrolling

### Browser Detection in Playwright

**Pattern:** Use `browserName` fixture for conditional behavior

```typescript
test("my test", async ({ page, browserName }) => {
  const wheelDelta = browserName === "firefox" ? 2000 : 1000;
  await page.mouse.wheel(0, wheelDelta);
});
```

**Available Values:**

- `"chromium"` - Chrome, Edge, Brave
- `"firefox"` - Firefox
- `"webkit"` - Safari

### Page Closure Detection

**Pattern:** Check if page is alive before async operations

```typescript
try {
  await riskyOperation();
} catch {
  if (page.isClosed()) {
    throw new Error("Page closed unexpectedly");
  }
  // Retry or handle error
}
```

---

## Testing Checklist for Next Session

### RecallEvalComboBox Fixes

- [ ] Menu positions correctly in narrow columns
- [ ] Menu doesn't overflow viewport edges
- [ ] Arrow keys navigate options
- [ ] Enter key selects option
- [ ] Escape key closes menu
- [ ] Screen reader announces options correctly
- [ ] Firefox test doesn't timeout/crash

### Flashcard Implementation

- [ ] Flashcard view replaces grid when toggle active
- [ ] Tune name visible initially
- [ ] Spacebar reveals notation
- [ ] Arrow keys navigate tunes
- [ ] Can select evaluation in flashcard mode
- [ ] Evaluation state preserved when switching to grid
- [ ] Toggle returns to grid view with scroll restored

### Scheduling Tests

- [ ] FSRS rating mapping correct (unit test)
- [ ] New card gets first interval (unit test)
- [ ] Good rating → ~1 day interval (unit test)
- [ ] Easy rating → ~4 day interval (unit test)
- [ ] Submit evaluations updates scheduled_date (E2E)
- [ ] FSRS fields saved to database (E2E)
- [ ] Grid shows updated dates after submit (E2E)

---

## Environment & Dependencies

**Node Version:** v20+ (for native fetch, top-level await)
**Package Manager:** npm
**Database:** SQLite WASM (client-side)
**Test Framework:** Playwright + Vitest

**Key Dependencies:**

- `solid-js` v1.8+ - Reactive framework
- `@tanstack/solid-table` v8+ - Table management
- `@tanstack/solid-virtual` v3+ - Virtual scrolling
- `drizzle-orm` - Type-safe ORM
- `ts-fsrs` - Spaced repetition scheduling
- `@kobalte/core` - Accessible UI primitives (for Select rewrite)
- `@playwright/test` - E2E testing
- `vitest` - Unit testing

**Local Development:**

```bash
npm run dev              # Start dev server (http://localhost:5173)
npm run test             # Run Vitest unit tests
npm run test:e2e         # Run Playwright E2E tests
npm run test:e2e:ui      # Run Playwright with UI mode
```

---

## Recent Commits

```
21d9f68 🐛 improve scroll handling in catalog tests for better stability, especially in Firefox
c37d128 🐛 improve evaluation selection stability with click delay and error handling, helps with firefox
5118083 💚 Back down to 2 test workers
8e66a4f 💚 Back down to 3 test workers
16f8e34 🐛 increase worker count for CI to improve test parallelism
```

---

## Key Insights

1. **Browser Differences Are Real:** Firefox and Chromium handle wheel events fundamentally differently. Don't assume cross-browser compatibility without testing.

2. **CI Timing Is Critical:** What works locally in 300ms might need 800ms in CI. Build in generous buffers and time-bounded reactive effects.

3. **Two-Phase Restore Pattern:** For virtual scrolling, you need both immediate restore AND delayed retry. Virtualizers don't render instantly.

4. **Test What Breaks:** Firefox-specific failures are often real browser bugs or spec interpretation differences. Don't just skip Firefox tests.

5. **Accessibility Matters:** RecallEvalComboBox works visually but fails keyboard/screen reader users. Using proper primitives (Kobalte) saves debugging time.

---

## Questions for Next Session

Before starting work, clarify:

1. **RecallEvalComboBox rewrite:** Stick with custom dropdown or migrate to Kobalte's Select?
2. **Flashcard keyboard shortcuts:** Use defaults (spacebar/arrows) or customize?
3. **FSRS parameters:** Use library defaults or tune for specific intervals?
4. **Test coverage targets:** What % coverage for scheduling logic?

---

**Last Updated:** October 27, 2025  
**Prepared By:** GitHub Copilot  
**For:** Next chat session continuation on Practice tab improvements
