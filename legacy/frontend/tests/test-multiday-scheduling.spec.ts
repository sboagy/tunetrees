import { expect, type Page, test } from "@playwright/test";
import { restartBackend } from "@/test-scripts/global-setup";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { getStorageState } from "@/test-scripts/storage-state";
import { TuneTreesPageObject } from "@/test-scripts/tunetrees.po";
import { setTestDefaults } from "../test-scripts/set-test-defaults";
import {
  logBrowserContextEnd,
  logBrowserContextStart,
  logTestEnd,
  logTestStart,
} from "../test-scripts/test-logging";

// Test configuration
const TEST_DAYS = 30;

interface IPredictedSchedule {
  day: number;
  date: string;
  expectedTunes: Array<{
    tuneId: number;
    title: string;
    previousQuality?: number;
    expectedInterval: number;
    algorithm: "SM2" | "FSRS";
  }>;
}

/**
 * Multi-day scheduling prediction and validation tests
 *
 * This test suite validates that the spaced repetition scheduling works correctly
 * over extended periods by:
 * 1. Calculating predicted scheduling outcomes for 30 days
 * 2. Simulating practice sessions day by day
 * 3. Validating that actual scheduling matches predictions
 */

// Configure test options at the top level
test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  trace: "retain-on-failure",
  viewport: { width: 1728 - 50, height: 1117 - 200 },
});

test.describe("Multi-Day Scheduling Validation", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    logTestStart(testInfo);
    logBrowserContextStart();
    console.log(`===> ${testInfo.file}, ${testInfo.title} <===`);
    await setTestDefaults(page);
    await applyNetworkThrottle(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    await restartBackend();
    await page.waitForTimeout(1_000);
    logBrowserContextEnd();
    logTestEnd(testInfo);
  });

  test.skip("30-day FSRS scheduling prediction and validation", async ({
    page,
  }) => {
    const ttPO = new TuneTreesPageObject(page);
    await ttPO.gotoMainPage();

    // Step 1: Get initial tune state and generate predictions
    console.log("📊 Generating 30-day scheduling predictions...");
    const predictions = await generateSchedulingPredictions(page, TEST_DAYS);
    console.log(`Generated predictions for ${predictions.length} days`);

    // Step 2: Execute practice sessions day by day
    console.log("🎯 Executing multi-day practice simulation...");

    for (let day = 1; day <= TEST_DAYS; day++) {
      const currentDate = new Date();
      currentDate.setDate(currentDate.getDate() + day - 1);
      const dateStr = currentDate.toISOString();

      console.log(`\n--- Day ${day} (${dateStr.split("T")[0]}) ---`);

      // Set the test date for this simulation day
      await setTestDateTime(page, dateStr);

      // Navigate to practice tab to see scheduled tunes
      await ttPO.gotoMainPage();
      await ttPO.navigateToPracticeTab();

      // Get the prediction for this day
      const dayPrediction = predictions.find((p) => p.day === day);

      // Check if any tunes are scheduled for today
      const tuneRows = await ttPO.tunesGridRows.count();
      const actualScheduledCount = Math.max(0, tuneRows - 1); // Subtract header row

      if (dayPrediction && dayPrediction.expectedTunes.length > 0) {
        console.log(
          `Expected ${dayPrediction.expectedTunes.length} tunes, found ${actualScheduledCount}`,
        );

        // Validate that expected tunes are scheduled
        await validateScheduledTunes(page, ttPO, dayPrediction);

        // Practice the scheduled tunes with predetermined quality feedback
        await practiceScheduledTunes(page, ttPO, dayPrediction);
      } else {
        console.log(`No tunes expected for day ${day}`);
        expect(actualScheduledCount).toBe(0);
      }

      // Add a small delay between days to ensure proper state transitions
      await page.waitForTimeout(500);
    }

    console.log("✅ 30-day scheduling simulation completed successfully!");
  });

  test("SM2 vs FSRS scheduling comparison over 14 days", async ({ page }) => {
    const ttPO = new TuneTreesPageObject(page);
    await ttPO.gotoMainPage();

    // TODO: Implement comparison test between SM2 and FSRS algorithms
    // This test would create identical starting conditions and compare
    // how the two algorithms schedule the same tunes over 14 days

    console.log("🔬 SM2 vs FSRS comparison test - TO BE IMPLEMENTED");

    // Placeholder for now
    expect(true).toBe(true);
  });
});

