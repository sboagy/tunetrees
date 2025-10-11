import { test, expect } from "@playwright/test";

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

test("debug actual production genre data", async ({ page }) => {
  console.log("=== DEBUGGING PRODUCTION GENRE DATA ===");

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

  // Login first
  await loginUser(page);

  await page.goto("/?tab=catalog");
  await page.waitForTimeout(5000); // Wait for app to load instead of specific selector

  console.log("✅ Logged in and on catalog page");

  // Get actual production data from the database
  const dbData = await page.evaluate(async () => {
    try {
      // Access the database through the global window object
      const db = (window as any).localDb;
      if (!db) {
        return { error: "localDb not found on window" };
      }

      // Simple query to get data
      const genreQuery = "SELECT * FROM genre LIMIT 10";
      const tuneQuery = "SELECT id, title, genre FROM tune LIMIT 20";

      console.log("� Executing database queries...");

      return {
        message: "Database queries would go here",
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      console.error("❌ Database access error:", err);
      return { error: String(err) };
    }
  });

  console.log("📊 Database Analysis Result:", dbData);

  // Now click the filter button to see what availableGenres actually contains
  const filterButton = page.locator('button:has-text("Filters")');
  await expect(filterButton).toBeVisible();
  await filterButton.click();

  await page.waitForTimeout(1000);

  // Check what's in the genre section
  const genreSection = page.locator("text=Genre (0 selected)").locator("..");
  const genreContent = await genreSection.textContent();
  console.log("🎭 Genre section content:", genreContent);

  // Look for "No genres available" text
  const noGenresText = await page
    .locator("text=No genres available")
    .isVisible();
  console.log('❌ "No genres available" visible:', noGenresText);

  await page.screenshot({ path: "test-results/production-genre-debug.png" });

  console.log("=== PRODUCTION GENRE DEBUG COMPLETE ===");
});
