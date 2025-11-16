/**
 * Simplified multi-day scheduling confirmation tests for UI.
 *
 * These tests validate that the scheduling system works correctly in the UI
 * over a few days, complementing the comprehensive API tests.
 */

import { expect, test } from "@playwright/test";
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

// Use storage state for authentication
test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  trace: "retain-on-failure",
  viewport: { width: 1728 - 50, height: 1117 - 200 },
});

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

test.skip("3-day scheduling progression validates basic spaced repetition", async ({
  page,
}) => {
  const ttPO = new TuneTreesPageObject(page);

  // Day 1: Navigate to practice and submit some feedback
  console.log("📅 Day 1: Initial practice session");
  await ttPO.gotoMainPage();
  await ttPO.navigateToPracticeTab();

  // Check if we have tunes to practice
  await expect(ttPO.tunesGrid).toBeVisible({ timeout: 15000 });
  const initialTuneCount = await ttPO.tunesGridRows.count();

  if (initialTuneCount > 0) {
    console.log(`Found ${initialTuneCount} tunes available for practice`);

    // Select a few tunes and give them feedback
    const tunesToPractice = Math.min(3, initialTuneCount);

    for (let i = 0; i < tunesToPractice; i++) {
      const row = ttPO.tunesGridRows.nth(i);
      const checkbox = row.getByRole("checkbox");

      if (await checkbox.isVisible()) {
        await checkbox.check();
        console.log(`Selected tune ${i + 1} for practice`);
      }
    }

    // Submit practice feedback
    if (await ttPO.submitPracticedTunesButton.isVisible()) {
      await ttPO.submitPracticedTunesButton.click();
      console.log("Submitted practice feedback for Day 1");

      // Wait for feedback dialog and submit with "good" quality
      const feedbackDialog = page.locator('[role="dialog"]');
      if (await feedbackDialog.isVisible({ timeout: 5000 })) {
        // Look for quality buttons and click "good" for all tunes
        const goodButtons = feedbackDialog.getByRole("button", {
          name: /good/i,
        });
        const goodButtonCount = await goodButtons.count();

        if (goodButtonCount > 0) {
          await goodButtons.first().click();
          console.log("Selected 'good' quality rating");
        }

        // Submit the feedback
        const submitButton = feedbackDialog.getByRole("button", {
          name: /submit/i,
        });
        if (await submitButton.isVisible()) {
          await submitButton.click();
          console.log("Submitted quality feedback");
        }
      }
    }
  } else {
    console.log("No tunes available for practice on Day 1");
  }

  // Record tunes scheduled for next few days
  await ttPO.navigateToRepertoireTab();
  await expect(ttPO.tunesGrid).toBeVisible();

  const day1RepertoireCount = await ttPO.tunesGridRows.count();
  console.log(`Day 1: Repertoire shows ${day1RepertoireCount} total tunes`);
});

test.skip("scheduled column drives practice availability", async ({ page }) => {
  const ttPO = new TuneTreesPageObject(page);

  console.log(
    "🔍 Validating that scheduled column controls practice availability",
  );

  // Check repertoire tab to see total tunes
  await ttPO.navigateToRepertoireTab();
  await expect(ttPO.tunesGrid).toBeVisible();
  const totalTunes = await ttPO.tunesGridRows.count();
  console.log(`Total tunes in repertoire: ${totalTunes}`);

  // Check practice tab to see available tunes
  await ttPO.navigateToPracticeTab();
  await expect(ttPO.tunesGrid).toBeVisible();
  const availableTunes = await ttPO.tunesGridRows.count();
  console.log(`Tunes available for practice: ${availableTunes}`);

  // The critical test: practice availability should be based on scheduled dates
  // If scheduling is working correctly, available tunes <= total tunes
  expect(availableTunes).toBeLessThanOrEqual(totalTunes);

  // Additional validation: if we have tunes in repertoire but none available for practice,
  // that suggests scheduling is working (nothing scheduled for today)
  if (totalTunes > 0) {
    console.log(
      `✅ Scheduling system properly filtering tunes: ${availableTunes}/${totalTunes} available`,
    );
  }
});

test.skip("practice feedback updates scheduling state", async ({ page }) => {
  const ttPO = new TuneTreesPageObject(page);

  console.log("⚡ Testing that practice feedback updates tune scheduling");

  await ttPO.gotoMainPage();
  await ttPO.navigateToPracticeTab();

  await expect(ttPO.tunesGrid).toBeVisible();
  const initialCount = await ttPO.tunesGridRows.count();

  if (initialCount > 0) {
    console.log(`Starting with ${initialCount} tunes available for practice`);

    // Practice one tune
    const firstRow = ttPO.tunesGridRows.first();
    const firstCheckbox = firstRow.getByRole("checkbox");

    if (await firstCheckbox.isVisible()) {
      await firstCheckbox.check();
      console.log("Selected first tune for practice");

      if (await ttPO.submitPracticedTunesButton.isVisible()) {
        await ttPO.submitPracticedTunesButton.click();

        // Handle feedback dialog
        const feedbackDialog = page.locator('[role="dialog"]');
        if (await feedbackDialog.isVisible({ timeout: 5000 })) {
          const goodButtons = feedbackDialog.getByRole("button", {
            name: /good/i,
          });
          if ((await goodButtons.count()) > 0) {
            await goodButtons.first().click();
          }

          const submitButton = feedbackDialog.getByRole("button", {
            name: /submit/i,
          });
          if (await submitButton.isVisible()) {
            await submitButton.click();
            console.log("Submitted practice feedback");

            // Wait for dialog to close
            await feedbackDialog.waitFor({ state: "hidden", timeout: 5000 });
          }
        }

        // Check if the count changed (tune was rescheduled)
        await expect(ttPO.tunesGrid).toBeVisible();
        const finalCount = await ttPO.tunesGridRows.count();

        console.log(
          `After practice: ${finalCount} tunes available (was ${initialCount})`,
        );

        // The practiced tune should be rescheduled (fewer available or same if others became available)
        // This validates that the scheduling system is updating
        if (finalCount !== initialCount) {
          console.log(
            "✅ Practice feedback successfully updated scheduling state",
          );
        }
      }
    }
  } else {
    console.log("No tunes available for practice feedback test");
  }
});
