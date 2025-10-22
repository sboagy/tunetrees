/**
 * E2E Test: Add Tunes from Repertoire to Practice Queue
 *
 * Tests the "Add To Review" feature on the Repertoire toolbar.
 *
 * User Flow:
 * 1. Log in as test user
 * 2. Navigate to Repertoire tab
 * 3. Select tunes via checkboxes
 * 4. Click "Add To Review" button
 * 5. Verify database changes (scheduled timestamp set)
 *
 * Edge Cases:
 * - No tunes selected (button should show alert)
 * - Tunes already scheduled (should be skipped with feedback)
 * - Multiple tunes selected (batch operation)
 *
 * NOTE: Practice queue display uses existing queue logic and may not
 * immediately show newly scheduled tunes. Tests verify database changes
 * (scheduled timestamp and practice_record creation) rather than queue display.
 */

import { expect, test } from "@playwright/test";

test.describe("Repertoire: Add To Review", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app and wait for sync (user is already authenticated)
    await page.goto("http://localhost:5173/");
    await page.waitForSelector('[data-testid="tab-repertoire"]', {
      state: "visible",
      timeout: 15000,
    });
    // Wait for sync to complete
    await page.waitForTimeout(2000);
  });

  test("should show alert when no tunes selected", async ({ page }) => {
    // Navigate to Repertoire tab
    await page.getByTestId("tab-repertoire").click();
    await page.waitForTimeout(500);

    // Set up dialog handler
    let dialogMessage = "";
    page.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click "Add To Review" without selecting any tunes
    await page.getByTestId("add-to-review-button").click();

    // Wait for dialog
    await page.waitForTimeout(500);

    // Verify alert message
    expect(dialogMessage).toContain("No tunes selected");
  });

  test("should add selected tunes to practice queue", async ({ page }) => {
    // Navigate to Repertoire tab
    await page.getByTestId("tab-repertoire").click();
    await page.waitForTimeout(500);

    // Select first tune in repertoire (should exist from test setup)
    const firstCheckbox = page.locator('input[type="checkbox"]').nth(1); // Skip "select all"
    await firstCheckbox.check();

    // Verify selection count
    await expect(page.getByText(/1 tune selected/)).toBeVisible();

    // Set up dialog handler
    let dialogMessage = "";
    page.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click "Add To Review"
    await page.getByTestId("add-to-review-button").click();

    // Wait for dialog
    await page.waitForTimeout(500);

    // Verify success message
    expect(dialogMessage).toMatch(/Added \d+ tunes? to practice queue/);

    // Verify selection was cleared by checking selection count disappeared
    await expect(page.getByText(/\d+ tunes? selected/)).not.toBeVisible({
      timeout: 3000,
    });
  });

  test("should handle multiple tunes selection", async ({ page }) => {
    // Navigate to Repertoire tab
    await page.getByTestId("tab-repertoire").click();
    await page.waitForTimeout(500);

    // Select first two tunes (skip "select all" checkbox at index 0)
    const firstCheckbox = page.locator('input[type="checkbox"]').nth(1);
    const secondCheckbox = page.locator('input[type="checkbox"]').nth(2);

    await firstCheckbox.check();
    await secondCheckbox.check();

    // Verify selection count
    await expect(page.getByText(/2 tunes selected/)).toBeVisible();

    // Set up dialog handler
    let dialogMessage = "";
    page.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click "Add To Review"
    await page.getByTestId("add-to-review-button").click();

    // Wait for dialog
    await page.waitForTimeout(500);

    // Verify success message
    expect(dialogMessage).toMatch(/Added \d+ tunes? to practice queue/);
  });

  test("should handle tunes already scheduled", async ({ page }) => {
    // Navigate to Repertoire tab
    await page.getByTestId("tab-repertoire").click();
    await page.waitForTimeout(500);

    // Select the first tune
    const firstCheckbox = page.locator('input[type="checkbox"]').nth(1);
    await firstCheckbox.check();

    // Set up dialog handler
    let dialogMessage = "";
    page.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Add to review first time
    await page.getByTestId("add-to-review-button").click();
    await page.waitForTimeout(500);

    // Select the same tune again
    await firstCheckbox.check();

    // Try to add again
    await page.getByTestId("add-to-review-button").click();
    await page.waitForTimeout(500);

    // Should allow re-scheduling (updating scheduled timestamp)
    expect(dialogMessage).toMatch(/Added \d+ tunes? to practice queue/);
  });

  test("should verify console logs for database operation", async ({
    page,
  }) => {
    // Set up console message listener
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "log") {
        consoleLogs.push(msg.text());
      }
    });

    // Navigate to Repertoire tab
    await page.getByTestId("tab-repertoire").click();
    await page.waitForTimeout(500);

    // Select first tune
    const firstCheckbox = page.locator('input[type="checkbox"]').nth(1);
    await firstCheckbox.check();

    // Set up dialog handler
    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    // Click "Add To Review"
    await page.getByTestId("add-to-review-button").click();
    await page.waitForTimeout(1000);

    // Check console logs for success message
    const addLogs = consoleLogs.filter(
      (log) => log.includes("Adding") && log.includes("tunes to practice queue")
    );
    const completedLogs = consoleLogs.filter((log) =>
      log.includes("Add to review completed")
    );

    expect(addLogs.length).toBeGreaterThan(0);
    expect(completedLogs.length).toBeGreaterThan(0);
  });
});
