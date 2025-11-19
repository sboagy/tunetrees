# Comprehensive Scheduling Test Plan

**Issue:** #286 - Scheduling not working properly  
**Author:** GitHub Copilot  
**Date:** 2025-11-19  
**Status:** Draft - Awaiting @sboagy approval

## Problem Statement

In production deployment, the FSRS-based scheduling system exhibits critical failures:
- Evaluations can schedule tunes in the **past** instead of future dates
- Repeated "Easy" evaluations fail to advance scheduling dates appropriately
- Practice queue may show tunes that should not be due today

## Background: TuneTrees Scheduling Architecture

### FSRS Algorithm (ts-fsrs)
TuneTrees uses the FSRS (Free Spaced Repetition Scheduler) algorithm via the `ts-fsrs` npm package:
- **Ratings**: Again (1), Hard (2), Good (3), Easy (4)
- **Metrics**: Stability, Difficulty, Interval (days until next review)
- **States**: New (0), Learning (1), Review (2), Relearning (3)

### Practice Flow (see docs/practice_flow.md)
1. **Queue Generation**: Daily snapshot of tunes to practice (buckets: Due Today, Lapsed, New, Old Lapsed)
2. **Staging**: FSRS preview calculations when user selects evaluation
3. **Commit**: Create practice_record, update playlist_tune.scheduled, mark queue complete
4. **Sync**: Upload to Supabase PostgreSQL
5. **UI Refresh**: Re-query practice list

### Critical Date Fields
- `practice_record.practiced`: When user submitted evaluation (immutable)
- `practice_record.due`: Next review date calculated by FSRS
- `playlist_tune.scheduled`: Current "next review" date (updated on commit)
- `daily_practice_queue.window_start_utc`: Practice session date (frozen snapshot)

## Test Plan Overview

### Scope
Test comprehensive multi-day practice scenarios with 30 tunes to validate:
1. FSRS algorithm correctness (dates always advance forward)
2. Queue regeneration across day boundaries
3. Evaluation impact on scheduling (Again/Hard/Good/Easy)
4. Edge cases (new tunes, lapsed tunes, timezone handling)

### Test Duration
Simulated 10-day practice cycle with controlled time advancement

### Test Data
- **30 tunes** from test catalog (mix of public tunes)
- **Single test user** per test run (parallel-safe using test fixture)
- **Clean slate**: All practice history cleared before each test

## Test Scenarios

### Test 1: Basic FSRS Progression (Single Tune, 7 Days)
**Purpose**: Validate FSRS algorithm produces sensible intervals for one tune

**Setup**:
- Seed 1 tune (TEST_TUNE_BANISH_ID)
- Set stable date: 2025-07-20 14:00:00 UTC
- Clear all practice history

**Execution**:
```
Day 1 (2025-07-20): Evaluate as "Good"
  ✓ Verify scheduled date > 2025-07-20 (future)
  ✓ Verify interval ≥ 1 day
  ✓ Verify state = Learning or Review

Day 2: Advance clock to scheduled date
  ✓ Verify tune appears in practice queue
  Evaluate as "Good"
  ✓ Verify new scheduled date > previous scheduled date

Day 3: Advance clock to scheduled date
  Evaluate as "Easy"
  ✓ Verify interval increases significantly (≥ 2x previous)

Day 4-7: Continue pattern
  ✓ Verify intervals follow FSRS progression (increasing for Good/Easy)
```

**Expected Outcomes**:
- All scheduled dates are in the **future** relative to evaluation timestamp
- Intervals increase geometrically for successful reviews
- State progresses from New → Learning → Review

**Validation Points**:
```typescript
// After each evaluation
expect(nextScheduledDate).toBeAfter(currentDate);
expect(nextScheduledDate).toBeAfter(lastScheduledDate);
expect(intervalDays).toBeGreaterThanOrEqual(1);

// For "Easy" rating
expect(intervalDays).toBeGreaterThan(previousIntervalDays * 1.5);
```

---

### Test 2: Multi-Tune Queue Management (30 Tunes, 3 Days)
**Purpose**: Validate queue generation and prioritization with large repertoire

**Setup**:
- Seed 30 tunes (use TEST_TUNE_* constants)
- Set stable date: 2025-07-20 14:00:00 UTC
- Clear all practice history