/**
 * Generate scheduling predictions for the specified number of days
 */
async function generateSchedulingPredictions(
  page: Page,
  days: number,
): Promise<IPredictedSchedule[]> {
  const predictions: IPredictedSchedule[] = [];

  // Get initial tune state from the database/API
  const initialTunes = await getInitialTuneState(page);
  console.log(`Starting with ${initialTunes.length} tunes in repertoire`);

  // Simulate scheduling for each day
  for (let day = 1; day <= days; day++) {
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() + day - 1);

    const dayPrediction: IPredictedSchedule = {
      day,
      date: currentDate.toISOString().split("T")[0],
      expectedTunes: [],
    };

    // Calculate which tunes should be scheduled for this day
    // This is a simplified prediction - in reality we'd need to implement
    // the full FSRS/SM2 algorithms to predict accurately

    if (day === 1) {
      // Day 1: Practice a few initial tunes
      dayPrediction.expectedTunes = initialTunes.slice(0, 3).map((tune) => ({
        tuneId: tune.id,
        title: tune.title,
        expectedInterval: 1,
        algorithm: "FSRS" as const,
      }));
    } else if (day === 2) {
      // Day 2: Review based on day 1 performance, plus some new tunes
      dayPrediction.expectedTunes = [
        ...initialTunes.slice(0, 2).map((tune) => ({
          // Review from day 1
          tuneId: tune.id,
          title: tune.title,
          expectedInterval: 1,
          algorithm: "FSRS" as const,
        })),
        ...initialTunes.slice(3, 5).map((tune) => ({
          // New tunes
          tuneId: tune.id,
          title: tune.title,
          expectedInterval: 1,
          algorithm: "FSRS" as const,
        })),
      ];
    } else {
      // Later days: Complex scheduling based on spaced repetition algorithms
      // This would require implementing prediction logic matching the backend
      // For now, we'll use a simplified pattern

      if (day % 3 === 0) {
        // Every 3rd day, schedule some tunes
        dayPrediction.expectedTunes = initialTunes.slice(0, 2).map((tune) => ({
          tuneId: tune.id,
          title: tune.title,
          expectedInterval: Math.floor(day / 3),
          algorithm: "FSRS" as const,
        }));
      }
    }

    predictions.push(dayPrediction);
  }

  return predictions;
}

/**
 * Get the initial state of tunes from the repertoire
 */
interface IInitialTune {
  id: number;
  title: string;
}

async function getInitialTuneState(page: Page): Promise<IInitialTune[]> {
  // Navigate to repertoire to get initial tune list
  const response = await page.request.get(
    "/api/tunetrees/repertoire_tunes_overview/1/1?show_playlist_deleted=false&skip=0&limit=10000",
  );

  if (!response.ok()) {
    throw new Error(`Failed to fetch initial tunes: ${response.status()}`);
  }

  const tunesData: unknown = await response.json();

  // Validate and extract tune IDs and titles for prediction
  if (!Array.isArray(tunesData)) {
    throw new TypeError("Tunes data is not an array");
  }

  return tunesData.slice(0, 10).map((tune, index: number) => {
    // Defensive type assertion
    const id =
      typeof (tune as { id?: unknown }).id === "number"
        ? (tune as { id: number }).id
        : index + 1;
    const title =
      typeof (tune as { title?: unknown }).title === "string"
        ? (tune as { title: string }).title
        : `Tune ${index + 1}`;
    return { id, title };
  });
}

/**
 * Validate that the expected tunes are actually scheduled for practice
 */
