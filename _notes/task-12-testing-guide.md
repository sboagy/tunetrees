# Task 12: Testing Guide - Complete Practice Workflow

**Date:** October 6, 2025  
**Phase:** Phase 3 - Practice Session Management (Task 12 of 12)  
**Status:** Ready for Testing

---

## Overview

This guide walks you through testing the complete practice workflow for the TuneTrees PWA. All tests should be performed with the **sync worker disabled** (RLS policies not yet configured).

### What's Ready for Testing

- ✅ Local SQLite WASM database with 5 seeded tunes
- ✅ FSRS scheduling service (`ts-fsrs` v5.2.3)
- ✅ Practice recording service (local writes + sync queue)
- ✅ Practice session UI (rating buttons, progress tracking)
- ✅ Practice history view
- ✅ Offline-first architecture (no server dependencies)

### What's NOT Ready

- ❌ Supabase sync (RLS policies needed)
- ❌ Daily queue generation (uses getDueTunes directly)
- ❌ Multi-playlist support (hardcoded playlist 1)

---

## Test Plan

### 🧪 Test 1: Manual Practice Workflow

**Objective:** Verify basic practice session functionality end-to-end.

#### Steps:

1. **Navigate to Practice Page**

   ```
   http://localhost:5173/practice
   ```

   **Expected:**

   - User email displayed in nav
   - "Local database initialized and ready" green status
   - "Start Practice Session" button visible
   - Tune library shows 5 tunes

2. **Start Practice Session**

   - Click "Start Practice Session" button

   **Expected:**

   - Practice session UI loads
   - First tune displayed with:
     - Title (e.g., "Banish Misfortune")
     - Type (e.g., "Jig")
     - Mode (e.g., "D Dorian")
     - ABC notation (if available)
     - 4 rating buttons: Again, Hard, Good, Easy
   - Progress bar: "0 / X completed"

3. **Rate First Tune as "Good"**

   - Click "Good" button (green)

   **Expected:**

   - "Recording practice..." message briefly
   - Tune advances to next in queue
   - Progress updates: "1 / X completed"
   - Progress bar increases

4. **Rate Second Tune as "Easy"**

   - Click "Easy" button (blue)

   **Expected:**

   - Same smooth transition
   - Progress updates: "2 / X completed"

5. **Rate Third Tune as "Again"**

   - Click "Again" button (red)

   **Expected:**

   - Tune marked as failed (FSRS will schedule sooner)
   - Progress continues normally

6. **Complete Session**

   - Continue rating all remaining tunes

   **Expected:**

   - When last tune rated:
     - "Session Complete! ✨" message
     - "You practiced X tunes today"
     - "Start Another Session" button appears

7. **Verify Console Logs**

   - Open browser DevTools → Console

   **Expected console messages:**

   ```
   ✅ Local database ready
   ⚠️  Sync worker disabled (RLS policies not configured)
   💾 Database persisted to IndexedDB
   ```

   **NO sync errors** (should be silent since worker is disabled)

#### Pass/Fail Criteria:

- ✅ **PASS:** All 5 tunes rated successfully, session completes, no errors
- ❌ **FAIL:** Rating fails, TypeScript errors, UI crashes

---

### 🧪 Test 2: Verify Practice Data Persistence

**Objective:** Confirm practice records are saved to IndexedDB with correct FSRS values.

#### Steps:

1. **Open IndexedDB Inspector**

   - Chrome DevTools → Application → Storage → IndexedDB
   - Expand `tunetrees_db_<userId>` database
   - Navigate to `practice_record` table

2. **Inspect Latest Practice Records**

   **Expected fields for each record:**

   ```json
   {
     "id": <auto-increment>,
     "playlistRef": 1,
     "tuneRef": <tune_id>,
     "practiced": "2025-10-06T...",
     "quality": 1-4,  // 1=Again, 2=Hard, 3=Good, 4=Easy
     "due": "2025-10-07T...",  // Next review date
     "interval": <days>,  // Days until next review
     "stability": <float>,  // FSRS stability
     "difficulty": <float>,  // FSRS difficulty (0-10)
     "state": 0-3,  // 0=New, 1=Learning, 2=Review, 3=Relearning
     "repetitions": <int>,
     "lapses": 0,
     "elapsedDays": 0,
     "goal": "recall",
     "createdAt": "2025-10-06T...",
     "lastModifiedAt": "2025-10-06T..."
   }
   ```