**Execution**:
```
Day 1 (2025-07-20):
  ✓ Verify queue contains all 30 tunes (bucket Q3: New)
  Practice 10 tunes (5x "Good", 3x "Easy", 2x "Hard")
  ✓ Verify queue reduces to 20 uncompleted tunes
  ✓ Verify all 10 have scheduled dates in future

Day 2 (2025-07-21):
  ✓ Regenerate queue (should show only newly due tunes)
  ✓ Verify completed tunes from Day 1 do NOT appear (not yet due)
  Practice 10 more tunes
  ✓ Verify scheduled dates > 2025-07-21

Day 3 (2025-07-22):
  ✓ Verify queue size matches expected due tunes
  Practice remaining tunes
  ✓ All 30 tunes have been practiced at least once
  ✓ All scheduled dates are in future
```

**Expected Outcomes**:
- Queue regeneration works correctly across days
- Completed tunes disappear from queue until next due date
- No tunes scheduled in the past

**Validation Points**:
```typescript
// After Day 1 submissions
const practiceRecords = await queryPracticeRecords();
expect(practiceRecords.length).toBe(10);
practiceRecords.forEach(record => {
  expect(record.due).toBeAfter('2025-07-20T14:00:00Z');
});

// After Day 2 queue regeneration
const queueDay2 = await queryPracticeQueue('2025-07-21');
const day1CompletedTunes = [/* IDs from Day 1 */];
day1CompletedTunes.forEach(tuneId => {
  expect(queueDay2.map(q => q.tune_ref)).not.toContain(tuneId);
});
```

---

### Test 3: Repeated "Easy" Evaluations (Single Tune, 10 Days)
**Purpose**: Reproduce reported bug where "Easy" doesn't advance scheduling

**Setup**:
- Seed 1 tune (TEST_TUNE_MORRISON_ID)
- Set stable date: 2025-07-20 14:00:00 UTC
- Clear all practice history

**Execution**:
```
Day 1 (2025-07-20): Evaluate as "Easy"
  Record: interval_1, scheduled_1

Day 2: Advance to scheduled_1
  ✓ Verify tune appears in queue
  Evaluate as "Easy"
  Record: interval_2, scheduled_2
  ✓ Verify interval_2 > interval_1
  ✓ Verify scheduled_2 > scheduled_1

Day 3: Advance to scheduled_2
  Evaluate as "Easy"
  Record: interval_3, scheduled_3
  ✓ Verify interval_3 > interval_2

... Continue for 10 evaluations

Final Check:
  ✓ Verify interval_10 >> interval_1 (exponential growth)
  ✓ Verify scheduled_10 > current_date + 30 days
```

**Expected Outcomes**:
- Each "Easy" evaluation produces longer interval than previous
- Scheduled dates continue advancing into future
- Final scheduled date is weeks/months in future

**Validation Points**:
```typescript
const intervals: number[] = [];
const scheduledDates: Date[] = [];

for (let day = 1; day <= 10; day++) {
  // Evaluate and record
  const record = await submitEvaluation('easy');
  intervals.push(record.interval);
  scheduledDates.push(new Date(record.due));
  
  if (day > 1) {
    expect(intervals[day-1]).toBeGreaterThan(intervals[day-2]);
    expect(scheduledDates[day-1]).toBeAfter(scheduledDates[day-2]);
  }
}

// Exponential growth check
expect(intervals[9]).toBeGreaterThan(intervals[0] * 5);
```

---

### Test 4: Mixed Evaluation Patterns (10 Tunes, 5 Days)
**Purpose**: Test realistic practice patterns with varied evaluations

**Setup**:
- Seed 10 tunes
- Set stable date: 2025-07-20 14:00:00 UTC

**Execution**:
```
Day 1: Practice all 10 tunes
  Tunes 1-3: "Easy"
  Tunes 4-6: "Good"
  Tunes 7-9: "Hard"
  Tune 10: "Again"

Day 2: Advance to earliest due date
  ✓ Verify only "Again" and "Hard" tunes appear in queue
  Practice those tunes with "Good"

Day 3: Continue advancing
  ✓ Verify queue composition matches expected due dates

Day 5: Final validation
  ✓ All tunes have reasonable scheduled dates
  ✓ "Easy" tunes scheduled furthest out
  ✓ "Again" tune has shortest interval
```

**Expected Outcomes**:
- "Easy" produces longest intervals
- "Again" produces shortest intervals
- "Hard" < "Good" < "Easy" (interval progression)

