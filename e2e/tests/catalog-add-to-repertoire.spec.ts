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
import { setupForCatalogTests } from "../helpers/practice-scenarios";

test.describe.serial("Catalog: Add To Repertoire", () => {
  test.beforeEach(async ({ page }) => {
    // Fast setup: clear repertoire, start on catalog tab
    await setupForCatalogTests(page, {
      emptyRepertoire: true,
      startTab: "catalog",
    });
    await page.waitForSelector('[data-testid="tab-repertoire"]', {
      timeout: 10000,
    });
    await page.getByTestId("tab-repertoire").click();
    await page.waitForTimeout(500);

    const dataRows = page.locator(
      '[data-testid="tunes-grid-repertoire"] tbody tr[data-index]'
    );
    const dataCount = await dataRows.count();
    console.log(`📊 Repertoire has ${dataCount} data rows`);
    expect(dataCount).toBe(0);

    await page.getByTestId(`tab-catalog`).click();
    await page.waitForTimeout(500);
  });

  test("should show alert when no tunes selected", async ({ page }) => {
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

  test("should add selected tunes to repertoire @side-effects", async ({
    page,
  }) => {
    // Capture console messages
    page.on("console", (msg) => console.log(`🖥️  BROWSER: ${msg.text()}`));
    page.on("pageerror", (err) =>
      console.error(`❌ PAGE ERROR: ${err.message}`)
    );

    // Navigate to Catalog tab
    await page.getByTestId("tab-catalog").click();
    await page.waitForTimeout(500);

    // Select specific tunes that we know exist (IDs 3497, 54)
    const tune1Checkbox = page.getByRole("checkbox", {
      name: "Select row 3497",
    });
    const tune2Checkbox = page.getByRole("checkbox", { name: "Select row 54" });

    await tune1Checkbox.check();
    await tune2Checkbox.check();

    // Debug: Check how many checkboxes are actually checked
    const checkedBoxes = await page
      .locator(
        '[data-testid="tunes-grid-catalog"] input[type="checkbox"]:checked'
      )
      .count();
    console.log(`📌 Number of checked boxes: ${checkedBoxes}`);

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

    // Verify success message (should be 2 new tunes since we started empty)
    console.log(`Dialog: ${dialogMessage}`);
    expect(dialogMessage).toContain("Added 2 tune");

    // Wait for sync
    await page.waitForTimeout(2000);

    // Navigate to Repertoire tab
    await page.getByTestId("tab-repertoire").click();
    await page.waitForTimeout(1000);

    // Debug: Query Supabase directly to see what's actually there
    const supabaseCount = await page.evaluate(async () => {
      const response = await fetch(
        "http://localhost:54321/rest/v1/playlist_tune?playlist_ref=eq.9001&select=tune_ref",
        {
          headers: {
            apikey:
              "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
            "Content-Type": "application/json",
          },
        }
      );
      const data = await response.json();
      return data.length;
    });
    console.log(`🔍 Supabase has ${supabaseCount} tunes for Alice`);

    // Grid uses virtualization with spacer rows for scrolling
    // Count only data rows (those with data-index attribute)
    const dataRows = page.locator(
      '[data-testid="tunes-grid-repertoire"] tbody tr[data-index]'
    );
    const dataCount = await dataRows.count();
    console.log(`📊 Repertoire has ${dataCount} data rows`);
    expect(dataCount).toBe(2);

    // Verify the tunes are the ones we added
    const row0Text = await dataRows.nth(0).textContent();
    const row1Text = await dataRows.nth(1).textContent();
    expect(row0Text).toContain("A Fig for a Kiss");
    expect(row1Text).toContain("Alasdruim's March");
  });

  test("should handle tunes already in repertoire @side-effects", async ({
    page,
  }) => {
    // First add tune 9001 to repertoire
    await page.getByTestId("tab-catalog").click();
    await page.waitForTimeout(500);

    const checkbox1 = page.getByRole("checkbox", { name: "Select row 9001" });
    await checkbox1.check();

    let dialogMessage = "";
    page.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await page.getByTestId("catalog-add-to-repertoire-button").click();
    await page.waitForTimeout(500);
    console.log(`First add: ${dialogMessage}`);
    expect(dialogMessage).toContain("Added 1 tune");

    // Now try to add same tune again
    await page.getByTestId("tab-catalog").click();
    await page.waitForTimeout(500);

    const checkbox2 = page.getByRole("checkbox", { name: "Select row 9001" });
    await checkbox2.check();

    dialogMessage = ""; // Reset
    await page.getByTestId("catalog-add-to-repertoire-button").click();
    await page.waitForTimeout(500);

    // Should show "already in repertoire" or "0 added"
    console.log(`Second add: ${dialogMessage}`);
    expect(dialogMessage).toMatch(/already in repertoire|No tunes were added/);
  });

  test("should handle batch add with mix of new and existing tunes", async ({
    page,
  }) => {
    // First add tune 66
    await page.getByTestId("tab-catalog").click();
    await page.waitForTimeout(500);

    const checkbox = page.getByRole("checkbox", { name: "Select row 66" });
    await checkbox.check();

    let dialogMessage = "";
    page.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await page.getByTestId("catalog-add-to-repertoire-button").click();
    await page.waitForTimeout(500);

    // Now add batch: one new (70), one existing (66)
    await page.getByTestId("tab-catalog").click();
    await page.waitForTimeout(500);

    await page.getByRole("checkbox", { name: "Select row 66" }).check();
    await page.getByRole("checkbox", { name: "Select row 70" }).check();

    dialogMessage = ""; // Reset
    await page.getByTestId("catalog-add-to-repertoire-button").click();
    await page.waitForTimeout(500);

    // Should show "Added 1" (only the new one)
    console.log(`Batch add: ${dialogMessage}`);
    expect(dialogMessage).toContain("Added 1 tune");
  });

  test("CRITICAL: should persist added tunes after page reload @side-effects", async ({
    page,
  }) => {
    // Navigate to Catalog tab
    await page.getByTestId("tab-catalog").click();
    await page.waitForTimeout(500);

    {
      const dataRowsBefore = page.locator(
        '[data-testid="tunes-grid-repertoire"] tbody tr[data-index]'
      );
      const countBefore = await dataRowsBefore.count();
      console.log(`✅ ${countBefore} tunes before reload (1)`);
      expect(countBefore).toBe(0);
    }

    // Select 2 specific tunes
    const tune1Checkbox = page.getByRole("checkbox", {
      name: "Select row 3497",
    });
    const tune2Checkbox = page.getByRole("checkbox", { name: "Select row 54" });

    await tune1Checkbox.check();
    await tune2Checkbox.check();

    // Debug: Check how many checkboxes are actually checked
    const checkedBoxes = await page
      .locator(
        '[data-testid="tunes-grid-catalog"] input[type="checkbox"]:checked'
      )
      .count();
    console.log(`📌 Number of checked boxes in catalog: ${checkedBoxes}`);

    // Click "Add To Repertoire" and dismiss dialog
    page.on("dialog", async (dialog) => {
      console.log("Dialog message:", dialog.message());
      await dialog.accept();
    });
    await page.getByTestId("catalog-add-to-repertoire-button").click();

    // Wait for sync to complete
    console.log("⏳ Waiting for sync to complete...");
    await page.waitForTimeout(3000);

    // Navigate to Repertoire to verify tunes were added
    await page.getByTestId("tab-repertoire").click();
    await page.waitForTimeout(1000);

    // Verify exactly 2 tunes appear (count data rows only, not spacers)
    const dataRowsBefore = page.locator(
      '[data-testid="tunes-grid-repertoire"] tbody tr[data-index]'
    );
    const countBefore = await dataRowsBefore.count();
    console.log(`✅ ${countBefore} tunes before reload (2)`);
    expect(countBefore).toBe(2);

    // RELOAD THE PAGE
    console.log("🔄 Reloading page...");
    await page.reload();
    await page.waitForTimeout(3000); // Wait for sync down

    // Navigate back to Repertoire tab
    await page.getByTestId("tab-repertoire").click();
    await page.waitForTimeout(1000);

    // CRITICAL: Verify tunes STILL appear after reload
    const dataRowsAfter = page.locator(
      '[data-testid="tunes-grid-repertoire"] tbody tr[data-index]'
    );
    const countAfter = await dataRowsAfter.count();
    console.log(`📊 ${countAfter} tunes after reload`);
    expect(countAfter).toBe(2);

    const row0Text = await dataRowsAfter.nth(0).textContent();
    const row1Text = await dataRowsAfter.nth(1).textContent();
    expect(row0Text).toContain("A Fig for a Kiss");
    expect(row1Text).toContain("Alasdruim's March");

    console.log("✅ PASS: Tunes persist after reload!");
  });
});
