/**
 * Practice Queue Test Scenarios
 *
 * Helper functions to set up specific practice queue states for E2E testing.
 * Uses direct Supabase calls to manipulate database state before tests run.
 */

import type { Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

/**
 * Practice scenario configurations
 */
export interface PracticeScenario {
  name: string;
  description: string;
  setup: () => Promise<void>;
}

/**
 * Get authenticated Supabase client for Alice
 * Uses Alice's test credentials from environment
 */
let cachedAliceClient: { supabase: SupabaseClient; userId: string } | null =
  null;

/**
 * Force a fresh Supabase client (clears cache)
 * Call this at the start of each setup function to ensure clean state
 */
export function resetAliceClient() {
  cachedAliceClient = null;
}

async function getAliceClient() {
  if (cachedAliceClient) {
    return cachedAliceClient;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "alice.test@tunetrees.test",
    password: process.env.ALICE_TEST_PASSWORD || "TestPassword123!",
  });

  if (error) {
    throw new Error(`Failed to authenticate Alice: ${error.message}`);
  }

  cachedAliceClient = { supabase, userId: data.user.id };
  return cachedAliceClient;
}

/**
 * Reset Alice's playlist_tune scheduled dates to NULL (unscheduled state)
 */
export async function resetScheduledDates() {
  const { supabase } = await getAliceClient();

  const { error } = await supabase
    .from("playlist_tune")
    .update({ scheduled: null })
    .eq("playlist_ref", 9001);

  if (error) {
    throw new Error(`Failed to reset scheduled dates: ${error.message}`);
  }

  console.log("✅ Reset scheduled dates to NULL");
}

/**
 * Delete Alice's active practice queue
 */
export async function deleteActivePracticeQueue() {
  const { supabase } = await getAliceClient();

  const { error } = await supabase
    .from("daily_practice_queue")
    .delete()
    .eq("user_ref", 9001)
    .eq("playlist_ref", 9001);

  if (error) {
    throw new Error(`Failed to delete practice queue: ${error.message}`);
  }

  console.log("✅ Deleted active practice queue");
}

/**
 * Schedule Alice's tunes for practice (sets playlist_tune.current)
 *
 * @param daysAgo - How many days in the past to schedule (0 = today)
 * @param tuneRefs - Specific tune IDs to schedule (defaults to all Alice's tunes)
 */
export async function scheduleTunesForPractice(
  daysAgo: number = 0,
  tuneRefs: number[] = [9001, 9002]
) {
  const { supabase } = await getAliceClient();

  const scheduledDate = new Date();
  scheduledDate.setDate(scheduledDate.getDate() - daysAgo);
  const scheduledStr = scheduledDate.toISOString();

  for (const tuneRef of tuneRefs) {
    const { error } = await supabase
      .from("playlist_tune")
      .update({ scheduled: scheduledStr })
      .eq("playlist_ref", 9001)
      .eq("tune_ref", tuneRef);

    if (error) {
      throw new Error(`Failed to schedule tune ${tuneRef}: ${error.message}`);
    }
  }

  console.log(`✅ Scheduled ${tuneRefs.length} tunes (${daysAgo} days ago)`);
}

/**
 * SCENARIO: Fresh account with unscheduled tunes
 * - Tunes exist in repertoire but not scheduled for practice
 * - Practice queue should be empty
 */
export async function setupFreshAccountScenario() {
  await resetScheduledDates();
  await deleteActivePracticeQueue();
  console.log("📋 Scenario: Fresh Account (unscheduled tunes)");
}

/**
 * SCENARIO: Account with lapsed tunes (overdue for practice)
 * - Tunes scheduled 7 days ago (beyond today but within delinquency window)
 * - Should appear in Q2 (recently lapsed) bucket
 */
export async function setupLapsedTunesScenario() {
  await resetScheduledDates();
  await deleteActivePracticeQueue();
  await scheduleTunesForPractice(7); // 7 days ago
  console.log("📋 Scenario: Lapsed Tunes (7 days overdue)");
}

/**
 * SCENARIO: Account with tunes due today
 * - Tunes scheduled for today
 * - Should appear in Q1 (due today) bucket
 */
export async function setupDueTodayScenario() {
  await resetScheduledDates();
  await deleteActivePracticeQueue();
  await scheduleTunesForPractice(0); // Today
  console.log("📋 Scenario: Tunes Due Today");
}

