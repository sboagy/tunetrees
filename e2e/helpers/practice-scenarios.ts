/**
 * Practice Queue Test Scenarios
 *
 * Helper functions to set up specific practice queue states for E2E testing.
 * Uses direct Supabase calls to manipulate database state before tests run.
 */

import { expect, type Page } from "@playwright/test";
import log from "loglevel";

log.setLevel("info");

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
  opts: { playlistId: string; tuneIds: string[]; userIdInt?: string }
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
export async function getPracticeCountLocally(page: Page, playlistId: string) {
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
    // First, ask the app to dispose in-memory DB to avoid re-persisting
    try {
      if (
        (window as any).__ttTestApi &&
        typeof (window as any).__ttTestApi.dispose === "function"
      ) {
        await (window as any).__ttTestApi.dispose();
      }
    } catch (err) {
      console.warn("dispose() failed before IndexedDB delete:", err);
    }
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
    // eslint-disable-next-line no-console
    console.log("✅ Cleared local IndexedDB cache");

    // Clear app caches (but preserve auth state for parallel workers)

    // 1) Clear sessionStorage only (non-persistent storage)
    try {
      sessionStorage.clear();
      // eslint-disable-next-line no-console
      console.log("✅ Cleared sessionStorage");
    } catch (err) {
      console.warn("Failed to clear sessionStorage:", err);
    }

    // 1a) Clear Practice queue-date keys.
    // These can leak in via Playwright storageState and cause Practice to render
    // an unexpected day (e.g., manual/future date) leading to "All Caught Up!".
    try {
      localStorage.removeItem("TT_PRACTICE_QUEUE_DATE");
      localStorage.removeItem("TT_PRACTICE_QUEUE_DATE_MANUAL");
      // eslint-disable-next-line no-console
      console.log("✅ Cleared practice queue date keys from localStorage");
    } catch (err) {
      console.warn("Failed to clear practice queue date keys:", err);
    }

    // 1b) Clear sync timestamp keys from localStorage (forces full initial sync)
    // These are user-namespaced: TT_LAST_SYNC_TIMESTAMP_<userId>
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("TT_LAST_SYNC_TIMESTAMP")) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }
      if (keysToRemove.length > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `✅ Cleared ${keysToRemove.length} sync timestamp key(s) from localStorage`
        );
      }
    } catch (err) {
      console.warn("Failed to clear sync timestamp keys:", err);
    }

    // 2) Clear CacheStorage (service-worker / workbox caches for app code)
    if (typeof caches !== "undefined") {
      try {
        const cacheNames = await caches.keys();
        // IMPORTANT: Preserve Workbox precache so offline SPA navigations (e.g. /?tab=practice)
        // can still be fulfilled by cached app-shell HTML.
        const preserved = cacheNames.filter((n) =>
          n.startsWith("workbox-precache-")
        );
        const toDelete = cacheNames.filter(
          (n) => !n.startsWith("workbox-precache-")
        );

        await Promise.all(toDelete.map((n) => caches.delete(n)));
        // eslint-disable-next-line no-console
        console.log("✅ Cleared CacheStorage caches:", toDelete);
        // eslint-disable-next-line no-console
        console.log("🛡️ Preserved Workbox precache:", preserved);
      } catch (err) {
        console.warn("Failed to clear CacheStorage:", err);
      }
    }

    // 3) Clear any in-memory test hooks the app may have exposed (again, after delete)
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

      // eslint-disable-next-line no-console
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
  timeoutMs = 30000
): Promise<void> {
  const startTime = Date.now();

  log.debug("⏳ Waiting for initial sync to complete...");

  // Poll for sync completion by checking if initial syncDown has finished
  while (Date.now() - startTime < timeoutMs) {
    const status = await page.evaluate(() => {
      const el = document.querySelector(
        "[data-auth-initialized]"
      ) as HTMLElement | null;
      const versionStr = el?.getAttribute("data-sync-version") || "0";
      const successStr = el?.getAttribute("data-sync-success") || "";
      const errorCountStr = el?.getAttribute("data-sync-error-count") || "0";
      const errorSummary = el?.getAttribute("data-sync-error-summary") || "";

      const version = Number.parseInt(versionStr, 10) || 0;
      const errorCount = Number.parseInt(errorCountStr, 10) || 0;
      const success = successStr === "true";

      return { version, successStr, success, errorCount, errorSummary };
    });

    // If initial sync completed but failed, fail fast with the underlying error.
    if (status.version >= 1 && (!status.success || status.errorCount > 0)) {
      throw new Error(
        `⚠️ Initial sync completed but failed (success='${status.successStr}', errors=${status.errorCount}). ${status.errorSummary}`
      );
    }

    if (status.version >= 1 && status.success && status.errorCount === 0) {
      log.debug("✅ Initial sync complete (success) detected");
      return;
    }

    await page.waitForTimeout(200);
  }

  // Timeout - throw error since sync is critical
  throw new Error(
    `⚠️ Initial sync did not complete within ${timeoutMs}ms - tests may fail`
  );
}

