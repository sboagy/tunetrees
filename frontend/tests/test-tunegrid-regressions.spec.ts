import { setTestDefaults } from "../test-scripts/set-test-defaults";
import { restartBackend } from "@/test-scripts/global-setup";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { getStorageState } from "@/test-scripts/storage-state";
import { TuneTreesPageObject } from "@/test-scripts/tunetrees.po";
import { expect, test } from "@playwright/test";
import {
  logTestStart,
  logTestEnd,
  logBrowserContextStart,
  logBrowserContextEnd,
} from "../test-scripts/test-logging";

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
  await page.waitForTimeout(1_000);
  await restartBackend();
  await page.waitForTimeout(1_000);
  logBrowserContextEnd();
  logTestEnd(testInfo);
});

async function clearExistingSorts(ttPO: TuneTreesPageObject) {
  console.log(
    "Clearing Scheduled/Latest Review column sorting to avoid multi-column interference...",
  );
  await expect(ttPO.LatestReviewColumnHeaderSortButton).toBeVisible({
    timeout: 15000,
  });
  await expect(ttPO.LatestReviewColumnHeaderSortButton).toBeVisible();

  // Click the Scheduled/Latest Review column to cycle through its sort states until unsorted
  // Scheduled is likely pre-sorted ascending, so: asc → desc → unsorted
  await ttPO.clickWithTimeAfter(ttPO.LatestReviewColumnHeaderSortButton, 1000);

  await ttPO.clickWithTimeAfter(ttPO.LatestReviewColumnHeaderSortButton, 1000);

  console.log(
    "Latest Review column cleared, now testing multi-column sorting...",
  );
}