**Validation Points**:
```typescript
// After Day 1
const easyTunes = await queryScheduled([tune1, tune2, tune3]);
const goodTunes = await queryScheduled([tune4, tune5, tune6]);
const hardTunes = await queryScheduled([tune7, tune8, tune9]);
const againTune = await queryScheduled([tune10]);

const avgEasy = average(easyTunes.map(t => t.interval));
const avgGood = average(goodTunes.map(t => t.interval));
const avgHard = average(hardTunes.map(t => t.interval));
const intervalAgain = againTune[0].interval;

expect(avgEasy).toBeGreaterThan(avgGood);
expect(avgGood).toBeGreaterThan(avgHard);
expect(avgHard).toBeGreaterThan(intervalAgain);
```

---

### Test 5: Queue Bucket Distribution (30 Tunes, Varied History)
**Purpose**: Validate queue bucket algorithm (Q1: Due, Q2: Lapsed, Q3: New, Q4: Old Lapsed)

**Setup**:
- Seed 30 tunes with varied scheduling:
  - 10 tunes scheduled "today" (Q1: Due Today)
  - 5 tunes scheduled "yesterday" (Q2: Recently Lapsed)
  - 10 tunes unscheduled (Q3: New)
  - 5 tunes scheduled "10 days ago" (Q4: Old Lapsed - if enabled)

**Execution**:
```
Generate practice queue for today
  ✓ Verify Q1 contains 10 tunes (scheduled today)
  ✓ Verify Q2 contains 5 tunes (lapsed within window)
  ✓ Verify Q3 contains 10 tunes (never scheduled)
  ✓ Verify ordering: Q1 first, then Q2, then Q3

Practice all Q1 and Q2 tunes
  ✓ Verify queue shrinks to only Q3 tunes
```

**Expected Outcomes**:
- Queue prioritizes due tunes first
- Lapsed tunes appear before new tunes
- Bucket ordering is stable

**Validation Points**:
```typescript
const queue = await getPracticeQueue();
const q1 = queue.filter(t => t.bucket === 1);
const q2 = queue.filter(t => t.bucket === 2);
const q3 = queue.filter(t => t.bucket === 3);

expect(q1.length).toBe(10);
expect(q2.length).toBe(5);
expect(q3.length).toBe(10);

// Verify ordering
expect(q1[0].order_index).toBeLessThan(q2[0].order_index);
expect(q2[0].order_index).toBeLessThan(q3[0].order_index);
```

---

### Test 6: Edge Case - Scheduling in Past (Bug Reproduction)
**Purpose**: Reproduce and validate fix for "scheduling in past" bug

**Setup**:
- Seed 1 tune
- Set stable date: 2025-07-20 14:00:00 UTC
- Manually set practiced timestamp to future (simulating clock issues)

**Execution**:
```
Scenario A: Practice timestamp = current time
  Evaluate as "Good"
  ✓ Verify scheduled > practiced timestamp

Scenario B: Practice timestamp = current time
  Evaluate as "Easy" 
  ✓ Verify scheduled > practiced timestamp
  ✓ Verify scheduled > current date

Scenario C: Repeated evaluations within same day
  Evaluate 5 tunes rapidly (< 1 minute apart)
  ✓ Verify all have unique practiced timestamps
  ✓ Verify all scheduled dates > practiced dates
```

**Expected Outcomes**:
- Scheduled dates NEVER in the past relative to practiced
- Timestamp uniqueness prevents database constraint violations

**Validation Points**:
```typescript
const record = await submitEvaluation('good');
const practicedDate = new Date(record.practiced);
const scheduledDate = new Date(record.due);
const currentDate = new Date(); // From stable clock

expect(scheduledDate).toBeAfter(practicedDate);
expect(scheduledDate).toBeAfter(currentDate);
```

---

## Implementation Details

### Clock Control Helpers
```typescript
// e2e/helpers/clock-control.ts

export async function setStableDate(
  context: BrowserContext,
  date: Date | string
): Promise<void> {
  const timestamp = typeof date === 'string' ? new Date(date) : date;
  await context.clock.install({ time: timestamp });
}

export async function advanceDays(
  context: BrowserContext,
  days: number,
  baseDate: Date
): Promise<Date> {
  const newDate = new Date(baseDate);
  newDate.setDate(newDate.getDate() + days);
  await context.clock.install({ time: newDate });
  return newDate;
}

export async function getCurrentDate(page: Page): Promise<Date> {
  return await page.evaluate(() => new Date());
}
```

