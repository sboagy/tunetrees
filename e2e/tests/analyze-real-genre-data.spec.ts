import { expect, test } from "@playwright/test";

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

test("analyze real production genre data after supabase sync", async ({
  page,
}) => {
  console.log("=== ANALYZING REAL PRODUCTION GENRE DATA ===");

  // Enable console logging
  page.on("console", (msg) => {
    console.log(`Console: ${msg.text()}`);
  });

  // Login first
  await loginUser(page);
  await page.goto("/?tab=catalog");
  await page.waitForTimeout(8000); // Wait for sync to complete

  console.log("✅ Logged in and waiting for Supabase sync...");

  // Wait for sync and analyze the actual SQLite WASM data
  const realDbData = await page.evaluate(async () => {
    console.log("🔄 Accessing SQLite WASM after sync...");

    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
      try {
        // Access the database through the global window object that should be set by the app
        const authContext = (window as any).__auth_context__;
        if (!authContext || !authContext.localDb) {
          throw new Error("Auth context or localDb not available");
        }

        const db = authContext.localDb;

        // We need to access the data through direct SQL since we can't import schema
        // Query genres table
        const genresResult = db.exec(
          "SELECT id, name FROM genre ORDER BY name"
        );
        const tunesResult = db.exec(
          "SELECT id, title, genre FROM tune LIMIT 100"
        );

        const allGenres =
          genresResult[0]?.values?.map((row: any) => ({
            id: row[0],
            name: row[1],
          })) || [];

        const sampleTunes =
          tunesResult[0]?.values?.map((row: any) => ({
            id: row[0],
            title: row[1],
            genre: row[2],
          })) || [];

        console.log(
          `📊 Found ${allGenres.length} genres, ${sampleTunes.length} sample tunes`
        );

        if (allGenres.length > 0) {
          // Get unique genre values from sample tunes
          const uniqueGenreValues = [
            ...new Set(
              sampleTunes
                .map((t: any) => t.genre)
                .filter((g: any) => g !== null && g !== undefined && g !== "")
            ),
          ];

          console.log("🎯 All genres from genre table:", allGenres);
          console.log(
            "🎵 Sample tune genre values:",
            sampleTunes.slice(0, 10).map((t: any) => `"${t.genre}"`)
          );
          console.log(
            "📋 Unique genre values in sample tunes:",
            uniqueGenreValues
          );

          return {
            success: true,
            allGenres: allGenres,
            sampleTunes: sampleTunes.slice(0, 20),
            uniqueGenreValues: uniqueGenreValues,
            totalGenres: allGenres.length,
            totalTunes: sampleTunes.length,
          };
        }
      } catch (err: any) {
        console.log(`❌ Attempt ${attempts + 1} failed:`, err.message);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }

    return { error: "Could not access synced data" };
  });

  console.log("📊 Real Database Analysis:", realDbData);

  // Now test the filter dropdown
  const filterButton = page.locator('button:has-text("Filters")');
  await expect(filterButton).toBeVisible();
  await filterButton.click();
  await page.waitForTimeout(1000);

  const noGenresVisible = await page
    .locator("text=No genres available")
    .isVisible();
  console.log('❌ "No genres available" showing:', noGenresVisible);

  await page.screenshot({ path: "test-results/real-production-analysis.png" });
  console.log("=== ANALYSIS COMPLETE ===");
});