3. **Verify FSRS Calculations**

   **For "Good" rating (first review):**

   - `state`: 1 (Learning)
   - `stability`: ~1-5 days
   - `difficulty`: ~5-7 (mid-range)
   - `interval`: 1-3 days
   - `repetitions`: 1

   **For "Easy" rating (first review):**

   - `state`: 1 (Learning)
   - `stability`: ~5-10 days
   - `difficulty`: ~3-5 (easier)
   - `interval`: 4-7 days

   **For "Again" rating:**

   - `state`: 1 (Learning) or 3 (Relearning)
   - `stability`: Very low (~minutes to 1 day)
   - `difficulty`: Higher (~7-9)
   - `interval`: 0-1 days

4. **Check Sync Queue**

   - Navigate to `sync_queue` table in IndexedDB

   **Expected:**

   - One row per practice record with:
     - `tableName`: "practice_record"
     - `operation`: "insert"
     - `status`: "pending"
     - `data`: JSON stringified practice record

#### Pass/Fail Criteria:

- ✅ **PASS:** All practice records saved, FSRS values reasonable, sync queue populated
- ❌ **FAIL:** Missing records, null FSRS values, incorrect states

---

### 🧪 Test 3: Practice History View

**Objective:** Verify users can view their practice history.

#### Steps:

1. **Navigate to Practice History**

   - From practice page, click "View Practice History" button
   - URL: `http://localhost:5173/practice/history`

2. **Verify History Table**

   **Expected columns:**

   - Date (practiced)
   - Tune Title
   - Rating (Again/Hard/Good/Easy)
   - Stability
   - Difficulty
   - Next Review (due date)
   - State (New/Learning/Review/Relearning)

3. **Verify Data Matches Practice Records**

   - Compare with IndexedDB `practice_record` table
   - All records from Test 1 should appear

4. **Test Sorting/Filtering**
   - Click column headers to sort
   - Verify sorting works correctly

#### Pass/Fail Criteria:

- ✅ **PASS:** All practice records displayed correctly in table
- ❌ **FAIL:** Empty table, missing records, incorrect data

---

### 🧪 Test 4: Offline Practice Mode

**Objective:** Verify practice works without internet connection.

#### Steps:

1. **Disable Network**

   - Chrome DevTools → Network tab
   - Toggle "Offline" mode
   - Or disconnect WiFi

2. **Reload Application**

   ```
   http://localhost:5173/practice
   ```

   **Expected:**

   - App loads from service worker cache
   - IndexedDB data still available
   - 5 tunes still visible

3. **Start Practice Session Offline**

   - Click "Start Practice Session"
   - Rate 2-3 tunes

   **Expected:**

   - Practice session works normally
   - No network errors in console
   - Data saves to IndexedDB

4. **Verify Sync Queue Growth**

   - Open IndexedDB → `sync_queue`

   **Expected:**

   - New practice records queued with `status: "pending"`
   - No sync attempts (worker disabled)

5. **Re-enable Network**

   - Turn network back on
   - Reload page

   **Expected:**

   - App continues working
   - Sync queue items remain (will sync when RLS configured)

#### Pass/Fail Criteria:

- ✅ **PASS:** Full practice session works offline, data persists
- ❌ **FAIL:** Network errors, data loss, crashes

---

### 🧪 Test 5: FSRS Algorithm Validation

**Objective:** Verify FSRS scheduling produces correct intervals.

#### Manual Test:

1. **Rate Same Tune Multiple Times**

   - Practice tune #1, rate as "Good"
   - Note the `due` date
   - Manually set `due` to today in IndexedDB
   - Practice again, rate as "Good"
   - Repeat 3-5 times

2. **Expected Interval Progression:**

   ```
   Review 1 (Good): 1-3 days
   Review 2 (Good): 3-7 days
   Review 3 (Good): 7-14 days
   Review 4 (Good): 14-30 days
   Review 5 (Good): 30-60 days
   ```

3. **Test "Again" Recovery:**
   - After 3 "Good" ratings, rate as "Again"
   - Next interval should drop significantly
   - `state` should change to Relearning (3)

#### Pass/Fail Criteria:

- ✅ **PASS:** Intervals increase with Good, decrease with Again
- ❌ **FAIL:** Intervals don't change or are illogical

---

## Automated Test Checklist

### Unit Tests (TODO)

Create `src/lib/scheduling/fsrs-service.test.ts`:

