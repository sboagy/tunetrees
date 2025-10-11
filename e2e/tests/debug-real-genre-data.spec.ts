import { test } from "@playwright/test";

// Helper to login first
async function loginUser(page: any) {
  const testUsername =
    process.env.TUNETREES_TEST_USERNAME || "sboagy@gmail.com";
  const testPassword =
    process.env.TUNETREES_TEST_PASSWORD || "serf.pincers3BITTERS";

  await page.goto("/login");
  await page.locator('input[type="email"]').fill(testUsername);
  await page.locator('input[type="password"]').fill(testPassword);
  await page.locator('button:has-text("Sign In")').click();
  await page.waitForTimeout(3000);
}

test("debug actual genre data in real app", async ({ page }) => {
  console.log("=== DEBUGGING REAL GENRE DATA ===");

  // Enable console logging
  page.on("console", (msg) => {
    if (
      msg.text().includes("🔍") ||
      msg.text().includes("CombinedFilterDropdown") ||
      msg.text().includes("genre")
    ) {
      console.log(`Console: ${msg.text()}`);
    }
  });

  // Login and navigate
  await loginUser(page);
  await page.goto("/?tab=catalog");

  // Wait for data to load and sync to complete
  await page.waitForTimeout(8000);

  console.log("Current URL:", page.url());

  // First, let's see what's in the database using a simple query
  const dbCheck = await page.evaluate(() => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("tunetrees-db", 3);
      const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);

      request.onsuccess = (event: any) => {
        clearTimeout(timeout);
        const db = event.target?.result;
        if (!db) {
          resolve({ error: "No database" });
          return;
        }

        try {
          // Quick genre count
          const genreTransaction = db.transaction(["genre"], "readonly");
          const genreStore = genreTransaction.objectStore("genre");
          const genreCountReq = genreStore.count();

          genreCountReq.onsuccess = () => {
            // Quick tune count
            const tuneTransaction = db.transaction(["tune"], "readonly");
            const tuneStore = tuneTransaction.objectStore("tune");
            const tuneCountReq = tuneStore.count();

            tuneCountReq.onsuccess = () => {
              resolve({
                genreCount: genreCountReq.result,
                tuneCount: tuneCountReq.result,
              });
            };
          };
        } catch (err) {
          resolve({ error: String(err) });
        }
      };

      request.onerror = () => {
        clearTimeout(timeout);
        resolve({ error: "IndexedDB error" });
      };
    });
  });

  console.log("📊 Quick DB Check:", dbCheck);

  // Now try to click the filter button
  try {
    const filterButton = page.locator('[data-testid="combined-filter-button"]');

    // Wait for button to be visible
    await filterButton.waitFor({ state: "visible", timeout: 10000 });
    console.log("✅ Filter button found and visible");

    // Click it
    await filterButton.click();
    console.log("✅ Filter button clicked");

    // Wait a moment for dropdown to appear
    await page.waitForTimeout(2000);

    // Take screenshot with dropdown open
    await page.screenshot({
      path: "test-results/real-genre-debug-with-dropdown.png",
      fullPage: true,
    });
    console.log("✅ Screenshot taken");

    // Check if dropdown is open by looking for the dropdown element
    const dropdown = page.locator('[data-testid="combined-filter-dropdown"]');
    const dropdownVisible = await dropdown.isVisible();
    console.log(`Dropdown visible: ${dropdownVisible}`);

    if (dropdownVisible) {
      // Look for genre section specifically
      const genreText = await page.locator('text="Genre"').count();
      const noGenresText = await page
        .locator('text="No genres available"')
        .count();

      console.log(`Genre section found: ${genreText > 0}`);
      console.log(`"No genres available" text found: ${noGenresText > 0}`);

      // Get all text in the dropdown to see what's actually there
      const dropdownText = await dropdown.textContent();
      console.log("Dropdown content preview:", dropdownText?.substring(0, 200));
    }
  } catch (error) {
    console.log("❌ Error interacting with filter:", error);
    await page.screenshot({
      path: "test-results/real-genre-debug-error.png",
      fullPage: true,
    });
  }

  console.log("=== REAL GENRE DEBUG COMPLETE ===");
});
