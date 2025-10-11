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

  // Wait for auth state to settle
  await page.waitForTimeout(3000);
}

test("debug genre and tune data structure", async ({ page }) => {
  // Enable console logging
  page.on("console", (msg) => {
    console.log(`📊 Console [${msg.type()}]:`, msg.text());
  });

  // Login first
  await loginUser(page);

  // Navigate to catalog to trigger data loading
  await page.goto("/?tab=catalog");

  // Wait for data to load
  await page.waitForTimeout(8000);

  console.log("=== INSPECTING GENRE AND TUNE DATA ===");

  // Inject script to examine the actual data in the browser
  const genreDataResult = await page.evaluate(() => {
    // Try to access the genre data from the app's memory
    // Look for stored data in window, database, or components

    // Check if we can access IndexedDB data
    return new Promise((resolve) => {
      const request = indexedDB.open("tunetrees-db", 3);
      request.onsuccess = (event: any) => {
        const db = event.target?.result;
        if (!db) {
          resolve({ error: "No database found" });
          return;
        }

        // Read genre table
        const genreTransaction = db.transaction(["genre"], "readonly");
        const genreStore = genreTransaction.objectStore("genre");
        const genreRequest = genreStore.getAll();

        genreRequest.onsuccess = () => {
          const genres = genreRequest.result;
          console.log("📊 Found genres in IndexedDB:", genres.length);

          // Also get some tunes
          const tuneTransaction = db.transaction(["tune"], "readonly");
          const tuneStore = tuneTransaction.objectStore("tune");
          const tuneRequest = tuneStore.getAll();

          tuneRequest.onsuccess = () => {
            const tunes = tuneRequest.result;
            console.log("📊 Found tunes in IndexedDB:", tunes.length);

            resolve({
              genres: genres.slice(0, 5), // First 5 genres
              tunes: tunes.slice(0, 5).map((t: any) => ({
                id: t.id,
                title: t.title,
                genre: t.genre,
                type: t.type,
                mode: t.mode,
              })), // First 5 tunes with relevant fields
            });
          };
        };
      };

      request.onerror = () => {
        resolve({ error: "Could not access IndexedDB" });
      };
    });
  });

  console.log("📊 Genre and Tune Data from IndexedDB:");
  console.log(JSON.stringify(genreDataResult, null, 2));
});