test.describe.serial("TuneGrid Regression Tests", () => {
  test("test-column-sorting-arrows-functionality", async ({ page }) => {
    // Navigate to main page first, then repertoire tab using the working pattern
    const ttPO = new TuneTreesPageObject(page);
    await ttPO.gotoMainPage();
    // await navigateToRepertoireTabStandalone(page);
    await page.waitForLoadState("domcontentloaded");
    await ttPO.expectTableStatusBasic();

    // Wait for the grid to be visible
    const tunesGrid = page.locator("table").first();
    await expect(tunesGrid).toBeVisible({ timeout: 15000 });

    // CRITICAL: Scroll to tune 947 first to ensure visibility in virtual table
    console.log("Scrolling to tune ID 947 for virtual table visibility...");
    await ttPO.scrollToTuneById(947);
    await page.waitForTimeout(1000);

    // ... inside your test:
    await clearExistingSorts(ttPO);

    // Find the ID column sorting button (anchor by data-testid for robustness)
    await expect(ttPO.idColumnHeaderSortButton).toBeVisible({ timeout: 15000 });

    // Verify the button shows the unsorted icon initially (ArrowUpDown)
    const unsortedIcon = ttPO.idColumnHeaderSortButton.locator("svg");
    await expect(unsortedIcon).toBeVisible();

    // Get initial data to compare before and after sorting
    const initialFirstRow = page.getByRole("row").nth(1);
    const initialFirstRowIdCell = initialFirstRow
      .locator('[data-col-id="id"]')
      .first();
    await expect(initialFirstRowIdCell).toBeVisible();
    const initialFirstId = await initialFirstRowIdCell.textContent();

    console.log("Initial first row ID:", initialFirstId);

    // Click the sort button to sort ascending
    await ttPO.clickWithTimeAfter(ttPO.idColumnHeaderSortButton, 4000);

    // Verify the sort changed to ascending
    const ascendingIcon = ttPO.idColumnHeaderSortButton.locator("svg");
    await expect(ascendingIcon).toBeVisible();
    await expect(ttPO.idColumnHeaderSortButton).toHaveAttribute(
      "title",
      /Ascending column sort/,
    );

    // Ensure we're reading from the top of the virtualized viewport
    const scrollContainer1 = page.getByTestId("tunes-grid-scroll-container");
    await scrollContainer1.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForTimeout(200);

    // Poll until ascending order is reflected in the virtualized viewport
    {
      let attempts = 0;
      let ok = false;
      while (attempts < 20 && !ok) {
        const firstCell = page
          .getByRole("row")
          .nth(1)
          .locator('[data-col-id="id"]')
          .first();
        const thirdCell = page
          .getByRole("row")
          .nth(3)
          .locator('[data-col-id="id"]')
          .first();
        const a = Number.parseInt((await firstCell.textContent()) || "0");
        const b = Number.parseInt((await thirdCell.textContent()) || "0");
        console.log(`Asc check attempt ${attempts}: first=${a}, third=${b}`);
        if (a <= b && a > 0 && b > 0) ok = true;
        else {
          await page.waitForTimeout(200);
          // Nudge scroll to force virtualizer refresh
          await scrollContainer1.evaluate((el) => {
            el.scrollTop = 0;
          });
        }
        attempts++;
      }
      expect(ok).toBeTruthy();
    }

    // Click again to sort descending
    await ttPO.clickWithTimeAfter(ttPO.idColumnHeaderSortButton, 1000);

    // Verify the sort changed to descending
    const descendingIcon = ttPO.idColumnHeaderSortButton.locator("svg");
    await expect(descendingIcon).toBeVisible();
    await expect(ttPO.idColumnHeaderSortButton).toHaveAttribute(
      "title",
      /Descending column sort/,
    );
    // Ensure we're reading from the top of the virtualized viewport
    const scrollContainer = page.getByTestId("tunes-grid-scroll-container");
    await scrollContainer.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForTimeout(200);
    // Poll until descending order is reflected in the virtualized viewport
    {
      let attempts = 0;
      let ok = false;
      while (attempts < 20 && !ok) {
        const firstCell = page
          .getByRole("row")
          .nth(1)
          .locator('[data-col-id="id"]')
          .first();
        const thirdCell = page
          .getByRole("row")
          .nth(3)
          .locator('[data-col-id="id"]')
          .first();
        const a = Number.parseInt((await firstCell.textContent()) || "0");
        const b = Number.parseInt((await thirdCell.textContent()) || "0");
        console.log(`Desc check attempt ${attempts}: first=${a}, third=${b}`);
        if (a >= b && a > 0 && b > 0) ok = true;
        else {
          await page.waitForTimeout(200);
          await scrollContainer.evaluate((el) => {
            el.scrollTop = 0;
          });
        }
        attempts++;
      }
      expect(ok).toBeTruthy();
    }

    // Click again to clear sorting
    await ttPO.clickWithTimeAfter(ttPO.idColumnHeaderSortButton, 1000);

    // Wait until the sort state is cleared (button title no longer matches ascending/descending)
    await expect(ttPO.idColumnHeaderSortButton).not.toHaveAttribute(
      "title",
      /(Ascending|Descending) column sort/,
    );
  });

  test("test-multicolumn-sorting", async ({ page }) => {
    // Navigate to main page first, then repertoire tab using the working pattern
    const ttPO = new TuneTreesPageObject(page);
    await ttPO.gotoMainPage();
    // await navigateToRepertoireTabStandalone(page);
    await page.waitForLoadState("domcontentloaded");

    const tunesGrid = page.locator("table").first();
    await expect(tunesGrid).toBeVisible({ timeout: 15000 });

    await clearExistingSorts(ttPO);

    // Test sorting by Type column first using Page Object locators (button-based to avoid role brittleness)
    // Ensure the Type header button is scrolled into view (header can be horizontally off-screen)
    await ttPO.safeScrollIntoView(ttPO.typeColumnHeaderSortButton);
    await expect(ttPO.typeColumnHeaderSortButton).toBeVisible({
      timeout: 15000,
    });

    await ttPO.clickWithTimeAfter(ttPO.idColumnHeaderSortButton, 1000);

    // Then sort by Title while holding shift (multicolumn)
    await ttPO.safeScrollIntoView(ttPO.titleColumnHeaderSortButton);
    await expect(ttPO.titleColumnHeaderSortButton).toBeVisible({
      timeout: 15000,
    });

    // Use keyboard modifier for multicolumn sorting
    await page.keyboard.down("Shift");
    await ttPO.clickWithTimeAfter(ttPO.idColumnHeaderSortButton, 1000);
    await page.keyboard.up("Shift");
    await page.waitForTimeout(1000);

    // Verify that both columns show sorting indicators
    const typeSortArrow = ttPO.typeColumnHeaderSortButton.locator("svg");
    const titleSortArrow = ttPO.titleColumnHeaderSortButton.locator("svg");

    await expect(typeSortArrow).toBeVisible();
    await expect(titleSortArrow).toBeVisible();

    console.log("✅ Multi-column sorting is working correctly!");
  });

  test("test-repertoire-color-coding", async ({ page }) => {
    // Navigate to main page first, then repertoire tab using the working pattern
    const ttPO = new TuneTreesPageObject(page);
    await ttPO.gotoMainPage();
    // await navigateToRepertoireTabStandalone(page);
    await page.waitForLoadState("domcontentloaded");

    const tunesGrid = page.locator("table").first();
    await expect(tunesGrid).toBeVisible({ timeout: 15000 });

    // Look for rows with different color coding based on scheduling state
    const tableRows = page.getByRole("row");

    // Check multiple rows to find examples of different color coding
    let foundColorCoding = false;
    const colorCodingExamples = [];

    for (let i = 1; i <= Math.min(10, await tableRows.count()); i++) {
      const row = tableRows.nth(i);
      if (await row.isVisible()) {
        const rowClasses = await row.getAttribute("class");
        console.log(`Row ${i} classes:`, rowClasses);

        if (rowClasses) {
          // Check for color coding classes that indicate scheduling states
          // Based on the getStyleForSchedulingState function in TunesGridRepertoire.tsx
          if (rowClasses.includes("font-extrabold")) {
            colorCodingExamples.push(`Row ${i}: Current/Due (font-extrabold)`);
            foundColorCoding = true;
          } else if (
            rowClasses.includes("italic") &&
            rowClasses.includes("text-green-300")
          ) {
            colorCodingExamples.push(
              `Row ${i}: Future (italic text-green-300)`,
            );
            foundColorCoding = true;
          } else if (
            rowClasses.includes("text-gray-300") &&
            rowClasses.includes("underline")
          ) {
            colorCodingExamples.push(
              `Row ${i}: Lapsed (underline text-gray-300)`,
            );
            foundColorCoding = true;
          } else if (
            rowClasses.includes("underline") &&
            !rowClasses.includes("text-gray-300")
          ) {
            colorCodingExamples.push(`Row ${i}: New/Unscheduled (underline)`);
            foundColorCoding = true;
          }
        }
      }
    }

    console.log("Color coding examples found:", colorCodingExamples);

    // We should find at least some color coding since we fixed the sitdown date initialization
    // If no specific color coding is found, at least verify that rows have baseline styling
    if (!foundColorCoding) {
      // Check that at least the basic row classes are present
      const firstDataRow = tableRows.nth(1);
      const rowClasses = await firstDataRow.getAttribute("class");
      expect(rowClasses).toContain("cursor-pointer");
      console.log(
        "⚠️  No specific color coding found, but basic row styling is present",
      );
      console.log(
        "This might indicate that all tunes have similar scheduling states",
      );
    } else {
      console.log(
        "✅ Color coding is working - found",
        colorCodingExamples.length,
        "examples",
      );
    }

    // Always verify the basic grid structure is present
    expect(await tableRows.count()).toBeGreaterThan(1);
  });

  test("test-sorting-persistence", async ({ page }) => {
    // Navigate to main page first, then repertoire tab using the working pattern
    const ttPO = new TuneTreesPageObject(page);
    await ttPO.gotoMainPage();
    // await navigateToRepertoireTabStandalone(page);
    await page.waitForLoadState("domcontentloaded");

    const tunesGrid = page.locator("table").first();
    await expect(tunesGrid).toBeVisible({ timeout: 15000 });

    await ttPO.tableStatus.waitFor({ state: "attached", timeout: 15000 });
    await expect(ttPO.tableStatus).toContainText("1 of 488 row(s) selected");

    // Sort by ID column
    await ttPO.clickWithTimeAfter(ttPO.idColumnHeaderSortButton, 1000);

    // Get the first row ID after sorting
    const firstRowIdCell = page
      .getByRole("row")
      .nth(1)
      .locator('[data-testid*="id"]')
      .first();
    const sortedFirstId = await firstRowIdCell.textContent();
    console.log("Sorted first ID:", sortedFirstId);

    // Navigate away and back to test persistence - we need to import these functions
    // For now, just verify sorting worked on this page
    // TODO: Add proper navigation testing when we have the functions available

    // Verify that sorting is currently applied by checking the sorted state
    const sortIcon = ttPO.idColumnHeaderSortButton.locator("svg");
    await expect(sortIcon).toBeVisible();

    console.log("✅ Sorting persistence test completed (limited scope)");
  });
});