// ============================================================================
// PARALLEL-SAFE SETUP FUNCTIONS (support multiple test users)
// ============================================================================

import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { BASE_URL } from "../test-config";
import { getTestUserClient, type TestUser } from "./test-users";

// Cache mapping from Supabase user UUID -> internal user_profile.id (user_ref)
const internalUserRefCache: Map<string, string> = new Map();

async function getInternalUserRef(
  supabase: any,
  user: TestUser
): Promise<string | null> {
  // Supabase userId stored on TestUser.userId; internal user_profile.id needed for tune_override.user_ref
  if (internalUserRefCache.has(user.userId)) {
    return internalUserRefCache.get(user.userId)!;
  }
  const { data, error } = await supabase
    .from("user_profile")
    .select("id")
    .eq("supabase_user_id", user.userId)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn(
      `[${user.name}] Could not resolve internal user_ref: ${error.message}`
    );
    return null;
  }
  const internalId = data?.id || null;
  if (internalId) internalUserRefCache.set(user.userId, internalId);
  return internalId;
}

// Export getTestUserClient so tests can perform direct Supabase cleanup
export { getTestUserClient };

/**
 * Parallel-safe version of setupDeterministicTest
 * Sets up a deterministic test state for a specific user
 */
export async function setupDeterministicTestParallel(
  page: Page,
  user: TestUser,
  opts: {
    clearRepertoire?: boolean;
    seedRepertoire?: string[];
    scheduleTunes?: { tuneIds: string[]; daysAgo: number };
    /** Optional list of title prefixes to purge (cascade delete) before setup */
    purgeTitlePrefixes?: string[];
  } = {}
) {
  log.debug(`🔧 [${user.name}] Setting up deterministic test state...`);

  // Step 0: Navigate to page if not already (needed for IndexedDB access)
  const currentUrl = page.url();
  if (
    !currentUrl ||
    currentUrl === "about:blank" ||
    currentUrl.startsWith("data:")
  ) {
    await page.goto(`${BASE_URL}`);
    await waitForSyncComplete(page);
  }

  // Optional purge of tunes by title prefix (handles leftover test-created tunes)
  if (opts.purgeTitlePrefixes && opts.purgeTitlePrefixes.length > 0) {
    try {
      const userKey = user.email.split(".")[0];
      const { supabase } = await getTestUserClient(userKey);
      const prefixes = opts.purgeTitlePrefixes;
      const allTuneIds: string[] = [];
      for (const prefix of prefixes) {
        // Use ilike with wildcard for prefix matching
        const { data, error } = await supabase
          .from("tune")
          .select("id,title")
          .ilike("title", `${prefix}%`);
        if (error) {
          console.warn(
            `[${user.name}] Failed to query tunes for purge prefix '${prefix}': ${error.message}`
          );
          continue;
        }
        if (data) {
          for (const row of data) {
            if (row?.id) allTuneIds.push(row.id);
          }
        }
      }
      const uniqueIds = [...new Set(allTuneIds)];
      if (uniqueIds.length > 0) {
        log.debug(
          `[${user.name}] Purging ${uniqueIds.length} tune(s) matching prefixes: ${prefixes.join(", ")}`
        );
        // Cascade delete dependent rows first
        const tablesToDelete: {
          table: string;
          column: string;
          extraFilters?: (q: any) => any;
        }[] = [
          {
            table: "table_transient_data",
            column: "tune_id",
            extraFilters: (q) =>
              q.eq("user_id", user.userId).eq("playlist_id", user.playlistId),
          },
          {
            table: "daily_practice_queue",
            column: "tune_ref",
            extraFilters: (q) => q.eq("playlist_ref", user.playlistId),
          },
          {
            table: "practice_record",
            column: "tune_ref",
            extraFilters: (q) => q.eq("playlist_ref", user.playlistId),
          },
          {
            table: "playlist_tune",
            column: "tune_ref",
            extraFilters: (q) => q.eq("playlist_ref", user.playlistId),
          },
          { table: "tune_override", column: "tune_ref" },
        ];
        for (const { table, column, extraFilters } of tablesToDelete) {
          try {
            if (table === "practice_record") {
              const { error } = await supabase.rpc(
                "e2e_delete_practice_record_by_tunes",
                {
                  target_playlist: user.playlistId,
                  tune_ids: uniqueIds,
                }
              );
              if (error) {
                console.warn(
                  `[${user.name}] Error deleting from ${table}: ${error.message}`
                );
              }
              continue;
            }
            let del = supabase.from(table).delete().in(column, uniqueIds);
            if (extraFilters) del = extraFilters(del);
            const { error } = await del;
            if (error) {
              console.warn(
                `[${user.name}] Error deleting from ${table}: ${error.message}`
              );
            }
          } catch (err: any) {
            console.warn(
              `[${user.name}] Exception deleting from ${table}: ${err?.message || err}`
            );
          }
        }
        // Finally delete the tunes themselves
        const { error: tuneDeleteError } = await supabase
          .from("tune")
          .delete()
          .in("id", uniqueIds);
        if (tuneDeleteError) {
          console.warn(
            `[${user.name}] Error deleting tunes: ${tuneDeleteError.message}`
          );
        } else {
          log.debug(
            `[${user.name}] ✅ Purged test tunes: ${uniqueIds.join(", ")}`
          );
        }
      }
    } catch (err: any) {
      console.warn(
        `[${user.name}] Failed purgeTitlePrefixes pass: ${err?.message || err}`
      );
    }
  }

  let whichTables = [
    "daily_practice_queue",
    "practice_record",
    "tune_override",
    "prefs_scheduling_options",
  ];

  // Step 1: Clear user's state
  if (opts.clearRepertoire) {
    // Clear user's repertoire via generic table helper and verify
    await clearUserTable(user, "playlist_tune");
    whichTables = [...whichTables, "playlist_tune"];
  }
  await clearUserTable(user, "daily_practice_queue");
  await clearUserTable(user, "practice_record");
  await clearUserTable(user, "tune_override");
  await clearUserTable(user, "prefs_scheduling_options");
  await clearUserTable(user, "table_transient_data");

  await verifyTablesEmpty(user, whichTables);

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
  await waitForSyncComplete(page);

  log.debug(`✅ [${user.name}] Deterministic test state ready`);
}

