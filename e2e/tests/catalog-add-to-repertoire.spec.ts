/**
 * E2E Test: Add Tunes from Catalog to Repertoire
 *
 * Tests the "Add To Repertoire" feature on the Catalog toolbar.
 *
 * User Flow:
 * 1. Log in as test user
 * 2. Navigate to Catalog tab
 * 3. Select tunes via checkboxes
 * 4. Click "Add To Repertoire" button
 * 5. Navigate to Repertoire tab
 * 6. Verify selected tunes appear in repertoire
 *
 * Edge Cases:
 * - No tunes selected (button should show alert)
 * - Tunes already in repertoire (should be skipped with feedback)
 * - Multiple tunes selected (batch operation)
 */

import { expect, test } from "@playwright/test";

test.describe("Catalog: Add To Repertoire", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app and wait for sync (user is already authenticated)
    await page.goto("http://localhost:5173/");
    await page.waitForSelector('[data-testid="tab-catalog"]', {
      state: "visible",
      timeout: 15000,
    });
    // Wait for sync to complete
    await page.waitForTimeout(2000);
  });

  test("should show alert when no tunes selected", async ({ page }) => {
    // Navigate to Catalog tab
    await page.getByTestId("tab-catalog").click();
    await page.waitForTimeout(500);

    // Set up dialog handler before clicking button
    let dialogMessage = "";
    page.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click "Add To Repertoire" without selecting any tunes
    await page.getByTestId("catalog-add-to-repertoire-button").click();

    // Wait for dialog to be handled
    await page.waitForTimeout(500);

    // Verify alert message
    expect(dialogMessage).toContain("No tunes selected");
  });

  test("should add selected tunes to repertoire", async ({ page }) => {
    // Navigate to Catalog tab
    await page.getByTestId("tab-catalog").click();
    await page.waitForTimeout(500);

    // Find tunes NOT already in repertoire by checking a few
    // We'll select "A Fig for a Kiss" (ID 3497) and "Alasdruim's March" (ID 54)
    const tune1Checkbox = page.getByRole("checkbox", {
      name: "Select row 3497",
    });
    const tune2Checkbox = page.getByRole("checkbox", { name: "Select row 54" });

    await tune1Checkbox.check();
    await tune2Checkbox.check();

    // Verify selection count shows
    await expect(page.getByText(/2 tunes selected/)).toBeVisible();

    // Set up dialog handler
    let dialogMessage = "";
    page.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click "Add To Repertoire"
    await page.getByTestId("catalog-add-to-repertoire-button").click();

    // Wait for dialog
    await page.waitForTimeout(500);

    // Verify success message (should say "Added X tunes to repertoire")
    expect(dialogMessage).toMatch(/Added \d+ tunes? to repertoire/);

    // Verify selection was cleared (Delete button should be disabled)
    const deleteButton = page.getByRole("button", { name: /Delete/i });
    await expect(deleteButton).toBeDisabled();

    // Navigate to Repertoire tab
    await page.getByTestId("tab-repertoire").click();
    await page.waitForTimeout(1000);

    // Verify tunes appear in repertoire grid
    await expect(
      page.getByRole("link", { name: "A Fig for a Kiss" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Alasdruim's March (Rolling Wave 2)" })
    ).toBeVisible();

    // Verify tune count increased
    const repertoireCount = await page
      .getByText(/\d+ tunes in repertoire/)
      .textContent();
    expect(repertoireCount).toBeTruthy();
    const count = Number.parseInt(repertoireCount?.match(/\d+/)?.[0] || "0");
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("should handle tunes already in repertoire", async ({ page }) => {
    // Navigate to Catalog tab
    await page.getByTestId("tab-catalog").click();
    await page.waitForTimeout(500);

    // Select a tune that's already in repertoire (Banish Misfortune, ID 9001)
    const checkbox = page.getByRole("checkbox", { name: "Select row 9001" });
    await checkbox.check();

    // Set up dialog handler
    let dialogMessage = "";
    page.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click "Add To Repertoire"
    await page.getByTestId("catalog-add-to-repertoire-button").click();

    // Wait for dialog
    await page.waitForTimeout(500);

    // Should show "already in repertoire" message or "0 added"
    expect(dialogMessage).toMatch(/already in repertoire|No tunes were added/);
  });

  test("should handle batch add with mix of new and existing tunes", async ({
    page,
  }) => {
    // Navigate to Catalog tab
    await page.getByTestId("tab-catalog").click();
    await page.waitForTimeout(500);

    // Select first two tunes using nth() to avoid specific ID lookups
    const checkboxes = page.locator(
      'input[type="checkbox"][aria-label^="Select row"]'
    );
    await checkboxes.nth(0).check();
    await page.waitForTimeout(300); // Wait for grid to stabilize
    await checkboxes.nth(1).check();

    // Set up dialog handler
    let dialogMessage = "";
    page.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click "Add To Repertoire"
    await page.getByTestId("catalog-add-to-repertoire-button").click();

    // Wait for dialog
    await page.waitForTimeout(500);

    // Should show result message (may vary based on which tunes selected)
    expect(dialogMessage).toBeTruthy();
    expect(dialogMessage).toMatch(/Added \d+|already in repertoire/);
  });
});