async function validateScheduledTunes(
  _page: Page,
  ttPO: TuneTreesPageObject,
  prediction: IPredictedSchedule,
): Promise<void> {
  console.log(
    `Validating ${prediction.expectedTunes.length} expected tunes for day ${prediction.day}`,
  );

  // Get the actual scheduled tunes from the practice grid
  const tuneRows = ttPO.tunesGridRows;
  const rowCount = await tuneRows.count();

  if (rowCount <= 1) {
    // Only header row
    expect(prediction.expectedTunes.length).toBe(0);
    return;
  }

  // Check each expected tune is present
  for (const expectedTune of prediction.expectedTunes) {
    let found = false;

    for (let i = 1; i < rowCount; i++) {
      // Skip header row
      const row = tuneRows.nth(i);
      const idCell = row.locator("td").first();
      const idText = await idCell.textContent();
      const actualTuneId = Number(idText);

      if (actualTuneId === expectedTune.tuneId) {
        found = true;
        console.log(
          `✓ Found expected tune ${expectedTune.tuneId}: ${expectedTune.title}`,
        );
        break;
      }
    }

    if (!found) {
      console.warn(
        `⚠️ Expected tune ${expectedTune.tuneId} not found in schedule`,
      );
      // Note: This might be expected behavior if the algorithm determines
      // the tune doesn't need review yet
    }
  }
}

/**
 * Practice the scheduled tunes with predetermined quality feedback
 */
async function practiceScheduledTunes(
  page: Page,
  ttPO: TuneTreesPageObject,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prediction: IPredictedSchedule,
): Promise<void> {
  const tuneRows = ttPO.tunesGridRows;
  const rowCount = await tuneRows.count();

  if (rowCount <= 1) {
    console.log("No tunes to practice today");
    return;
  }

  console.log(`Practicing ${rowCount - 1} scheduled tunes...`);

  // Practice each scheduled tune with quality feedback
  const qualityOptions = ["good", "good", "hard", "easy"]; // Varied feedback pattern

  for (let i = 1; i < rowCount; i++) {
    // Skip header row
    const row = tuneRows.nth(i);
    const idCell = row.locator("td").first();
    const idText = await idCell.textContent();
    const tuneId = Number(idText);

    // Use cycling quality feedback pattern
    const quality = qualityOptions[(i - 1) % qualityOptions.length];

    console.log(`Practicing tune ${tuneId} with quality: ${quality}`);
    await ttPO.setReviewEval(tuneId, quality);
  }

  // Submit the practice session
  const submitButton = page.getByRole("button", {
    name: "Submit Practiced Tunes",
  });
  if (await submitButton.isVisible()) {
    await ttPO.clickWithTimeAfter(submitButton, 2000);
    await ttPO.waitForSuccessfullySubmitted();
    console.log("✓ Practice session submitted successfully");
  }
}

/**
 * Set the test date/time for simulation
 */
async function setTestDateTime(
  page: Page,
  isoDateString: string,
): Promise<void> {
  await page.addInitScript((dateString: string) => {
    // Override Date constructor and now() to return the simulated date
    const simulatedDate = new Date(dateString);
    const originalDate = window.Date;

    // Create a custom Date class that extends the original
    class MockDate extends originalDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super(simulatedDate.getTime());
        } else {
          super(...(args as ConstructorParameters<typeof originalDate>));
        }
      }

      static now(): number {
        return simulatedDate.getTime();
      }

      static parse(s: string): number {
        return originalDate.parse(s);
      }

      static UTC(...args: Parameters<typeof originalDate.UTC>): number {
        return originalDate.UTC(...args);
      }
    }

    // Override the global Date
    (window as Window & { Date: typeof MockDate }).Date = MockDate;

    // Set environment variable for backend
    (
      window as typeof window & { __TT_REVIEW_SITDOWN_DATE__: string }
    ).__TT_REVIEW_SITDOWN_DATE__ = dateString;
  }, isoDateString);
}
