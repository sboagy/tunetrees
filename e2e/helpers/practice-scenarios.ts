/**
 * Practice Queue Test Scenarios
 *
 * Helper functions to set up specific practice queue states for E2E testing.
 * Uses direct Supabase calls to manipulate database state before tests run.
 */

import type { Page } from "@playwright/test";

// ============================================================================
// LEGACY ALICE-SPECIFIC FUNCTIONS (DEPRECATED)
// All new tests should use the parallel-safe functions below
// ============================================================================

/**
 * Fast local seeding via browser Test API (preferred for E2E)
 *
 * This avoids slow remote DB resets by writing directly to the app's
 * local SQLite (sql.js) database and regenerating the daily queue.
 */
export async function seedAddToReviewLocally(
  page: Page,
  opts: { playlistId: number; tuneIds: number[]; userIdInt?: number }
) {
  return await page.evaluate(async (input) => {
    if (!(window as any).__ttTestApi) {
      throw new Error("__ttTestApi not attached on window");
    }
    return await (window as any).__ttTestApi.seedAddToReview(input);
  }, opts);
}

/**
 * Read the current practice queue size (latest snapshot) from inside the app.
 */
export async function getPracticeCountLocally(page: Page, playlistId: number) {
  return await page.evaluate(async (pid) => {
    if (!(window as any).__ttTestApi) {
      throw new Error("__ttTestApi not attached on window");
    }
    return await (window as any).__ttTestApi.getPracticeCount(pid);
  }, playlistId);
}

/**
 * Clear local IndexedDB cache to force fresh sync from Supabase
 * This ensures tests start with a clean slate matching Supabase state
 */
export async function clearTunetreesStorageDB(page: Page) {
  await page.evaluate(async () => {
    const dbName = "tunetrees-storage";
    await new Promise<void>((resolve, reject) => {
      const maxAttempts = 5;
      let attempt = 0;

      function tryDelete() {
        attempt++;
        const req = indexedDB.deleteDatabase(dbName);

        req.onsuccess = () => resolve();

        req.onerror = () => {
          if (attempt < maxAttempts) {
            const delay = 200 * attempt; // backoff: 200ms, 400ms, ...
            // eslint-disable-next-line no-console
            console.warn(
              `IndexedDB delete error, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`,
              req.error
            );
            setTimeout(tryDelete, delay);
          } else {
            reject(req.error);
          }
        };

        req.onblocked = () => {
          if (attempt < maxAttempts) {
            const delay = 500 * attempt; // longer wait for blocked case
            // eslint-disable-next-line no-console
            console.warn(
              `IndexedDB delete blocked, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`
            );
            setTimeout(tryDelete, delay);
          } else {
            // eslint-disable-next-line no-console
            console.error("IndexedDB delete blocked after retries");
            reject(new Error("IndexedDB delete blocked"));
          }
        };
      }

      tryDelete();
    });
    console.log("✅ Cleared local IndexedDB cache");

    // Clear app caches (but preserve auth state for parallel workers)

    // 1) Clear sessionStorage only (non-persistent storage)
    try {
      sessionStorage.clear();
      console.log("✅ Cleared sessionStorage");
    } catch (err) {
      console.warn("Failed to clear sessionStorage:", err);
    }

    // 2) Clear CacheStorage (service-worker / workbox caches for app code)
    if (typeof caches !== "undefined") {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((n) => caches.delete(n)));
        console.log("✅ Cleared CacheStorage caches:", cacheNames);
      } catch (err) {
        console.warn("Failed to clear CacheStorage:", err);
      }
    }

    // 3) Clear any in-memory test hooks the app may have exposed
    try {
      if ((window as any).__ttTestApi) {
        if (typeof (window as any).__ttTestApi.dispose === "function") {
          try {
            await (window as any).__ttTestApi.dispose();
          } catch {
            /* ignore disposal errors */
          }
        }
        delete (window as any).__ttTestApi;
      }

      // If app exposes other global caches, try clearing a few common ones
      if ((window as any).__tunetreesCache) {
        try {
          (window as any).__tunetreesCache = null;
          delete (window as any).__tunetreesCache;
        } catch {
          /* ignore */
        }
      }

      console.log("✅ Cleared in-memory globals/test hooks");
    } catch (err) {
      console.warn("Failed to clear in-memory globals:", err);
    }

    // Return so page.evaluate resolves
    return;
  });
}

