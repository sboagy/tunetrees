import { test, expect } from "@playwright/test";
import { restartBackend } from "@/test-scripts/global-setup";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { setTestDefaults } from "@/test-scripts/set-test-defaults";
import { runLoginStandalone } from "@/test-scripts/run-login2";
import {
  getTuneGridColumnIndex,
  TuneTreesPageObject,
} from "@/test-scripts/tunetrees.po";
import { navigateToPageWithRetry } from "@/test-scripts/navigation-utils";
import { checkHealth } from "@/test-scripts/check-servers";
import { navigateToPracticeTabStandalone } from "@/test-scripts/tunetrees.po";
import {
  logBrowserContextEnd,
  logBrowserContextStart,
  logTestEnd,
  logTestStart,
} from "@/test-scripts/test-logging";

// Increase timeout for complete workflow tests
test.use({ actionTimeout: 300_000 }); // 300,000 ms = 5 minutes

test.beforeEach(async ({ page }, testInfo) => {
  logTestStart(testInfo);
  logBrowserContextStart();
  console.log(`===> ${testInfo.file}, ${testInfo.title} <===`);

  await setTestDefaults(page);
  await applyNetworkThrottle(page);

  // Check server health before proceeding
  await checkHealth();

  // Navigate to the app and handle login (matching the MCP demo workflow)
  // Navigate directly to /home to avoid redirect interruption
  await navigateToPageWithRetry(page, "https://localhost:3000/home");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2_000);

  // Always perform login as part of the complete workflow test
  await runLoginStandalone(
    page,
    process.env.TEST1_LOGIN_USER_EMAIL,
    process.env.TEST1_LOGIN_USER_PASSWORD,
  );

  await page.waitForLoadState("domcontentloaded");

  await page.waitForTimeout(2000); // Wait for the page to stabilize

  // // I shouldn't have to do this!!! But it seems to be necessary?
  // await navigateToRepertoireTabStandalone(page);

  // await page.waitForLoadState("domcontentloaded");

  // await page.waitForTimeout(2000); // Wait for the page to stabilize
});

test.afterEach(async ({ page }, testInfo) => {
  await restartBackend();
  logBrowserContextEnd();
  logTestEnd(testInfo);
  await page.waitForTimeout(1_000);
});