/**
 * SCENARIO: Mixed - one tune due today, one lapsed
 */
export async function setupMixedScenario() {
  await resetScheduledDates();
  await deleteActivePracticeQueue();
  await scheduleTunesForPractice(0, [9001]); // Tune 9001 due today
  await scheduleTunesForPractice(7, [9002]); // Tune 9002 lapsed 7 days ago
  console.log("📋 Scenario: Mixed (1 due today, 1 lapsed)");
}

/**
 * Available test scenarios
 */
export const PRACTICE_SCENARIOS = {
  freshAccount: setupFreshAccountScenario,
  lapsedTunes: setupLapsedTunesScenario,
  dueToday: setupDueTodayScenario,
  mixed: setupMixedScenario,
} as const;

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
    // Also clear other client-side caches so tests start truly fresh

    // 1) Clear localStorage & sessionStorage (non-HttpOnly)
    try {
      // Optionally clear localStorage if you want to remove client-side auth/state.
      // Be careful: some flows expect auth to remain in localStorage, so keep commented when needed.
      // localStorage.clear();

      sessionStorage.clear();

      // Clear service-worker related CacheStorage entries by common patterns
      if (typeof caches !== "undefined") {
        const pattern =
          /workbox|precache|runtime|vite-pwa|workbox-precache|workbox-runtime/i;
        const cacheNames = await caches.keys();
        const swCaches = cacheNames.filter((n) => pattern.test(n));
        await Promise.all(swCaches.map((n) => caches.delete(n)));
        if (swCaches.length) {
          console.log("✅ Cleared SW CacheStorage caches:", swCaches);
        } else {
          console.log("ℹ️ No SW-specific CacheStorage caches found");
        }
      }

      console.log("✅ Cleared sessionStorage (and selected SW caches)");
    } catch (err) {
      console.warn("Failed to clear local/session storage or SW caches:", err);
    }

    // 2) Clear document cookies (note: HttpOnly cookies cannot be removed from JS)
    try {
      document.cookie
        .split(";")
        .map((c) => c.trim())
        .filter(Boolean)
        .forEach((cookie) => {
          const eq = cookie.indexOf("=");
          const name = eq > -1 ? cookie.slice(0, eq) : cookie;
          // attempt removal for common scopes
          // biome-ignore lint/suspicious/noDocumentCookie: this is just test code, so it's ok
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
          // biome-ignore lint/suspicious/noDocumentCookie: this is just test code, so it's ok
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${location.hostname}`;
        });
      console.log("✅ Cleared document cookies (non-HttpOnly)");
    } catch (err) {
      console.warn("Failed to clear document cookies:", err);
    }

    // 3) Clear CacheStorage (service-worker / workbox caches)
    if (typeof caches !== "undefined") {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((n) => caches.delete(n)));
        console.log("✅ Cleared CacheStorage caches:", cacheNames);
      } catch (err) {
        console.warn("Failed to clear CacheStorage:", err);
      }
    }

    // 4) Unregister service workers so SW-controlled caches/clients are removed
    if (navigator?.serviceWorker) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          regs.map(async (reg) => {
            try {
              await reg.unregister();
            } catch (e) {
              console.warn("Failed to unregister service worker:", e);
            }
          })
        );
        console.log("✅ Unregistered service workers");
      } catch (err) {
        console.warn("Failed to get/unregister service workers:", err);
      }
    }

    // 5) Clear any in-memory test hooks the app may have exposed
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

/**
 * Remove all tunes from Alice's repertoire (playlist_tune table)
 */
export async function clearAliceRepertoire() {
  const { supabase } = await getAliceClient();

  // First, check what's there
  const { data: before, error: readError } = await supabase
    .from("playlist_tune")
    .select("tune_ref")
    .eq("playlist_ref", 9001);

  if (readError) {
    throw new Error(`Failed to read repertoire: ${readError.message}`);
  }
  console.log(`🗑️  Deleting ${before?.length || 0} tunes from repertoire`);

  const { error } = await supabase
    .from("playlist_tune")
    .delete()
    .eq("playlist_ref", 9001);

  if (error) {
    throw new Error(`Failed to clear repertoire: ${error.message}`);
  }

  // Verify it's actually cleared
  // Wait up to 15s for playlist_tune rows to be gone, polling every 500ms
  const timeoutMs = 15000;
  const retryDelayMs = 500;
  const start = Date.now();
  let finalCount: number | null = null;

  while (Date.now() - start < timeoutMs) {
    const { count, error: countError } = await supabase
      .from("playlist_tune")
      .select("tune_ref", { count: "exact", head: true })
      .eq("playlist_ref", 9001);

    if (countError) {
      // transient read error - warn and retry
      // eslint-disable-next-line no-console
      console.warn(
        "Transient error reading playlist_tune count, retrying:",
        countError.message
      );
    } else {
      // Preserve null to detect unexpected null responses from Supabase
      finalCount = count ?? null;
      // If API returned null, fail immediately per test expectation
      if (finalCount === null) {
        throw new Error(
          "Failed to verify deletion: Supabase returned null count for playlist_tune"
        );
      }
      if (finalCount === 0) break;
      // Otherwise finalCount > 0 -> keep retrying until timeout then surface error below
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }

  // After retries, if count is still null or greater than zero, raise an error
  if (finalCount === null || finalCount > 0) {
    throw new Error(
      `Failed to clear playlist_tune: expected 0 rows, last known count: ${finalCount}`
    );
  }

  // Fetch remaining rows (if any) for accurate logging
  const { data: after, error: afterError } = await supabase
    .from("playlist_tune")
    .select("tune_ref")
    .eq("playlist_ref", 9001);

  if (afterError) {
    throw new Error(
      `Failed to read repertoire after delete: ${afterError.message}`
    );
  }

  console.log(
    `✅ Cleared Alice's repertoire (${after?.length || 0} remaining)`
  );
}

/**
 * Seed Alice's repertoire with specific tunes
 */
export async function seedAliceRepertoire(tuneIds: number[]) {
  const { supabase } = await getAliceClient();

  // Verify playlist_tune is empty for Alice's playlist before seeding
  {
    const timeoutMs = 16000;
    const retryDelayMs = 1000;
    const start = Date.now();
    let finalCount: number | null = null;

    while (Date.now() - start < timeoutMs) {
      const { count, error } = await supabase
        .from("playlist_tune")
        .select("tune_ref", { count: "exact", head: true })
        .eq("playlist_ref", 9001);

      if (error) {
        // Transient read error - warn and retry
        // eslint-disable-next-line no-console
        console.warn(
          "Transient error querying playlist_tune, retrying:",
          error.message
        );
      } else {
        finalCount = count ?? 0;
        if (finalCount === 0) break;
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }

    // If we never got a successful read, try one final time and fail on error
    if (finalCount === null) {
      const { count, error } = await supabase
        .from("playlist_tune")
        .select("tune_ref", { count: "exact", head: true })
        .eq("playlist_ref", 9001);

      if (error) {
        throw new Error(
          `Failed to query playlist_tune after retries: ${error.message}`
        );
      }
      finalCount = count ?? 0;
    }

    if (finalCount > 0) {
      // Log actual rows for debugging
      const { data: debugRows } = await supabase
        .from("playlist_tune")
        .select("*")
        .eq("playlist_ref", 9001);
      console.error(
        `❌ SEED PRE-CHECK FAILED: Found ${finalCount} rows:`,
        JSON.stringify(debugRows, null, 2)
      );

      throw new Error(
        `Refusing to seed repertoire: playlist_tune contains ${finalCount} row(s). Clear repertoire before seeding.`
      );
    }
  }

  for (const tuneId of tuneIds) {
    const { error } = await supabase
      .from("playlist_tune")
      .upsert({
        playlist_ref: 9001,
        tune_ref: tuneId,
        current: null, // Not currently practicing
        learned: null, // Not yet learned
        scheduled: null, // Not scheduled for practice
        goal: "recall",
        deleted: false,
        sync_version: 1,
        last_modified_at: new Date().toISOString(),
        device_id: "test-seed",
      })
      .eq("playlist_ref", 9001)
      .eq("tune_ref", tuneId);

    if (error) {
      throw new Error(`Failed to seed tune ${tuneId}: ${error.message}`);
    }
  }

  // Verify rows reached expected count in Supabase (retry loop)
  {
    const timeoutMs: number = 8000;
    const retryDelayMs: number = 500;
    const start = Date.now();
    let matched = false;

    while (Date.now() - start < timeoutMs) {
      const { count, error } = await supabase
        .from("playlist_tune")
        .select("*", { count: "exact", head: true })
        .eq("playlist_ref", 9001)
        .in("tune_ref", tuneIds);

      if (error) {
        // Transient read error - warn and retry
        // eslint-disable-next-line no-console
        console.warn(
          "Transient error reading playlist_tune count, retrying:",
          error.message
        );
      } else {
        const currentCount = count ?? 0;
        if (currentCount === tuneIds.length) {
          matched = true;
          break;
        }
        // eslint-disable-next-line no-console
        console.log(
          `Waiting for seeded tunes to appear: ${currentCount}/${tuneIds.length}`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }

    if (!matched) {
      console.warn(
        `⚠️ Timed out waiting for playlist_tune to contain ${tuneIds.length} rows`
      );
    }

    // Fetch final rows for accurate logging
    const { data: finalRows, error: finalError } = await supabase
      .from("playlist_tune")
      .select("tune_ref")
      .eq("playlist_ref", 9001)
      .in("tune_ref", tuneIds);

    if (finalError) {
      // eslint-disable-next-line no-console
      console.warn(
        "Failed to read back seeded playlist_tune rows:",
        finalError
      );
    } else {
      // eslint-disable-next-line no-console
      console.log(
        `✅ Verified seeded tunes present: ${finalRows?.length ?? 0}/${
          tuneIds.length
        }`
      );
    }
  }

  console.log(`✅ Seeded ${tuneIds.length} tunes in repertoire`);
}

/**
 * MASTER SETUP: Deterministic test state
 * 1. Navigate to page (if not already)
 * 2. Setup Supabase state
 * 3. Clear local cache
 * 4. Reload page to trigger fresh sync
 */
export async function setupDeterministicTest(
  page: Page,
  opts: {
    clearRepertoire?: boolean;
    seedRepertoire?: number[];
    scheduleTunes?: { tuneIds: number[]; daysAgo: number };
  } = {}
) {
  console.log("🔧 Setting up deterministic test state...");

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

  // Step 1: Clear Supabase state
  if (opts.clearRepertoire) {
    await clearAliceRepertoire();
  }
  await deleteActivePracticeQueue();
  await resetScheduledDates();

  // Step 2: Seed Supabase state
  if (opts.seedRepertoire && opts.seedRepertoire.length > 0) {
    await clearAliceRepertoire();
    await seedAliceRepertoire(opts.seedRepertoire);
  }
  if (opts.scheduleTunes) {
    await scheduleTunesForPractice(
      opts.scheduleTunes.daysAgo,
      opts.scheduleTunes.tuneIds
    );
  }

  // Step 3: Clear local cache
  await clearTunetreesStorageDB(page);

  // Step 4: Reload page to trigger fresh sync
  await page.reload();
  await page.waitForTimeout(3000); // Wait for sync to complete

  console.log("✅ Deterministic test state ready");
}

/**
 * Helper: Clear a specific Supabase table
 */
async function clearSupabaseTable(tableName: string) {
  const { supabase } = await getAliceClient();

  // Different tables use different column names for user identification
  let query = supabase.from(tableName).delete();

  if (tableName === "practice_record" || tableName === "daily_practice_queue") {
    // These tables use playlist_ref to identify user's data
    query = query.eq("playlist_ref", 9001);
  } else if (tableName === "table_transient_data") {
    // This table uses user_id
    query = query.eq("user_id", 9001);
  } else {
    // Default: assume user_ref
    query = query.eq("user_ref", 9001);
  }

  const { error } = await query;

  if (!error) {
    // Verify deletion count (head:true returns count)
    const timeoutMs = 8000;
    const retryDelayMs = 500;
    const start = Date.now();
    let finalCount: number | null = null;

    while (Date.now() - start < timeoutMs) {
      const { count, error: countError } = await supabase
        .from(tableName)
        .select("*", { count: "exact", head: true });

      if (countError) {
        // Treat "no rows" style errors as empty
        if (countError.message?.includes("no rows")) {
          finalCount = 0;
          break;
        }
        // Transient read error - warn and retry
        // eslint-disable-next-line no-console
        console.warn(
          `Transient error reading count for ${tableName}, retrying:`,
          countError.message
        );
      } else {
        finalCount = count ?? 0;
        if (finalCount === 0) break;
      }

      await new Promise<void>((resolve) => setTimeout(resolve, retryDelayMs));
    }

    if (finalCount === 0) {
      console.log(`✅ Cleared ${tableName} (remaining rows: 0)`);
    } else {
      console.error(
        `❌ Timed out waiting for ${tableName} to be empty. Last known count: ${finalCount}`
      );
    }
  }

  if (error && !error.message.includes("no rows")) {
    console.error(`Failed to clear ${tableName}:`, error);
  }
}

/**
 * Helper: Update tune's scheduled date
 */
async function updateTuneScheduled(
  tuneId: number,
  scheduledDate: string | null
) {
  const { supabase } = await getAliceClient();

  const { error } = await supabase
    .from("playlist_tune")
    .update({ scheduled: scheduledDate })
    .eq("tune_ref", tuneId)
    .eq("user_ref", 9001)
    .eq("playlist_ref", 9001);

  if (error) {
    console.error(`Failed to update scheduled date for tune ${tuneId}:`, error);
  }
}

/**
 * PRACTICE TEST SETUP
 * Fast, deterministic setup for practice-related tests.
 * Clears practice state but keeps catalog intact.
 */
export async function setupForPracticeTests(
  page: Page,
  opts?: {
    /** Tune IDs to have in Alice's repertoire (default: [9001, 3497]) */
    repertoireTunes?: number[];
    /** Which tab to navigate to (default: 'practice') */
    startTab?: "practice" | "repertoire" | "catalog";
  }
) {
  const { repertoireTunes = [9001, 3497], startTab = "practice" } = opts ?? {};

  console.log("🔧 [setupForPracticeTests] Starting...");

  // 1. Clear practice-specific tables only (fast - don't touch catalog!)
  await clearSupabaseTable("practice_record");
  await clearSupabaseTable("daily_practice_queue");
  await clearSupabaseTable("table_transient_data");

  // 2. Reset Alice's repertoire to known state
  await clearAliceRepertoire();
  if (repertoireTunes.length > 0) {
    await seedAliceRepertoire(repertoireTunes);
  }

  // 3. Navigate to ensure we're on a valid origin
  const currentUrl = page.url();
  if (
    !currentUrl ||
    currentUrl === "about:blank" ||
    currentUrl.startsWith("data:")
  ) {
    await page.goto("http://localhost:5173/");
    await page.waitForTimeout(1000);
  }

  // 4. Clear ONLY IndexedDB cache (keep auth in localStorage!)
  await clearTunetreesStorageDB(page);

  // 5. Reload to trigger fresh sync from Supabase
  await page.reload();
  // Wait longer for sync to complete (complex sync can take time)
  await page.waitForTimeout(5000);

  // 6. Navigate to starting tab
  await page.waitForSelector(`[data-testid="tab-${startTab}"]`, {
    timeout: 10000,
  });
  await page.getByTestId(`tab-${startTab}`).click();
  await page.waitForTimeout(500);

  console.log(
    `✅ [setupForPracticeTests] Ready with ${repertoireTunes.length} tunes in repertoire`
  );
}

/**
 * CATALOG TEST SETUP
 * Fast setup for catalog/import tests.
 * Keeps catalog intact, clears user's repertoire.
 */
export async function setupForCatalogTests(
  page: Page,
  opts?: {
    /** Whether to start with empty repertoire (default: true) */
    emptyRepertoire?: boolean;
    /** Which tab to navigate to (default: 'catalog') */
    startTab?: "practice" | "repertoire" | "catalog";
  }
) {
  const { emptyRepertoire = true, startTab = "catalog" } = opts ?? {};

  console.log("🔧 [setupForCatalogTests] Starting...");

  // 1. Clear only user's repertoire (keep catalog!)
  if (emptyRepertoire) {
    await clearAliceRepertoire();
  }

  // 2. Clear practice state
  await clearSupabaseTable("practice_record");
  await clearSupabaseTable("daily_practice_queue");
  await clearSupabaseTable("table_transient_data");

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

  // wait for the playlist dropdown to be visible and its title to contain "Irish Flute"
  await playlistLocator.waitFor({ state: "visible", timeout: 10000 });
  const playlistDropdownButton = page.getByTestId("playlist-dropdown-button");
  const expectedTitle = "Irish Flute (9001)";
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
      console.log(`✅ Playlist title matched: ${innerText}`);
      break;
    }

    await page.waitForTimeout(200);
  }

  if (innerText !== expectedTitle) {
    console.error(
      `⚠️ playlist menu title did not match within ${timeoutMs}ms, last value: ${innerText}`
    );
    throw new Error(
      `Playlist dropdown title did not match expected value within ${timeoutMs}ms. Expected "${expectedTitle}", last value: "${innerText}"`
    );
  }
  // const innerText = await playlistDropdownButton.innerText({ timeout: 10000 });
  // console.log(`playlist menu title after reload: ${innerText}`);
  // // expect(innerText).toBe("Irish Flute (9001)");

  // Wait longer for sync to complete
  // await page.waitForTimeout(5000);

  // 6. Navigate to starting tab
  await page.waitForSelector(`[data-testid="tab-${startTab}"]`, {
    timeout: 10000,
  });
  await page.getByTestId(`tab-${startTab}`).click();

  const catalogAddToRepertoireButton = page.getByTestId(
    "catalog-add-to-repertoire-button"
  );
  await catalogAddToRepertoireButton.waitFor({
    state: "visible",
    timeout: 10000,
  });
  const tuneCountComponent = page
    .locator("div")
    .filter({ hasText: /^492 tunes$/ })
    .first();

  await tuneCountComponent.waitFor({
    state: "visible",
    timeout: 10000,
  });

  await page.waitForTimeout(500);

  console.log(`✅ [setupForCatalogTests] Ready on ${startTab} tab`);
}

/**
 * REPERTOIRE TEST SETUP
 * Fast setup for repertoire tests.
 * Seeds specific tunes in repertoire.
 */
export async function setupForRepertoireTests(
  page: Page,
  opts: {
    /** Tune IDs to seed in repertoire */
    repertoireTunes: number[];
    /** Whether to schedule them for practice (default: false) */
    scheduleTunes?: boolean;
    /** Days ago to schedule (default: 0 = today) */
    scheduleDaysAgo?: number;
  }
) {
  const { repertoireTunes, scheduleTunes = false, scheduleDaysAgo = 0 } = opts;

  console.log("🔧 [setupForRepertoireTests] Starting...");

  // RESET CLIENT CACHE to ensure fresh session
  resetAliceClient();

  // 1. Clear practice state
  await clearAliceRepertoire();
  await clearSupabaseTable("practice_record");
  await clearSupabaseTable("daily_practice_queue");
  await clearSupabaseTable("table_transient_data");

  // 2. Reset repertoire
  await seedAliceRepertoire(repertoireTunes);

  // 3. Optionally schedule tunes
  if (scheduleTunes) {
    const scheduleDate = new Date();
    scheduleDate.setDate(scheduleDate.getDate() - scheduleDaysAgo);
    const scheduleDateStr = scheduleDate.toISOString();

    for (const tuneId of repertoireTunes) {
      await updateTuneScheduled(tuneId, scheduleDateStr);
    }
  }

  // 4. Navigate to ensure valid origin
  const currentUrl = page.url();
  if (
    !currentUrl ||
    currentUrl === "about:blank" ||
    currentUrl.startsWith("data:")
  ) {
    await page.goto("http://localhost:5173/");
    await page.waitForTimeout(1000);
  }

  // 5. Clear ONLY IndexedDB cache (keep auth in localStorage!)
  await clearTunetreesStorageDB(page);

  // 6. Reload to trigger fresh sync from Supabase
  await page.reload();
  // Wait longer for sync to complete
  await page.waitForTimeout(5000);

  // 7. Navigate to repertoire tab
  await page.waitForSelector('[data-testid="tab-repertoire"]', {
    timeout: 10000,
  });
  await page.getByTestId("tab-repertoire").click();
  await page.waitForTimeout(1000);

  console.log(
    `✅ [setupForRepertoireTests] Ready with ${repertoireTunes.length} tunes ${
      scheduleTunes ? "(scheduled)" : "(unscheduled)"
    }`
  );
}