/**
 * Wait for SyncEngine to complete initial sync after page reload
 * Sets up listener, then caller should reload, then wait completes
 */
async function waitForSyncComplete(
  page: Page,
  timeoutMs = 15000
): Promise<void> {
  const startTime = Date.now();

  // Poll for sync completion by checking console messages
  while (Date.now() - startTime < timeoutMs) {
    // Check if sync has completed by looking at browser state
    const syncComplete = await page.evaluate(() => {
      // Check if window has our test API and sync is done
      if ((window as any).__ttTestApi) {
        return true; // If test API is attached, basic init is done
      }
      return false;
    });

    if (syncComplete) {
      console.log("✅ Sync complete detected (test API ready)");
      // Give it a tiny bit more time to ensure data is in IndexedDB
      await page.waitForTimeout(500);
      return;
    }

    await page.waitForTimeout(100);
  }

  // Timeout - but don't fail, just warn
  console.warn(
    `⚠️  Sync detection timeout (${timeoutMs}ms) - continuing anyway`
  );
}

// ============================================================================
// PARALLEL-SAFE SETUP FUNCTIONS (support multiple test users)
// ============================================================================

import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { getTestUserClient, type TestUser } from "./test-users";

/**
 * Parallel-safe version of setupDeterministicTest
 * Sets up a deterministic test state for a specific user
 */
export async function setupDeterministicTestParallel(
  page: Page,
  user: TestUser,
  opts: {
    clearRepertoire?: boolean;
    seedRepertoire?: number[];
    scheduleTunes?: { tuneIds: number[]; daysAgo: number };
  } = {}
) {
  console.log(`🔧 [${user.name}] Setting up deterministic test state...`);

  // Step 0: Navigate to page if not already (needed for IndexedDB access)
  const currentUrl = page.url();
  if (
    !currentUrl ||
    currentUrl === "about:blank" ||
    currentUrl.startsWith("data:")
  ) {
    await page.goto("http://localhost:5173/");
    await page.waitForTimeout(1000);
  }

  // Step 1: Clear user's state
  if (opts.clearRepertoire) {
    await clearUserRepertoire(user);
  }
  await clearUserTable(user, "daily_practice_queue");
  await clearUserTable(user, "practice_record");

  // Step 2: Seed user's repertoire if specified
  if (opts.seedRepertoire && opts.seedRepertoire.length > 0) {
    await seedUserRepertoire(user, opts.seedRepertoire);
  }

  // Step 3: Schedule tunes if specified
  if (opts.scheduleTunes) {
    const userKey = user.email.split(".")[0]; // alice.test@... → alice
    const { supabase } = await getTestUserClient(userKey);

    const daysAgo = opts.scheduleTunes.daysAgo;
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - daysAgo);
    const scheduledDateStr = pastDate.toISOString();

    for (const tuneId of opts.scheduleTunes.tuneIds) {
      const { error } = await supabase
        .from("playlist_tune")
        .update({ scheduled: scheduledDateStr })
        .eq("playlist_ref", user.playlistId)
        .eq("tune_ref", tuneId);

      if (error) {
        throw new Error(`Failed to schedule tune ${tuneId}: ${error.message}`);
      }
    }
  }

  // Step 4: Clear local cache
  await clearTunetreesStorageDB(page);

  // Step 5: Reload page to trigger fresh sync
  await page.reload();
  await page.waitForTimeout(3000); // Wait for sync to complete

  console.log(`✅ [${user.name}] Deterministic test state ready`);
}

/**
 * Clear repertoire for a specific test user (parallel-safe)
 */