test("should complete full practice session workflow with recall quality evaluations", async ({
  page,
}) => {
  // Step 1: Navigate to Practice tab
  const ttPO = new TuneTreesPageObject(page);
  await ttPO.navigateToPracticeTabDirectly();

  // Step 2: Wait for data to load and verify we have scheduled tunes
  // Use the same approach as the working tests - count recall quality dropdowns
  const tuneDropdowns = page.locator(
    '[data-testid$="_recall_eval"] [data-testid="tt-recal-eval-popover-trigger"]',
  );

  // Wait for dropdowns to appear with timeout
  await expect(tuneDropdowns.first()).toBeVisible({ timeout: 40000 });

  const tuneCount = await tuneDropdowns.count();
  expect(tuneCount).toBeGreaterThan(0);
  console.log(`Found ${tuneCount} scheduled tunes for practice`);

  // Step 3: Verify Submit button is initially disabled
  const submitButton = page.getByRole("button", {
    name: "Submit Practiced Tunes",
  });
  await expect(submitButton).toBeDisabled();

  // Step 4: Verify Goal and Technique columns are visible
  const goalHeader = page
    .getByRole("cell", {
      name: "Goal",
      exact: true,
    })
    .first();

  await expect(goalHeader).toBeVisible();
  console.log("Goal column confirmed visible");

  // Step 5: Get all recall quality dropdowns
  const recallDropdowns = page.locator(
    '[data-testid$="_recall_eval"] [data-testid="tt-recal-eval-popover-trigger"]',
  );
  const dropdownCount = await recallDropdowns.count();
  console.log(`Found ${dropdownCount} recall quality dropdowns`);

  // Step 6: Select recall quality for each tune (FSRS system)
  const qualityRatings = [
    {
      testId: "tt-recal-eval-good",
      description: "Good: satisfactory recall performance",
    },
    {
      testId: "tt-recal-eval-easy",
      description: "Easy: effortless and confident recall",
    },
    {
      testId: "tt-recal-eval-hard",
      description: "Hard: difficult recall with effort",
    },
    {
      testId: "tt-recal-eval-again",
      description: "Again: need to practice again soon",
    },
  ];

  for (let i = 0; i < Math.min(dropdownCount, qualityRatings.length); i++) {
    const dropdown = recallDropdowns.nth(i);

    // Open the dropdown and wait for the menu to be visible
    await Promise.all([
      dropdown.click(),
      page
        .getByTestId("tt-recal-eval-group-menu")
        .waitFor({ state: "visible" }),
    ]);

    // Select the quality rating and wait for the menu to close
    const rating = qualityRatings[i];
    const ratingLocator = page.getByTestId(rating.testId);
    await Promise.all([
      ratingLocator.click(),
  page.getByTestId("tt-recal-eval-group-menu").waitFor({ state: "hidden" }),
    ]);

    console.log(`Selected rating for tune ${i + 1}: ${rating.description}`);
  }

  // Step 6a: Verify all selections were applied by checking that dropdowns no longer show "Recall Quality..."
  for (let i = 0; i < Math.min(dropdownCount, qualityRatings.length); i++) {
    const rating = qualityRatings[i];
    const selectedText = page.locator(`text=${rating.description}`).first();
    await expect(selectedText).toBeVisible({ timeout: 5000 });
    console.log(`Verified rating for tune ${i + 1}: ${rating.description}`);
  }

  // Step 7: Verify Submit button is now enabled
  await expect(submitButton).toBeEnabled();
  console.log("Submit button is now enabled after all evaluations selected");

  // Step 8: Submit the practice session
  await submitButton.click();
  await page.waitForTimeout(2000); // Wait for submission to process

  // Step 9: Verify submission was successful via toast and row count decrease
  // Observe success toast using shared Page Object helper semantics
  // const ttPO = new TuneTreesPageObject(page);
  await ttPO.waitForSuccessfullySubmitted();
  const rowsAfter = await ttPO.tunesGridRows.count();
  expect(rowsAfter).toBeGreaterThanOrEqual(1);

  // Should show "No Tune selected" message
  await expect(page.locator("text=No Tune selected")).toBeVisible();

  console.log("Practice session completed successfully!");
});

test("should handle partial recall quality selection", async ({ page }) => {
  // Navigate to Practice tab
  await navigateToPracticeTabStandalone(page);

  // Get recall quality dropdowns
  const recallDropdowns = page.locator(
    '[data-testid$="_recall_eval"] [data-testid="tt-recal-eval-popover-trigger"]',
  );
  const dropdownCount = await recallDropdowns.count();

  if (dropdownCount > 0) {
    // Select quality for only the first tune (using FSRS)
    await recallDropdowns.first().click();
    await page.getByTestId("tt-recal-eval-easy").click();

    // Verify submit button is now enabled (partial evaluation allowed)
    const submitButton = page.getByRole("button", {
      name: "Submit Practiced Tunes",
    });
    await expect(submitButton).toBeEnabled();
    console.log(
      "Submit button correctly enabled with partial selection (Practice Goals & Techniques System)",
    );
  }
});

test("should display all recall quality options in dropdown", async ({
  page,
}) => {
  // Navigate to Practice tab
  await navigateToPracticeTabStandalone(page);

  // Get first recall quality dropdown
  const firstDropdown = page
    .locator(
      '[data-testid$="_recall_eval"] [data-testid="tt-recal-eval-popover-trigger"]',
    )
    .first();

  await page.waitForTimeout(500); // bit of time to ensure dropdown is ready
  await firstDropdown.waitFor({ state: "attached", timeout: 50000 });

  if (await firstDropdown.isVisible({ timeout: 50000 })) {
    await firstDropdown.isEnabled({ timeout: 50000 });

    await page.waitForTimeout(2000);

    // Click to open dropdown
    await firstDropdown.click();

    await page.waitForTimeout(500); // Wait for dropdown to open

    // Verify key quality options are present using testid selectors (FSRS system)
    const expectedTestIds = [
      "tt-recal-eval-(Not Set)",
      "tt-recal-eval-again", // Again: need to practice again soon
      "tt-recal-eval-hard", // Hard: difficult recall with effort
      "tt-recal-eval-good", // Good: satisfactory recall performance
      "tt-recal-eval-easy", // Easy: effortless and confident recall
    ];

    for (const testId of expectedTestIds) {
      await expect(page.getByTestId(testId)).toBeVisible();
    }

    console.log("All key recall quality options are present in dropdown");
  } else {
    console.log("Recall quality dropdown not visible or enabled");
    expect(false).toBe(true);
  }
});