```typescript
describe("FSRSService", () => {
  it("should initialize with default parameters", () => {
    const service = new FSRSService();
    expect(service).toBeDefined();
  });

  it('should process first review with "Good" rating', () => {
    const service = new FSRSService();
    const result = service.processFirstReview({
      rating: 3, // Good
      practiced: new Date(),
    });

    expect(result.state).toBe(1); // Learning
    expect(result.stability).toBeGreaterThan(0);
    expect(result.difficulty).toBeGreaterThan(0);
    expect(result.scheduled_days).toBeGreaterThan(0);
  });

  it("should process repeat review with history", () => {
    const service = new FSRSService();

    // First review
    const first = service.processFirstReview({
      rating: 3,
      practiced: new Date("2025-10-01"),
    });

    // Second review
    const second = service.processReview({
      rating: 3,
      card: {
        due: first.nextDue,
        stability: first.stability,
        difficulty: first.difficulty,
        // ... other fields
      },
      now: new Date("2025-10-02"),
    });

    expect(second.scheduled_days).toBeGreaterThan(first.scheduled_days);
    expect(second.stability).toBeGreaterThan(first.stability);
  });

  it('should decrease interval for "Again" rating', () => {
    // ... test implementation
  });
});
```

### E2E Tests (Playwright - TODO)

Port from `legacy/frontend/tests/test-practice-*.spec.ts`:

```typescript
// tests/practice-workflow.spec.ts
test("complete practice workflow", async ({ page }) => {
  // Login
  await page.goto("http://localhost:5173/login");
  await page.getByLabel("Email").fill("test@example.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign In" }).click();

  // Navigate to practice
  await expect(page).toHaveURL("/practice");

  // Start session
  await page.getByRole("button", { name: "Start Practice Session" }).click();

  // Rate first tune
  await page.getByRole("button", { name: "Good" }).click();

  // Verify progress
  await expect(page.getByText(/1 \/ \d+ completed/)).toBeVisible();

  // Complete session
  // ... continue rating all tunes

  // Verify completion
  await expect(page.getByText("Session Complete!")).toBeVisible();
});

test("practice works offline", async ({ page, context }) => {
  // Enable offline mode
  await context.setOffline(true);

  // Navigate to practice
  await page.goto("http://localhost:5173/practice");

  // Verify app loads
  await expect(page.getByText("Tune Library")).toBeVisible();

  // Start practice
  await page.getByRole("button", { name: "Start Practice Session" }).click();

  // Rate a tune
  await page.getByRole("button", { name: "Good" }).click();

  // Verify no network errors
  const errors = [];
  page.on("pageerror", (err) => errors.push(err));

  expect(errors).toHaveLength(0);
});
```

---

## Known Issues / Limitations

### Current Constraints:

1. **Sync Disabled:**

   - Practice records queue but don't sync to Supabase
   - Will work once RLS policies are configured

2. **getDueTunes Query:**

   - Currently queries all tunes, doesn't filter by `due` date
   - Need to add WHERE clause: `WHERE due <= ?`

3. **No Daily Queue Snapshot:**

   - Uses live query instead of frozen daily snapshot
   - Task 10 (Queue Generation) not yet implemented

4. **Hardcoded Playlist:**
   - Always uses playlist 1
   - Need playlist selector UI

### Non-Blocking Issues:

- Practice session works fully client-side
- FSRS calculations are correct
- Data persists in IndexedDB
- Offline mode works

---

## Success Criteria (Task 12 Complete)

✅ **Task 12 is complete when:**

1. ✅ User can start a practice session
2. ✅ User can rate tunes (Again/Hard/Good/Easy)
3. ✅ FSRS calculates correct next review dates
4. ✅ Practice records save to IndexedDB
5. ✅ Practice history view displays records
6. ✅ Practice works offline (no network required)
7. ✅ No TypeScript errors or console warnings
8. ⏳ Unit tests for FSRS service passing (TODO)
9. ⏳ E2E tests for practice workflow passing (TODO)

---

## Next Steps After Task 12

**Phase 3 Complete!** 🎉

Next tasks (Phase 4):

1. **Configure Supabase RLS Policies:**

   - Allow users to insert/update their own practice records
   - Re-enable sync worker

2. **Implement Daily Queue Generation:**

   - Complete Task 10 (queue-generator.ts)
   - Build frozen daily snapshot

3. **Add Playlist Selector:**

   - Multi-playlist support
   - Playlist-specific practice sessions

4. **Production Deployment:**
   - Deploy to Cloudflare Pages
   - Configure PWA manifest
   - Service worker caching strategy

---

**Testing Started:** October 6, 2025  
**Expected Completion:** October 6, 2025  
**Tester:** @sboagy