export async function clearUserRepertoire(user: TestUser) {
  const userKey = user.email.split(".")[0]; // alice.test@... → alice
  const { supabase } = await getTestUserClient(userKey);

  const { data: before, error: readError } = await supabase
    .from("playlist_tune")
    .select("tune_ref")
    .eq("playlist_ref", user.playlistId);

  if (readError) {
    throw new Error(`Failed to read repertoire: ${readError.message}`);
  }
  console.log(
    `🗑️  [${user.name}] Deleting ${before?.length || 0} tunes from repertoire`
  );

  const { error } = await supabase
    .from("playlist_tune")
    .delete()
    .eq("playlist_ref", user.playlistId);

  if (error) {
    throw new Error(`Failed to clear repertoire: ${error.message}`);
  }

  // Verify it's actually cleared
  const timeoutMs = 15000;
  const retryDelayMs = 500;
  const start = Date.now();
  let finalCount: number | null = null;

  while (Date.now() - start < timeoutMs) {
    const { count, error: countError } = await supabase
      .from("playlist_tune")
      .select("tune_ref", { count: "exact", head: true })
      .eq("playlist_ref", user.playlistId);

    if (countError) {
      console.warn(
        `[${user.name}] Transient error reading playlist_tune count, retrying:`,
        countError.message
      );
    } else {
      finalCount = count ?? null;
      if (finalCount === null) {
        throw new Error(
          `Failed to verify deletion: Supabase returned null count for playlist_tune`
        );
      }
      if (finalCount === 0) break;
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }

  if (finalCount === null || finalCount > 0) {
    throw new Error(
      `Failed to clear playlist_tune: expected 0 rows, last known count: ${finalCount}`
    );
  }

  console.log(`✅ [${user.name}] Cleared repertoire (0 remaining)`);
}

/**
 * Seed repertoire for a specific test user (parallel-safe)
 */
export async function seedUserRepertoire(user: TestUser, tuneIds: number[]) {
  const userKey = user.email.split(".")[0]; // alice.test@... → alice
  const { supabase } = await getTestUserClient(userKey);

  // Verify playlist_tune is empty before seeding
  {
    const timeoutMs = 16000;
    const retryDelayMs = 1000;
    const start = Date.now();
    let finalCount: number | null = null;

    while (Date.now() - start < timeoutMs) {
      const { count, error } = await supabase
        .from("playlist_tune")
        .select("tune_ref", { count: "exact", head: true })
        .eq("playlist_ref", user.playlistId);

      if (error) {
        console.warn(
          `[${user.name}] Transient error querying playlist_tune, retrying:`,
          error.message
        );
      } else {
        finalCount = count ?? 0;
        if (finalCount === 0) break;
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }

    if (finalCount === null) {
      const { count, error } = await supabase
        .from("playlist_tune")
        .select("tune_ref", { count: "exact", head: true })
        .eq("playlist_ref", user.playlistId);

      if (error) {
        throw new Error(
          `Failed to query playlist_tune after retries: ${error.message}`
        );
      }
      finalCount = count ?? 0;
    }

    if (finalCount > 0) {
      const { data: debugRows } = await supabase
        .from("playlist_tune")
        .select("*")
        .eq("playlist_ref", user.playlistId);
      console.error(
        `❌ [${user.name}] SEED PRE-CHECK FAILED: Found ${finalCount} rows:`,
        JSON.stringify(debugRows, null, 2)
      );

      throw new Error(
        `Refusing to seed repertoire: playlist_tune contains ${finalCount} row(s). Clear repertoire before seeding.`
      );
    }
  }

  const maxAttempts = 5;
  for (const tuneId of tuneIds) {
    let attempt = 0;
    while (true) {
      attempt++;
      const { error } = await supabase
        .from("playlist_tune")
        .upsert({
          playlist_ref: user.playlistId,
          tune_ref: tuneId,
          current: null,
          learned: null,
          scheduled: null,
          goal: "recall",
          deleted: false,
          sync_version: 1,
          last_modified_at: new Date().toISOString(),
          device_id: "test-seed",
        })
        .eq("playlist_ref", user.playlistId)
        .eq("tune_ref", tuneId);

      if (!error) break;

      if (attempt >= maxAttempts) {
        throw new Error(
          `Failed to seed tune ${tuneId} after ${attempt} attempts: ${error.message}`
        );
      }

      const backoffMs = Math.min(1000 * 2 ** (attempt - 1), 5000);
      const jitter = Math.floor(Math.random() * 200);
      const delay = backoffMs + jitter;

      console.warn(
        `[${user.name}] Transient error seeding tune ${tuneId} (attempt ${attempt}/${maxAttempts}): ${error.message}. Retrying in ${delay}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Verify rows reached expected count
  {
    const timeoutMs: number = 8000;
    const retryDelayMs: number = 500;
    const start = Date.now();
    let matched = false;

    while (Date.now() - start < timeoutMs) {
      const { count, error } = await supabase
        .from("playlist_tune")
        .select("*", { count: "exact", head: true })
        .eq("playlist_ref", user.playlistId)
        .in("tune_ref", tuneIds);

      if (error) {
        console.warn(
          `[${user.name}] Transient error reading playlist_tune count, retrying:`,
          error.message
        );
      } else {
        const currentCount = count ?? 0;
        if (currentCount === tuneIds.length) {
          matched = true;
          break;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }

    if (!matched) {
      console.warn(
        `⚠️ [${user.name}] Timed out waiting for playlist_tune to contain ${tuneIds.length} rows`
      );
    }
  }

  console.log(`✅ [${user.name}] Seeded ${tuneIds.length} tunes in repertoire`);
}

function applyTableQueryFilters(
  tableName: string,
  query: PostgrestFilterBuilder<any, any, any, null, string, unknown, "DELETE">,
  user: TestUser
) {
  if (tableName === "daily_practice_queue") {
    // Belt-and-suspenders: filter by both playlist and user for safety
    query = query
      .eq("playlist_ref", user.playlistId)
      .eq("user_ref", user.userId);
  } else if (tableName === "practice_record") {
    // practice_record is keyed by playlist_ref
    query = query.eq("playlist_ref", user.playlistId);
  } else if (tableName === "table_transient_data") {
    query = query.eq("user_id", user.userId);
  } else {
    query = query.eq("user_ref", user.userId);
  }
  return query;
}

/**
 * Clear a Supabase table for a specific user (parallel-safe)
 */
async function clearUserTable(user: TestUser, tableName: string) {
  const userKey = user.email.split(".")[0]; // alice.test@... → alice
  const { supabase } = await getTestUserClient(userKey);

  let query = supabase.from(tableName).delete();

  query = applyTableQueryFilters(tableName, query, user);

  const { error } = await query;

  if (error && !error.message.includes("no rows")) {
    console.error(`[${user.name}] Failed to clear ${tableName}:`, error);
  } else {
    console.log(`✅ [${user.name}] Cleared ${tableName}`);
  }
  // Verify table is empty (polling)
  {
    const timeoutMs = 8000;
    const retryDelayMs = 500;
    const start = Date.now();
    let finalCount: number | null = null;

    while (Date.now() - start < timeoutMs) {
      // Build count query with same safety filters as the delete above
      let countQuery = supabase.from(tableName).select("*", {
        count: "exact",
        head: true,
      }) as any;

      countQuery = applyTableQueryFilters(tableName, countQuery, user);

      const { count, error: countError } = await countQuery;

      if (countError) {
        console.warn(
          `[${user.name}] Transient error reading ${tableName} count, retrying:`,
          countError.message
        );
      } else {
        finalCount = count ?? 0;
        if (finalCount === 0) {
          break;
        }
        console.log(
          `[${user.name}] Waiting for ${tableName} to drain: ${finalCount} remaining`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }

    // Final verification
    if (finalCount === null) {
      // Try one final time to get an authoritative count
      let finalQuery = supabase.from(tableName).select("*", {
        count: "exact",
        head: true,
      }) as any;

      finalQuery = applyTableQueryFilters(tableName, finalQuery, user);

      const { count: finalCountRead, error: finalReadError } = await finalQuery;
      if (finalReadError) {
        throw new Error(
          `[${user.name}] Failed to verify ${tableName} deletion after retries: ${finalReadError.message}`
        );
      }
      finalCount = finalCountRead ?? 0;
    }

    if (finalCount == null || finalCount > 0) {
      throw new Error(
        `[${user.name}] Failed to clear ${tableName}: expected 0 rows, last known count: ${finalCount}`
      );
    }

    console.log(`✅ [${user.name}] Verified ${tableName} is empty`);
  }
}

/**
 * PARALLEL-SAFE PRACTICE SETUP
 * Works with any test user - safe for parallel execution
 */
export async function setupForPracticeTestsParallel(
  page: Page,
  user: TestUser,
  opts?: {
    repertoireTunes?: number[];
    startTab?: "practice" | "repertoire" | "catalog";
  }
) {
  const { repertoireTunes = [9001, 3497], startTab = "practice" } = opts ?? {};

  console.log(`🔧 [${user.name}] setupForPracticeTests Starting...`);

  // 1. Clear practice-specific tables
  await clearUserTable(user, "practice_record");
  await clearUserTable(user, "daily_practice_queue");
  await clearUserTable(user, "table_transient_data");
  await clearUserTable(user, "tune_override");

  // 2. Reset repertoire
  await clearUserRepertoire(user);
  if (repertoireTunes.length > 0) {
    await seedUserRepertoire(user, repertoireTunes);
  }

  // 3. Navigate if needed
  const currentUrl = page.url();
  if (
    !currentUrl ||
    currentUrl === "about:blank" ||
    currentUrl.startsWith("data:")
  ) {
    await page.goto("http://localhost:5173/");
    await page.waitForTimeout(1000);
  }

  // 4. Clear IndexedDB cache
  await clearTunetreesStorageDB(page);

  // 5. Reload to trigger fresh sync
  await page.reload();
  await page.waitForTimeout(5000);

  // 6. Navigate to starting tab
  await page.waitForSelector(`[data-testid="tab-${startTab}"]`, {
    timeout: 10000,
  });
  await page.getByTestId(`tab-${startTab}`).click();
  await page.waitForTimeout(500);

  console.log(
    `✅ [${user.name}] setupForPracticeTests Ready with ${repertoireTunes.length} tunes`
  );
}

/**
 * PARALLEL-SAFE REPERTOIRE SETUP
 * Works with any test user - safe for parallel execution
 */
export async function setupForRepertoireTestsParallel(
  page: Page,
  user: TestUser,
  opts: {
    repertoireTunes: number[];
    scheduleTunes?: boolean;
    scheduleDaysAgo?: number;
  }
) {
  const { repertoireTunes, scheduleTunes = false, scheduleDaysAgo = 0 } = opts;

  console.log(`🔧 [${user.name}] setupForRepertoireTests Starting...`);

  // 1. Clear practice state
  await clearUserTable(user, "practice_record");
  await clearUserTable(user, "daily_practice_queue");
  await clearUserTable(user, "table_transient_data");
  await clearUserTable(user, "tune_override");

  // 2. Reset repertoire
  await clearUserRepertoire(user);
  await seedUserRepertoire(user, repertoireTunes);

  // 3. Optionally schedule tunes
  if (scheduleTunes) {
    const userKey = user.email.split(".")[0]; // alice.test@... → alice
    const { supabase } = await getTestUserClient(userKey);
    const scheduleDate = new Date();
    scheduleDate.setDate(scheduleDate.getDate() - scheduleDaysAgo);
    const scheduleDateStr = scheduleDate.toISOString();

    for (const tuneId of repertoireTunes) {
      const { error } = await supabase
        .from("playlist_tune")
        .update({ scheduled: scheduleDateStr })
        .eq("tune_ref", tuneId)
        .eq("playlist_ref", user.playlistId);

      if (error) {
        console.error(
          `[${user.name}] Failed to update scheduled date for tune ${tuneId}:`,
          error
        );
      }
    }
  }

  // 4. Navigate if needed
  const currentUrl = page.url();
  if (
    !currentUrl ||
    currentUrl === "about:blank" ||
    currentUrl.startsWith("data:")
  ) {
    await page.goto("http://localhost:5173/");
    await page.waitForTimeout(1000);
  }

  // 5. Clear IndexedDB cache
  await clearTunetreesStorageDB(page);

  // 6. Reload to trigger fresh sync
  await page.reload();
  await page.waitForTimeout(5000);

  // 7. Navigate to repertoire tab
  await page.waitForSelector('[data-testid="tab-repertoire"]', {
    timeout: 20000,
  });
  await page.getByTestId("tab-repertoire").click();
  await page.waitForTimeout(1000);

  console.log(
    `✅ [${user.name}] setupForRepertoireTests Ready with ${
      repertoireTunes.length
    } tunes ${scheduleTunes ? "(scheduled)" : "(unscheduled)"}`
  );
}

/**
 * PARALLEL-SAFE CATALOG SETUP
 * Works with any test user - safe for parallel execution
 */
export async function setupForCatalogTestsParallel(
  page: Page,
  user: TestUser,
  opts?: {
    emptyRepertoire?: boolean;
    startTab?: "practice" | "repertoire" | "catalog";
  }
) {
  const { emptyRepertoire = true, startTab = "catalog" } = opts ?? {};

  console.log(`🔧 [${user.name}] setupForCatalogTests Starting...`);

  // 1. Clear only user's repertoire (keep catalog!)
  if (emptyRepertoire) {
    await clearUserRepertoire(user);
  }

  // 2. Clear practice state
  await clearUserTable(user, "practice_record");
  await clearUserTable(user, "daily_practice_queue");
  await clearUserTable(user, "table_transient_data");
  await clearUserTable(user, "tune_override");

  // 3. Navigate to ensure valid origin
  const currentUrl = page.url();
  if (
    !currentUrl ||
    currentUrl === "about:blank" ||
    currentUrl.startsWith("data:")
  ) {
    await page.goto("http://localhost:5173/", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(1000);
    await waitForSyncComplete(page);
  }

  // 4. Clear ONLY IndexedDB cache (keep auth in localStorage!)
  await clearTunetreesStorageDB(page);
  await page.waitForTimeout(2000);

  // 5. Reload to trigger fresh sync from Supabase
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForSyncComplete(page);

  const playlistLocator = page.getByTestId("playlist-dropdown-button");

  // wait for the playlist dropdown to be visible
  await playlistLocator.waitFor({ state: "visible", timeout: 10000 });
  const playlistDropdownButton = page.getByTestId("playlist-dropdown-button");
  // Playlist name is computed as "Irish Flute (playlistId)" when name column is NULL
  const expectedTitle = `Irish Flute (${user.playlistId})`;
  const timeoutMs = 20000;
  const start = Date.now();
  let innerText = "";

  // Poll until the playlist dropdown title matches expectedTitle or timeout
  while (Date.now() - start < timeoutMs) {
    try {
      innerText = await playlistDropdownButton.innerText({ timeout: 1000 });
    } catch {
      innerText = "";
    }

    innerText = innerText.trim();
    if (innerText === expectedTitle) {
      console.log(`✅ [${user.name}] Playlist title matched: ${innerText}`);
      break;
    }

    await page.waitForTimeout(200);
  }

  if (innerText !== expectedTitle) {
    console.error(
      `⚠️ [${user.name}] playlist menu title did not match within ${timeoutMs}ms, last value: ${innerText}`
    );
    throw new Error(
      `Playlist dropdown title did not match expected value within ${timeoutMs}ms. Expected "${expectedTitle}", last value: "${innerText}"`
    );
  }

  // 6. Navigate to starting tab
  await page.waitForSelector(`[data-testid="tab-${startTab}"]`, {
    timeout: 10000,
  });
  await page.getByTestId(`tab-${startTab}`).click();
  await page.waitForTimeout(500);

  const catalogAddToRepertoireButton = page.getByTestId(
    "catalog-add-to-repertoire-button"
  );
  await catalogAddToRepertoireButton.waitFor({
    state: "visible",
    timeout: 10000,
  });

  // Wait for tune count to be visible (any number of tunes)
  const tuneCountComponent = page
    .locator("div")
    .filter({ hasText: /^\d+ tunes?$/ })
    .first();

  await page.waitForTimeout(2000);

  const isVisible = await tuneCountComponent.isVisible();
  if (!isVisible) {
    const snapshotName = `e2e/tests/artifacts/catalog-missing-${
      user.email.split(".")[0]
    }-${Date.now()}.png`;
    try {
      await page.screenshot({ path: snapshotName, fullPage: true });
      console.error(`📸 Snapshot saved: ${snapshotName}`);
    } catch (err) {
      console.warn("⚠️ Failed to save snapshot:", String(err));
    }
    throw new Error(
      `Tune count component not visible; snapshot saved as ${snapshotName}`
    );
  }

  // await tuneCountComponent.waitFor({
  //   state: "visible",
  //   timeout: 10000,
  // });

  await page.waitForTimeout(500);

  console.log(
    `✅ [${user.name}] setupForCatalogTests Ready on ${startTab} tab`
  );
}