// clearUserRepertoire removed; use clearUserTable(user, "playlist_tune") + verifyTablesEmpty

/**
 * Seed repertoire for a specific test user (parallel-safe)
 */
export async function seedUserRepertoire(
  user: TestUser,
  tuneIds: string[],
  preCheck: boolean = false
) {
  const userKey = user.email.split(".")[0]; // alice.test@... → alice
  const { supabase } = await getTestUserClient(userKey);

  // Verify playlist_tune is empty before seeding (consistent helper)
  if (preCheck) {
    await verifyTablesEmpty(user, ["playlist_tune"], supabase);
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

  log.debug(`✅ [${user.name}] Seeded ${tuneIds.length} tunes in repertoire`);
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
  } else if (tableName === "playlist_tune") {
    // playlist_tune rows are keyed by playlist_ref; no user_ref column
    query = query.eq("playlist_ref", user.playlistId);
  } else if (tableName === "table_transient_data") {
    query = query.eq("user_id", user.userId);
  } else if (tableName === "prefs_scheduling_options") {
    // prefs_scheduling_options is keyed by user_id (not user_ref)
    query = query.eq("user_id", user.userId);
  } else if (tableName === "tune_override") {
    // tune_override.user_ref references internal user_profile.id, not supabase_user_id.
    const cached = internalUserRefCache.get(user.userId);
    if (cached) {
      query = query.eq("user_ref", cached);
    } else {
      // Fallback: use supabase_user_id (will match zero rows); deletion will be retried in clearUserTable with explicit internal id.
      query = query.eq("user_ref", user.userId);
    }
  } else {
    query = query.eq("user_ref", user.userId);
  }
  return query;
}

