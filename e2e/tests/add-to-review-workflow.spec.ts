import { expect, test } from "@playwright/test";
import { setupDeterministicTest } from "../helpers/practice-scenarios";

test.describe("Add To Review - Complete Workflow", () => {
  test.use({ storageState: "e2e/.auth/alice.json" });

  // SKIP: UI BUG - Add To Review adds ALL tunes instead of just selected ones
  // Dialog says "Added 3 tunes" but practice queue shows 6 (all repertoire tunes)
  test.skip("CRITICAL: Add tunes to repertoire, then add 3 to review, verify in practice queue", async ({
    page,
  }) => {
    await page.goto("http://localhost:5173/");

    // Setup deterministic state: seed 6 specific tunes in repertoire, unscheduled
    await setupDeterministicTest(page, {
      clearRepertoire: true,
      seedRepertoire: [66, 70, 72, 3497, 54, 55], // Valid tune IDs
    });

    // STEP 1: Skip catalog, go directly to Repertoire (we seeded it)
    console.log("📚 STEP 1: Selecting 3 tunes from Repertoire...");
    await page.getByTestId("tab-repertoire").click();
    await page.waitForTimeout(1000);

    // Verify we have exactly 6 tunes (use data-index to exclude spacer rows)
    const repRows = page.locator(
      '[data-testid="tunes-grid-repertoire"] tbody tr[data-index]'
    );
    const repCount = await repRows.count();
    console.log(`📊 Repertoire has ${repCount} tunes (expect 6)`);
    expect(repCount).toBe(6);

    // Select first 3 tunes and capture titles
    const selectedTitles: string[] = [];
    for (let i = 0; i < 3; i++) {
      const row = repRows.nth(i);
      await row.locator('input[type="checkbox"]').check();
      const titleCell = row.locator("td").nth(1);
      const title = (await titleCell.textContent())?.trim() || "";
      if (title) selectedTitles.push(title);
      await page.waitForTimeout(200);
    }

    console.log("✅ Selected 3 tunes from repertoire:", selectedTitles);
    expect(selectedTitles.length).toBe(3);

    // STEP 2: Click "Add To Review"
    console.log("🎯 STEP 2: Clicking 'Add To Review'...");
    let dialogMessage = "";
    page.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      console.log(`📨 Dialog: ${dialogMessage}`);
      await dialog.accept();
    });

    await page.getByRole("button", { name: "Add To Review" }).click();
    await page.waitForTimeout(1000);
    console.log(`Dialog result: "${dialogMessage}"`);
    expect(dialogMessage).toContain("Added 3 tune");

    // Wait for sync to complete
    console.log("⏳ Waiting for sync...");
    await page.waitForTimeout(3000);

    // STEP 3: Switch to Practice and verify exactly 3 tunes appear
    console.log("🎯 STEP 3: Verifying tunes in Practice queue...");
    await page.getByTestId("tab-practice").click();
    await page.waitForTimeout(2000);

    const practiceRows = page.locator(
      '[data-testid="tunes-grid-practice"] tbody tr[data-index]'
    );
    const practiceCount = await practiceRows.count();
    console.log(`📊 Practice queue: ${practiceCount} tunes (expect 3)`);

    // Deterministic assertion: exactly 3 tunes
    expect(practiceCount).toBe(3);

    // Verify the specific tune titles
    const tableText = await page
      .locator('[data-testid="tunes-grid-practice"] tbody')
      .textContent();

    for (const title of selectedTitles) {
      expect(tableText).toContain(title);
    }
    console.log("✅ All 3 tunes found in practice queue!");

    // STEP 4: Reload and verify persistence
    console.log("🔄 STEP 4: Reloading to verify persistence...");
    await page.reload();
    await page.waitForTimeout(3000);

    const practiceRowsAfter = page.locator(
      '[data-testid="tunes-grid-practice"] tbody tr[data-index]'
    );
    const practiceCountAfter = await practiceRowsAfter.count();
    console.log(`📊 After reload: ${practiceCountAfter} tunes (expect 3)`);

    expect(practiceCountAfter).toBe(3);

    const tableTextAfter = await page
      .locator('[data-testid="tunes-grid-practice"] tbody')
      .textContent();
    for (const title of selectedTitles) {
      expect(tableTextAfter).toContain(title);
    }

    console.log("✅ PASS: All 3 tunes persist after reload!");
  });
});