test("should show tune details when selecting different tunes", async ({
  page,
}) => {
  // Navigate to Practice tab
  await navigateToPracticeTabStandalone(page);

  // Wait for table to load and check if we have data
  await page.waitForTimeout(1000); // Give time for data to load

  // Check if we have any tunes by looking for recall quality dropdowns
  const recallDropdowns = page.locator(
    '[data-testid$="_recall_eval"] [data-testid="tt-recal-eval-popover-trigger"]',
  );
  const dropdownCount = await recallDropdowns.count();

  if (dropdownCount === 0) {
    console.log("No tunes available for selection testing - table is empty");
    return; // Skip test if no data
  }

  // Get table rows and verify we have data rows beyond the header
  const dataRows = page.locator(
    "table tbody tr, table rowgroup:nth-child(2) row",
  );
  const dataRowCount = await dataRows.count();

  if (dataRowCount >= 2) {
    try {
      // Click on first data row
      await dataRows.first().getByRole("cell").nth(0).click();
      await page.waitForTimeout(500);

      const titleColumnIndex = await getTuneGridColumnIndex(page, "Title");
      if (titleColumnIndex === null) {
        throw new Error(
          "Could not find 'Title' column index in the tune grid.",
        );
      }

      // Try to get the tune title from the Title column (should be column 5, index 4)
      // Look for a link in the title cell as that's how tune titles appear
      const firstTuneTitleCell = dataRows
        .first()
        .locator('[data-col-id="title"]');

      const firstTuneLink = firstTuneTitleCell.getByRole("link");

      if (await firstTuneLink.isVisible({ timeout: 2000 })) {
        const firstTuneTitle = await firstTuneLink.textContent({
          timeout: 2000,
        });

        if (firstTuneTitle) {
          // Verify tune details panel shows this tune (with relaxed timeout)
          // const tuneHeading = page.locator(
          //   `heading:has-text("${firstTuneTitle}")`,
          // );
          const tuneHeading = page
            .locator("div")
            .filter({ hasText: new RegExp(`^${firstTuneTitle}$`) });
          const isHeadingVisible = await tuneHeading.isVisible({
            timeout: 3000,
          });

          if (isHeadingVisible) {
            console.log(`Successfully selected tune: ${firstTuneTitle}`);

            // Try second row if available
            if (dataRowCount >= 2) {
              await dataRows.nth(1).getByRole("cell").nth(0).click();
              await page.waitForTimeout(500);

              const firstTuneTitleCell = dataRows
                .nth(1)
                .locator('[data-col-id="title"]');

              const secondTuneLink = firstTuneTitleCell.getByRole("link");

              // const secondTuneLink = dataRows
              //   .nth(1)
              //   .locator("cell")
              //   .nth(4)
              //   .locator("link");
              if (await secondTuneLink.isVisible({ timeout: 2000 })) {
                const secondTuneTitle = await secondTuneLink.textContent({
                  timeout: 2000,
                });

                if (secondTuneTitle && secondTuneTitle !== firstTuneTitle) {
                  // const secondHeading = page.locator("div").filter({
                  //   hasText: new RegExp(`^${secondTuneTitle}$`),
                  // });
                  const secondHeading = await page
                    .getByTestId("current-tune-title")
                    .innerText();

                  const isSecondVisible =
                    secondHeading.includes(secondTuneTitle);

                  if (isSecondVisible) {
                    console.log(
                      `Successfully selected second tune: ${secondTuneTitle}`,
                    );
                  } else {
                    throw new Error(
                      `Second Tune selected but details panel not found for: ${secondTuneTitle}`,
                    );
                  }
                }
              }
            }

            console.log(
              "Tune details panel correctly updates when selecting different tunes",
            );
          } else {
            throw new Error(
              `Tune selected but details panel not found for: ${firstTuneTitle}`,
            );
          }
        }
      } else {
        throw new Error("Could not find tune title link in expected location");
      }
    } catch (error) {
      throw new Error(`Test 4 raised an error: ${String(error)}`);
    }
  } else {
    throw new Error(
      `Not enough data rows for selection testing: found ${dataRowCount}`,
    );
  }
});