/**
 * Verify that a table for a specific user is empty (with polling and retries)
 */
async function verifyTableEmpty(
  user: TestUser,
  tableName: string,
  supabase?: any
) {
  const userKey = user.email.split(".")[0];
  if (!supabase) {
    const client = await getTestUserClient(userKey);
    supabase = client.supabase;
  }

  const timeoutMs = 16000;
  const retryDelayMs = 500;
  const start = Date.now();
  let finalCount: number | null = null;

  while (Date.now() - start < timeoutMs) {
    // Build count query with same safety filters
    let countQuery = supabase.from(tableName).select("*", {
      count: "exact",
      head: true,
    }) as any;
    if (tableName === "tune_override") {
      const internalId = await getInternalUserRef(supabase, user);
      if (internalId) {
        countQuery = countQuery.eq("user_ref", internalId);
      } else {
        countQuery = countQuery.eq("user_ref", "__never_match__");
      }
    } else {
      countQuery = applyTableQueryFilters(tableName, countQuery, user);
    }

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
      log.debug(
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
    if (tableName === "tune_override") {
      const internalId = await getInternalUserRef(supabase, user);
      if (internalId) {
        finalQuery = finalQuery.eq("user_ref", internalId);
      } else {
        finalQuery = finalQuery.eq("user_ref", "__never_match__");
      }
    } else {
      finalQuery = applyTableQueryFilters(tableName, finalQuery, user);
    }

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

  log.debug(`✅ [${user.name}] Verified ${tableName} is empty`);
}

/**
 * Verify that multiple tables for a specific user are empty (parallel queries for efficiency)
 */
async function verifyTablesEmpty(
  user: TestUser,
  tableNames: string[],
  supabase?: any
) {
  const userKey = user.email.split(".")[0];
  if (!supabase) {
    const client = await getTestUserClient(userKey);
    supabase = client.supabase;
  }

  const timeoutMs = 16000;
  const retryDelayMs = 500;
  const start = Date.now();
  const tableCounts = new Map<string, number>(tableNames.map((t) => [t, 0]));

  while (Date.now() - start < timeoutMs) {
    let allEmpty = true;
    for (const tableName of tableNames) {
      let countQuery = supabase.from(tableName).select("*", {
        count: "exact",
        head: true,
      }) as any;
      if (tableName === "tune_override") {
        const internalId = await getInternalUserRef(supabase, user);
        if (internalId) {
          countQuery = countQuery.eq("user_ref", internalId);
        } else {
          countQuery = countQuery.eq("user_ref", "__never_match__");
        }
      } else {
        countQuery = applyTableQueryFilters(tableName, countQuery, user);
      }
      const { count, error } = await countQuery;
      if (error) {
        allEmpty = false; // treat error as not-empty, continue polling
        log.debug(
          `[${user.name}] Transient count error for ${tableName}, retrying: ${error.message}`
        );
        continue;
      }
      const c = count ?? 0;
      tableCounts.set(tableName, c);
      if (c > 0) {
        allEmpty = false;
      }
    }
    if (allEmpty) break;
    await new Promise((r) => setTimeout(r, retryDelayMs));
  }

  // Final strict check
  const failures: string[] = [];
  for (const [tableName, count] of tableCounts.entries()) {
    if (count > 0) {
      failures.push(`${tableName} (${count} rows)`);
    }
  }
  if (failures.length) {
    throw new Error(
      `[${user.name}] Failed to clear tables: ${failures.join(", ")}`
    );
  }
  log.debug(
    `✅ [${user.name}] Verified ${tableNames.length} tables are empty: ${tableNames.join(", ")}`
  );
}

/**
 * Clear a Supabase table for a specific user (parallel-safe)
 * @param check - if true, verifies the table is empty after deletion
 */
async function clearUserTable(
  user: TestUser,
  tableName: string,
  check: boolean = false
) {
  const userKey = user.email.split(".")[0]; // alice.test@... → alice
  const { supabase } = await getTestUserClient(userKey);
  let error: any = null;

  // practice_record deletes are blocked by a DB trigger unless the per-transaction
  // flag `app.allow_practice_record_delete` is set. Supabase requests are each
  // their own transaction, so we use an RPC that sets the flag and deletes in
  // one call.
  if (tableName === "practice_record") {
    const { error: rpcError } = await supabase.rpc(
      "e2e_clear_practice_record",
      {
        target_playlist: user.playlistId,
      }
    );
    error = rpcError;
  } else {
    // Unified deletion path; RLS ensures only caller's rows are affected.
    let query = supabase.from(tableName).delete();
    query = applyTableQueryFilters(tableName, query, user);
    const { error: delError } = await query;
    error = delError;
  }

  if (error && !error.message?.includes("no rows")) {
    console.error(`[${user.name}] Failed to clear ${tableName}:`, error);
  } else {
    log.debug(`✅ [${user.name}] Cleared ${tableName}`);
  }

  // Verify table is empty if requested
  if (check) {
    await verifyTableEmpty(user, tableName, supabase);
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
    repertoireTunes?: string[];
    startTab?: "practice" | "repertoire" | "catalog";
    /**
     * If provided, marks all repertoireTunes as scheduled this many days ago.
     * Ensures they appear in today's practice queue so flashcards have items.
     */
    scheduleDaysAgo?: number;
    /**
     * Base date (browser-frozen test date) used when computing scheduled dates.
     * If omitted, falls back to Playwright process current date (legacy behavior).
     * Accepts Date or ISO string.
     */
    scheduleBaseDate?: Date | string;
  }
) {
  const {
    repertoireTunes = [],
    startTab = "practice",
    scheduleDaysAgo,
    scheduleBaseDate,
  } = opts ?? {};

  log.debug(`🔧 [${user.name}] setupForPracticeTests Starting...`);

  // 1. Clear practice-specific tables
  await clearUserTable(user, "practice_record");
  await clearUserTable(user, "daily_practice_queue");
  await clearUserTable(user, "table_transient_data");
  await clearUserTable(user, "tune_override");
  await clearUserTable(user, "prefs_scheduling_options");

  // 2. Reset repertoire
  await clearUserTable(user, "playlist_tune");

  await verifyTablesEmpty(user, [
    "practice_record",
    "daily_practice_queue",
    "table_transient_data",
    "tune_override",
    "prefs_scheduling_options",
    "playlist_tune",
  ]);

  if (repertoireTunes.length > 0) {
    await seedUserRepertoire(user, repertoireTunes, true);
  }

  // 2b. Optionally schedule tunes so they're due today
  if (scheduleDaysAgo !== undefined) {
    const userKey = user.email.split(".")[0];
    const { supabase } = await getTestUserClient(userKey);
    // Use provided frozen test date base if available; otherwise default to host time.
    const base = scheduleBaseDate ? new Date(scheduleBaseDate) : new Date();
    // Subtract daysAgo to get original scheduled date (past due to force inclusion in queue)
    base.setDate(base.getDate() - scheduleDaysAgo);
    const scheduleDateStr = base.toISOString();

    for (const tuneId of repertoireTunes) {
      const { error } = await supabase
        .from("playlist_tune")
        .update({ scheduled: scheduleDateStr })
        .eq("playlist_ref", user.playlistId)
        .eq("tune_ref", tuneId);

      if (error) {
        console.warn(
          `[${user.name}] Failed to schedule tune ${tuneId}: ${error.message}`
        );
      }
    }
  }

  // 3. Navigate if needed
  const currentUrl = page.url();
  if (
    !currentUrl ||
    currentUrl === "about:blank" ||
    currentUrl.startsWith("data:")
  ) {
    await page.goto(`${BASE_URL}`);
    await waitForSyncComplete(page);
  }

  // 4. Clear IndexedDB cache
  await clearTunetreesStorageDB(page);

  // 5. Reload to trigger fresh sync
  await page.reload();
  await waitForSyncComplete(page);

  // 6. Navigate to starting tab (skip if already active)
  const tabSelector = `[data-testid="tab-${startTab}"]`;
  const tabLocator = page.getByTestId(`tab-${startTab}`);

  const isActive = await tabLocator.evaluate(
    (el) =>
      el.getAttribute("aria-selected") === "true" ||
      el.classList.contains("active")
  );

  if (!isActive) {
    await page.waitForSelector(tabSelector, { timeout: 10000 });
    await tabLocator.click();
    await page.waitForTimeout(500);
  }

  log.debug(
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
    repertoireTunes: string[];
    scheduleTunes?: boolean;
    scheduleDaysAgo?: number;
    /**
     * Base date (browser-frozen test date) used when computing scheduled dates.
     * If omitted, falls back to host time. Accepts Date or ISO string.
     */
    scheduleBaseDate?: Date | string;
  }
) {
  const {
    repertoireTunes,
    scheduleTunes = false,
    scheduleDaysAgo = 0,
    scheduleBaseDate,
  } = opts;

  log.debug(`🔧 [${user.name}] setupForRepertoireTests Starting...`);

  // 1. Clear practice state
  await clearUserTable(user, "practice_record");
  await clearUserTable(user, "daily_practice_queue");
  await clearUserTable(user, "table_transient_data");
  await clearUserTable(user, "tune_override");
  await clearUserTable(user, "prefs_scheduling_options");

  // 2. Reset repertoire
  await clearUserTable(user, "playlist_tune");

  await verifyTablesEmpty(user, [
    "practice_record",
    "daily_practice_queue",
    "table_transient_data",
    "tune_override",
    "prefs_scheduling_options",
    "playlist_tune",
  ]);

  await seedUserRepertoire(user, repertoireTunes);

  // 3. Optionally schedule tunes
  if (scheduleTunes) {
    const userKey = user.email.split(".")[0]; // alice.test@... → alice
    const { supabase } = await getTestUserClient(userKey);
    const base = scheduleBaseDate ? new Date(scheduleBaseDate) : new Date();
    base.setDate(base.getDate() - scheduleDaysAgo);
    const scheduleDateStr = base.toISOString();

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
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.error(`[Browser Error] ${msg.text()}`);
    } else {
      console.log(`[Browser] ${msg.text()}`);
    }
  });

  const currentUrl = page.url();
  if (
    !currentUrl ||
    currentUrl === "about:blank" ||
    currentUrl.startsWith("data:")
  ) {
    await page.goto(`${BASE_URL}`);
    await waitForSyncComplete(page);
  }

  // 5. Clear IndexedDB cache
  await clearTunetreesStorageDB(page);

  // 6. Reload to trigger fresh sync
  await page.reload();
  await waitForSyncComplete(page);

  // 7. Navigate to repertoire tab
  await page.waitForSelector('[data-testid="tab-repertoire"]', {
    timeout: 20000,
  });
  await page.getByTestId("tab-repertoire").click();
  await page.waitForTimeout(1000);

  log.debug(
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
    /**
     * If provided, schedules all repertoire tunes relative to this base date minus scheduleDaysAgo.
     * Enables deterministic queue states when starting from catalog context.
     */
    scheduleBaseDate?: Date | string;
    /**
     * Optional: schedule existing repertoire tunes this many days ago (past-due) to force them into queue.
     */
    scheduleDaysAgo?: number;
    /**
     * Optional: if true and repertoire is not emptied, still apply scheduling logic.
     */
    scheduleTunes?: boolean;
  }
) {
  const {
    emptyRepertoire = true,
    startTab = "catalog",
    scheduleBaseDate,
    scheduleDaysAgo = 0,
    scheduleTunes = false,
  } = opts ?? {};

  log.debug(`🔧 [${user.name}] setupForCatalogTests Starting...`);

  let whichTables = [
    "practice_record",
    "daily_practice_queue",
    "table_transient_data",
    "tune_override",
    "prefs_scheduling_options",
    "playlist_tune",
  ];

  // 1. Clear only user's repertoire (keep catalog!)
  if (emptyRepertoire) {
    await clearUserTable(user, "playlist_tune");
    whichTables = [...whichTables, "playlist_tune"];
  }

  // 2. Clear practice state
  await clearUserTable(user, "practice_record");
  await clearUserTable(user, "daily_practice_queue");
  await clearUserTable(user, "table_transient_data");
  await clearUserTable(user, "tune_override");
  await clearUserTable(user, "prefs_scheduling_options");

  await verifyTablesEmpty(user, whichTables);

  // 2b. Optionally schedule tunes if not emptying repertoire and requested
  if (!emptyRepertoire && scheduleTunes) {
    const userKey = user.email.split(".")[0];
    const { supabase } = await getTestUserClient(userKey);
    const base = scheduleBaseDate ? new Date(scheduleBaseDate) : new Date();
    base.setDate(base.getDate() - scheduleDaysAgo);
    const scheduleDateStr = base.toISOString();

    // Fetch repertoire tunes for this playlist
    const { data: repRows, error: repErr } = await supabase
      .from("playlist_tune")
      .select("tune_ref")
      .eq("playlist_ref", user.playlistId);
    if (!repErr && repRows) {
      for (const row of repRows) {
        const { error } = await supabase
          .from("playlist_tune")
          .update({ scheduled: scheduleDateStr })
          .eq("playlist_ref", user.playlistId)
          .eq("tune_ref", row.tune_ref);
        if (error) {
          console.warn(
            `[${user.name}] Failed to schedule tune ${row.tune_ref}: ${error.message}`
          );
        }
      }
      log.debug(
        `✅ [${user.name}] Scheduled ${repRows.length} repertoire tunes (base: ${scheduleDateStr})`
      );
    }
  }

  // 3. Navigate to ensure valid origin
  const currentUrl = page.url();
  if (
    !currentUrl ||
    currentUrl === "about:blank" ||
    currentUrl.startsWith("data:")
  ) {
    await page.goto(`${BASE_URL}`, {
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

  // 6. Wait for playlist dropdown to show correct data
  const playlistLocator = page.getByTestId("playlist-dropdown-button");
  await playlistLocator.waitFor({ state: "visible", timeout: 10000 });

  const expectedTitle = `Irish Flute`;
  await expect(playlistLocator).toContainText(expectedTitle, {
    timeout: 10000,
  });

  log.debug(`✅ [${user.name}] Playlist title matched: ${expectedTitle}`);

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
    const snapshotName = `e2e/tests/artifacts/catalog-missing-${user.email.split(".")[0]}-${Date.now()}.png`;
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

  log.debug(`✅ [${user.name}] setupForCatalogTests Ready on ${startTab} tab`);
}