### Test Data Queries
```typescript
// e2e/helpers/scheduling-queries.ts

export async function queryPracticeRecords(
  page: Page,
  tuneIds: string[]
): Promise<PracticeRecord[]> {
  return await page.evaluate(async (ids) => {
    const api = (window as any).__ttTestApi;
    return await api.getPracticeRecords(ids);
  }, tuneIds);
}

export async function queryScheduledDates(
  page: Page,
  playlistId: string
): Promise<Map<string, string>> {
  return await page.evaluate(async (pid) => {
    const api = (window as any).__ttTestApi;
    return await api.getScheduledDates(pid);
  }, playlistId);
}
```

### Validation Utilities
```typescript
// e2e/helpers/scheduling-assertions.ts

export function expectDateAfter(actual: Date, expected: Date, message?: string) {
  expect(actual.getTime()).toBeGreaterThan(expected.getTime());
}

export function expectIncreasingIntervals(intervals: number[]) {
  for (let i = 1; i < intervals.length; i++) {
    expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i-1]);
  }
}

export function expectExponentialGrowth(
  intervals: number[],
  minGrowthFactor: number = 1.3
) {
  for (let i = 1; i < intervals.length; i++) {
    expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i-1] * minGrowthFactor);
  }
}
```

## Test Infrastructure Requirements

### Browser Context Setup
Each test gets fresh context with clock control:
```typescript
test.beforeEach(async ({ context, page, testUser }) => {
  // Set stable starting date
  await context.clock.install({ 
    time: new Date('2025-07-20T14:00:00.000Z') 
  });
  
  // Setup test data
  await setupForPracticeTestsParallel(page, testUser, {
    repertoireTunes: TUNE_IDS,
    clearRepertoire: true,
    startTab: 'practice',
  });
});
```

### Test Data Constants
```typescript
// tests/fixtures/test-data.ts additions

export const SCHEDULING_TEST_TUNES = [
  TEST_TUNE_BANISH_ID,
  TEST_TUNE_MORRISON_ID,
  TEST_TUNE_MASONS_ID,
  // ... 27 more tunes for 30-tune tests
];

export const STABLE_TEST_DATE = '2025-07-20T14:00:00.000Z';
```

## Success Criteria

### All Tests Must Pass
- [ ] Test 1: Basic FSRS Progression
- [ ] Test 2: Multi-Tune Queue Management
- [ ] Test 3: Repeated "Easy" Evaluations
- [ ] Test 4: Mixed Evaluation Patterns
- [ ] Test 5: Queue Bucket Distribution
- [ ] Test 6: Edge Case - Past Scheduling

### No Scheduling Bugs
- [ ] All scheduled dates are in the future
- [ ] Intervals increase appropriately for Good/Easy
- [ ] Queue regeneration works across day boundaries
- [ ] Practice records have unique timestamps

### Performance Acceptable
- [ ] Queue generation < 2 seconds for 30 tunes
- [ ] FSRS calculation < 100ms per tune
- [ ] UI refresh < 1 second after submission

## Open Questions for @sboagy

1. **Acceptable Interval Ranges**: What are min/max expected intervals for each rating?
   - Again: ? days
   - Hard: ? days
   - Good: ? days
   - Easy: ? days

2. **Bucket 4 (Old Lapsed)**: Is this enabled in production? Should tests cover it?

3. **Timezone Handling**: Should tests validate timezone-aware scheduling?

4. **FSRS Parameters**: Are default FSRS parameters used, or custom ones?

5. **Edge Cases**: Any known production scenarios that need specific test coverage?

6. **Performance Targets**: What are acceptable performance benchmarks for queue generation?

## Timeline

1. **Day 1-2**: Implement clock control helpers and basic test infrastructure
2. **Day 3-4**: Implement Tests 1-3 (basic progression and multi-tune)
3. **Day 5-6**: Implement Tests 4-6 (edge cases and bucket distribution)
4. **Day 7**: Run full suite, identify failures
5. **Day 8-10**: Fix identified issues in consultation with @sboagy
6. **Day 11**: Final validation and documentation

## References

- **FSRS Paper**: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
- **ts-fsrs Library**: https://github.com/open-spaced-repetition/ts-fsrs
- **Practice Flow Docs**: docs/practice_flow.md
- **Playwright Clock API**: https://playwright.dev/docs/clock
