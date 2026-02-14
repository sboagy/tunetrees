# E2E Test Helpers

## Practice Queue Test Scenarios

The `practice-scenarios.ts` file provides helper functions to set up specific database states for testing practice queue functionality.

### Why We Need This

The practice queue algorithm has complex behavior based on:

- Whether tunes are scheduled (`repertoire_tune.current` field)
- How long ago they were scheduled (bucket classification)
- Whether the practice queue has been generated for today

Each test needs a **specific, repeatable input state** to verify expected behavior. These helpers ensure tests are deterministic and don't have conditionals.

### Available Scenarios

#### `setupFreshAccountScenario()`

**State:** Tunes exist in repertoire but not scheduled for practice

- `repertoire_tune.current = NULL` for all tunes
- Practice queue deleted
- **Expected behavior:** Empty practice queue (Q1=0, Q2=0, Q3=0)
- **Use case:** Testing empty state UI, "Add to Review" workflow

#### `setupLapsedTunesScenario()`

**State:** Tunes scheduled 7 days ago (overdue for practice)

- `repertoire_tune.current = 7 days ago` for all tunes
- Practice queue deleted (will be regenerated)
- **Expected behavior:** Tunes appear in Q2 (recently lapsed) bucket
- **Use case:** Testing lapsed tune handling, queue generation

#### `setupDueTodayScenario()`

**State:** Tunes scheduled for today

- `repertoire_tune.current = today` for all tunes
- Practice queue deleted
- **Expected behavior:** Tunes appear in Q1 (due today) bucket
- **Use case:** Testing current day practice workflow

#### `setupMixedScenario()`

**State:** One tune due today, one lapsed

- Tune 9001: `current = today` (Q1)
- Tune 9002: `current = 7 days ago` (Q2)
- **Expected behavior:** Mixed bucket queue
- **Use case:** Testing bucket priority and ordering

### Usage in Tests

```typescript
import { setupFreshAccountScenario } from "../helpers/practice-scenarios";

test.describe("PRACTICE-001: Empty State", () => {
  test.beforeEach(async ({ page }) => {
    // Setup specific scenario BEFORE navigating to app
    await setupFreshAccountScenario();

    await page.goto("http://localhost:5173");
    await page.waitForTimeout(2000); // Wait for sync

    await page.getByTestId("tab-practice").click();
  });

  test("should show empty state", async ({ page }) => {
    // Test knows EXACTLY what to expect: empty queue
    await expect(page.getByText(/No tunes scheduled/i)).toBeVisible();
  });
});
```

### Creating New Scenarios

To add a new test scenario:

1. **Define the scenario function:**

```typescript
export async function setupMyNewScenario() {
  await resetScheduledDates();
  await deleteActivePracticeQueue();
  // Set up specific state...
  await scheduleTunesForPractice(14, [9001]); // Very overdue tune
  console.log("📋 Scenario: My New Scenario");
}
```

2. **Add to exports:**

```typescript
export const PRACTICE_SCENARIOS = {
  // ... existing scenarios
  myNewScenario: setupMyNewScenario,
} as const;
```

3. **Use in tests:**

```typescript
import { setupMyNewScenario } from "../helpers/practice-scenarios";

test.beforeEach(async ({ page }) => {
  await setupMyNewScenario();
  // ...
});
```

### Helper Functions

#### `scheduleTunesForPractice(daysAgo, tuneRefs)`

Schedule specific tunes for practice

- `daysAgo`: How many days in the past (0 = today)
- `tuneRefs`: Array of tune IDs (defaults to [9001, 9002])

#### `resetScheduledDates()`

Set all Alice's tunes to `current = NULL` (unscheduled)

#### `deleteActivePracticeQueue()`

Remove Alice's active practice queue (forces regeneration)

### Test Data Reference

**Alice's Test Data:**

- User ID: `11111111-1111-1111-1111-111111111111`
- Repertoire ID: `9001`
- Tunes:
  - `9001`: "Banish Misfortune" (JigD, D Mixolydian)
  - `9002`: "Morrison's Jig" (JigD, E Dorian)

**Default Queue Parameters:**

- `maxReviewsPerDay`: 10 tunes
- `acceptableDelinquencyWindow`: 7 days
- Bucket 3 (backfill): **Disabled** in current implementation

### Debugging Tips

**Check scenario was applied:**

```bash
# Verify scheduled dates
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -c "SELECT tune_ref, current FROM repertoire_tune WHERE repertoire_ref = 9001;"

# Check queue state
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -c "SELECT * FROM daily_practice_queue WHERE user_ref = 9001;"
```

**Console logs:**
Each scenario helper logs its action:

```
📋 Scenario: Fresh Account (unscheduled tunes)
✅ Reset scheduled dates to NULL
✅ Deleted active practice queue
```
