/**
 * Practice Queue Test Scenarios
 *
 * Helper functions to set up specific practice queue states for E2E testing.
 * Uses direct Supabase calls to manipulate database state before tests run.
 */

import { expect, type Page } from "@playwright/test";
import log from "loglevel";
import postgres from "postgres";
import { CATALOG_INSTRUMENT_IRISH_FLUTE_ID } from "../../src/lib/db/catalog-instrument-ids.js";

log.setLevel("info");

// ============================================================================
// TAB NAVIGATION HELPER (MOBILE + DESKTOP COMPATIBLE)
// ============================================================================

/**
 * Navigate to a specific main tab on both mobile (Kobalte Select dropdown)
 * and desktop (tab buttons) layouts.
 *
 * On mobile (< 768px) the TabBar renders a Kobalte Select instead of tab
 * buttons. This helper detects which layout is active and uses the correct
 * interaction so tests work across all viewport sizes.
 */
export async function navigateToTabForTest(
  page: Page,
  tabId: "practice" | "repertoire" | "catalog" | "analysis"
): Promise<void> {
  const tabLabels: Record<string, string> = {
    practice: "Practice",
    repertoire: "Repertoire",
    catalog: "Catalog",
    analysis: "Analysis",
  };

  // Check for mobile Select trigger (visible only when viewport < 768px)
  const selectTrigger = page.getByTestId("tab-nav-select");
  const isSelectVisible = await selectTrigger.isVisible().catch(() => false);

  if (isSelectVisible) {
    // Mobile: navigate via the Select dropdown
    const currentUrl = page.url();
    const currentTab =
      new URL(currentUrl).searchParams.get("tab") || "practice";
    if (currentTab === tabId) return; // Already on target tab

    await expect(selectTrigger).toBeEnabled({ timeout: 20_000 });
    await selectTrigger.click({ timeout: 10_000 });

    // Kobalte Select items have role="option"; match by visible label text.
    // These labels must match the `label` field in the TABS constant in TabBar.tsx.
    const option = page.getByRole("option", {
      name: new RegExp(tabLabels[tabId], "i"),
    });
    await expect(option).toBeVisible({ timeout: 5_000 });
    await option.click({ timeout: 5_000 });

    // Wait for the URL to reflect the newly selected tab
    await expect(page).toHaveURL(new RegExp(`[?&]tab=${tabId}`), {
      timeout: 10_000,
    });
  } else {
    // Desktop: navigate via the visible tab buttons
    const tabBtn = page.getByTestId(`tab-${tabId}`);
    await tabBtn.waitFor({ state: "visible", timeout: 20_000 });

    const ariaCurrent = await tabBtn.getAttribute("aria-current");
    if (ariaCurrent === "page") return; // Already active

    await tabBtn.click();
    await expect
      .poll(async () => await tabBtn.getAttribute("aria-current"), {
        timeout: 10_000,
        intervals: [100, 250, 500, 1000],
      })
      .toBe("page");
  }
}

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
  opts: { repertoireId: string; tuneIds: string[]; userIdInt?: string }
) {
  return await page.evaluate(async (input) => {
    if (!(window as any).__ttTestApi) {
      throw new Error("__ttTestApi not attached on window");
    }
    return await (window as any).__ttTestApi.seedAddToReview(input);
  }, opts);
}

export async function seedSchedulingPluginLocally(
  page: Page,
  opts?: {
    script?: string;
    goals?: string[];
    userId?: string;
    name?: string;
    description?: string | null;
    enabled?: boolean;
    isPublic?: boolean;
  }
) {
  return await page.evaluate(async (input) => {
    if (!(window as any).__ttTestApi) {
      throw new Error("__ttTestApi not attached on window");
    }
    return await (window as any).__ttTestApi.seedSchedulingPlugin(input);
  }, opts);
}

/**
 * Read the current practice queue size (latest snapshot) from inside the app.
 */
export async function getPracticeCountLocally(
  page: Page,
  repertoireId: string
) {
  return await page.evaluate(async (pid) => {
    if (!(window as any).__ttTestApi) {
      throw new Error("__ttTestApi not attached on window");
    }
    return await (window as any).__ttTestApi.getPracticeCount(pid);
  }, repertoireId);
}

/**
 * Clear local IndexedDB cache to force fresh sync from Supabase
 * This ensures tests start with a clean slate matching Supabase state
 */
export async function clearTunetreesStorageDB(
  page: Page,
  opts: {
    /**
     * If true, navigates away from the app origin after clearing.
     * Most callers should keep the origin so they can `page.reload()` and wait for sync.
     */
    leaveOriginAfterClear?: boolean;
  } = {}
) {
  // Signal teardown intent ASAP so the app can avoid kicking off DB init/sync while
  // Playwright is about to clear IndexedDB. This can fail if the page is mid-nav
  // or already being torn down; ignore and continue.
  let armedE2eClearFlag = false;
  try {
    await page.evaluate(() => {
      (window as any).__ttE2eIsClearing = true;
    });
    armedE2eClearFlag = true;
  } catch {
    // ignore
  }

  // Ensure the browser test API is available so we can close in-memory DB handles
  // before attempting IndexedDB deletion (prevents blocked/hanging deletes on CI).
  try {
    await page.waitForFunction(
      () =>
        !!(window as any).__ttTestApi &&
        typeof (window as any).__ttTestApi.dispose === "function",
      { timeout: 20000 }
    );

    await page.evaluate(async () => {
      const dbName = "tunetrees-storage";
      // Signal to the app that E2E teardown is actively clearing storage.
      // App code can use this to avoid re-initializing DB/sync while IndexedDB is being deleted.
      (window as any).__ttE2eIsClearing = true;

      try {
        // First, ask the app to dispose in-memory DB to avoid re-persisting
        try {
          if (
            (window as any).__ttTestApi &&
            typeof (window as any).__ttTestApi.dispose === "function"
          ) {
            await (window as any).__ttTestApi.dispose();
          }
        } catch (err) {
          console.warn(
            "[ClearDBStore] dispose() failed before IndexedDB delete:",
            err
          );
          throw err;
        }
        // NOTE: After dispose(), the local DB keys are already deleted via clearDb().
        // Deleting the entire IndexedDB database must succeed to prevent unbounded growth
        // across tests (which can cause OOM in sql.js WASM).
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
                const msg = `IndexedDB delete failed after ${maxAttempts} attempts: ${req.error}`;
                // eslint-disable-next-line no-console
                console.error(msg);
                reject(new Error(msg));
              }
            };

            req.onblocked = () => {
              if (attempt < maxAttempts) {
                const delay = 500 * attempt; // longer wait for blocked case
                // eslint-disable-next-line no-console
                console.warn(
                  `[ClearDBStore] IndexedDB delete blocked, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`
                );
                setTimeout(tryDelete, delay);
              } else {
                const msg = `[ClearDBStore] IndexedDB delete blocked after ${maxAttempts} attempts`;
                // eslint-disable-next-line no-console
                console.error(msg);
                reject(new Error(msg));
              }
            };
          }

          tryDelete();
        });

        // Clear app caches (but preserve auth state for parallel workers)

        // 1) Clear sessionStorage only (non-persistent storage)
        try {
          sessionStorage.clear();
        } catch (err) {
          console.warn("[ClearDBStore] Failed to clear sessionStorage:", err);
        }

        // 1a) Clear Practice queue-date keys.
        // These can leak in via Playwright storageState and cause Practice to render
        // an unexpected day (e.g., manual/future date) leading to "All Caught Up!".
        try {
          localStorage.removeItem("TT_PRACTICE_QUEUE_DATE");
          localStorage.removeItem("TT_PRACTICE_QUEUE_DATE_MANUAL");
        } catch (err) {
          console.warn(
            "[ClearDBStore] Failed to clear practice queue date keys:",
            err
          );
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
        } catch (err) {
          console.warn(
            "[ClearDBStore] Failed to clear sync timestamp keys:",
            err
          );
        }

        // 2) Clear CacheStorage (service-worker / workbox caches for app code)
        if (typeof caches !== "undefined") {
          try {
            const cacheNames = await caches.keys();
            // IMPORTANT: Preserve Workbox precache so offline SPA navigations (e.g. /?tab=practice)
            // can still be fulfilled by cached app-shell HTML.
            const toDelete = cacheNames.filter(
              (n) => !n.startsWith("workbox-precache-")
            );

            await Promise.all(toDelete.map((n) => caches.delete(n)));
          } catch (err) {
            console.warn("[ClearDBStore] Failed to clear CacheStorage:", err);
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
        } catch (err) {
          console.warn(
            "[ClearDBStore] Failed to clear in-memory globals:",
            err
          );
        }

        // Return so page.evaluate resolves
        return;
      } finally {
        // Always clear the flag so subsequent navigations in the same test can boot normally.
        (window as any).__ttE2eIsClearing = false;
      }
    });
  } finally {
    // Safety net: if we set the flag but never reached the in-app finally (e.g., timeout
    // before __ttTestApi exists), clear it so we don't block later init in this worker.
    if (armedE2eClearFlag) {
      try {
        await page.evaluate(() => {
          (window as any).__ttE2eIsClearing = false;
        });
      } catch {
        // ignore
      }
    }
  }

  // Most callers want to stay on-origin so they can reload and wait for fresh sync.
  // Leaving the origin can be useful when debugging teardown races, but it must be
  // opt-in because `waitForSyncComplete()` expects the app DOM to exist.
  if (opts.leaveOriginAfterClear) {
    await page.goto("about:blank");
  }
}

// NOTE: E2E lifecycle helpers (sync wait + local DB reset) live in `./local-db-lifecycle`.

// ============================================================================
// PARALLEL-SAFE SETUP FUNCTIONS (support multiple test users)
// ============================================================================

import { BASE_URL } from "../test-config";
import {
  resetLocalDbAndResync,
  waitForSyncComplete,
} from "./local-db-lifecycle";
import { getTestUserClient, type TestUser } from "./test-users";

// Cache mapping from Supabase Auth UUID -> user_ref (same value after user_profile.id elimination)
const internalUserRefCache: Map<string, string> = new Map();
const E2E_DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

let e2eSqlClient: ReturnType<typeof postgres> | null = null;

function getE2eSqlClient() {
  if (!e2eSqlClient) {
    e2eSqlClient = postgres(E2E_DATABASE_URL, { max: 1 });
  }

  return e2eSqlClient;
}

async function clearPracticeRecordForRepertoire(repertoireId: string) {
  const sql = getE2eSqlClient();

  await sql.begin(async (transaction) => {
    await transaction.unsafe(
      "SELECT set_config('app.allow_practice_record_delete', 'on', true)"
    );
    await transaction.unsafe(
      `
      DELETE FROM public.practice_record
      WHERE repertoire_ref = $1::uuid
    `,
      [repertoireId]
    );
  });
}

async function clearPracticeRecordForUser(user: TestUser) {
  const sql = getE2eSqlClient();

  await sql.begin(async (transaction) => {
    await transaction.unsafe(
      "SELECT set_config('app.allow_practice_record_delete', 'on', true)"
    );
    await transaction.unsafe(
      `
      DELETE FROM public.practice_record pr
      USING public.repertoire r
      WHERE pr.repertoire_ref = r.repertoire_id
        AND r.user_ref = $1::uuid
    `,
      [user.userId]
    );
  });
}

async function getInternalUserRef(
  _supabase: any,
  user: TestUser
): Promise<string | null> {
  // In E2E fixtures, TestUser.userId is the Supabase Auth UUID (user_profile.id PK).
  // (Supabase auth uid is available via getTestUserClient, but isn't needed here.)
  if (!internalUserRefCache.has(user.userId)) {
    internalUserRefCache.set(user.userId, user.userId);
  }
  return user.userId;
}

async function ensureUserProfileRow(user: TestUser, supabase?: any) {
  const userKey = user.email.split(".")[0];
  const client = supabase ?? (await getTestUserClient(userKey)).supabase;

  await retryTransientSetupOperation(
    `user_profile normalization for ${user.name}`,
    async () => {
      const { data: existingRows, error: queryError } = await client
        .from("user_profile")
        .select("id")
        .eq("id", user.userId)
        .limit(1);

      if (queryError) {
        throw new Error(
          `Failed to read user_profile ${user.userId} for ${user.name}: ${queryError.message}`
        );
      }

      if ((existingRows?.length ?? 0) > 0) {
        return;
      }

      const seededName = user.name.endsWith(" Test")
        ? user.name
        : `${user.name} Test`;

      const { error: insertError } = await client.from("user_profile").insert({
        id: user.userId,
        name: seededName,
        email: user.email,
        sr_alg_type: null,
        deleted: false,
        sync_version: 1,
        last_modified_at: new Date().toISOString(),
        device_id: "test-seed",
      });

      if (insertError) {
        throw new Error(
          `Failed to create user_profile ${user.userId} for ${user.name}: ${insertError.message}`
        );
      }
    }
  );
}

async function assertHasLocalRepertoires(
  page: Page,
  minCount = 1
): Promise<void> {
  const repertoireCount = await page.evaluate(async () => {
    const api = (window as any).__ttTestApi;
    if (!api || typeof api.getRepertoireCount !== "function") {
      throw new Error("__ttTestApi.getRepertoireCount is not available");
    }
    return await api.getRepertoireCount();
  });

  if (repertoireCount >= minCount) return;

  const status = await page.evaluate(() => {
    const el = document.querySelector(
      "[data-auth-initialized]"
    ) as HTMLElement | null;
    return {
      syncVersion: el?.getAttribute("data-sync-version") || "0",
      syncSuccess: el?.getAttribute("data-sync-success") || "",
      syncErrorCount: el?.getAttribute("data-sync-error-count") || "0",
      syncErrorSummary: el?.getAttribute("data-sync-error-summary") || "",
    };
  });

  throw new Error(
    `No repertoires found locally after sync (count=${repertoireCount}). syncVersion=${status.syncVersion} success=${status.syncSuccess} errors=${status.syncErrorCount} summary=${status.syncErrorSummary}`
  );
}

// Export getTestUserClient so tests can perform direct Supabase cleanup
export { getTestUserClient };

function isTransientSetupErrorMessage(message: string | undefined): boolean {
  if (!message) return false;

  const normalized = message.toLowerCase();
  return (
    normalized.includes(
      "invalid response was received from the upstream server"
    ) ||
    normalized.includes("upstream server") ||
    normalized.includes("fetch failed") ||
    normalized.includes("network") ||
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("connection")
  );
}

async function retryTransientSetupOperation<T>(
  label: string,
  operation: () => Promise<T>
): Promise<T> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isTransient = isTransientSetupErrorMessage(message);

      if (!isTransient || attempt === maxAttempts) {
        throw error;
      }

      const backoffMs = Math.min(500 * 2 ** (attempt - 1), 2000);
      const jitterMs = Math.floor(Math.random() * 150);
      const delayMs = backoffMs + jitterMs;

      console.warn(
        `Retrying ${label} after transient setup error (attempt ${attempt}/${maxAttempts}): ${message}`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`Unreachable retry state for ${label}`);
}

async function purgeExtraUserRepertoires(user: TestUser, supabase?: any) {
  const userKey = user.email.split(".")[0];
  const client = supabase ?? (await getTestUserClient(userKey)).supabase;

  const { data: extraRows, error: queryError } = await client
    .from("repertoire")
    .select("repertoire_id")
    .eq("user_ref", user.userId)
    .neq("repertoire_id", user.repertoireId);

  if (queryError) {
    throw new Error(
      `Failed to list extra repertoires for ${user.name}: ${queryError.message}`
    );
  }

  const extraRepertoireIds = (extraRows ?? [])
    .map((row: { repertoire_id?: string | null }) => row.repertoire_id)
    .filter(
      (value: string | null | undefined): value is string =>
        typeof value === "string"
    );

  if (extraRepertoireIds.length === 0) {
    return;
  }

  for (const repertoireId of extraRepertoireIds) {
    try {
      await clearPracticeRecordForRepertoire(repertoireId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to clear practice_record for extra repertoire ${repertoireId} (${user.name}): ${message}`
      );
    }
  }

  const extraRepertoireDeletes: Array<{
    table: string;
    column: string;
    extraFilter?: (query: any) => any;
  }> = [
    { table: "daily_practice_queue", column: "repertoire_ref" },
    { table: "note", column: "repertoire_ref" },
    { table: "repertoire_tune", column: "repertoire_ref" },
    {
      table: "tab_group_main_state",
      column: "repertoire_id",
      extraFilter: (query) => query.eq("user_id", user.userId),
    },
    {
      table: "table_state",
      column: "repertoire_id",
      extraFilter: (query) => query.eq("user_id", user.userId),
    },
  ];

  for (const { table, column, extraFilter } of extraRepertoireDeletes) {
    let deleteQuery = client
      .from(table)
      .delete()
      .in(column, extraRepertoireIds);
    if (extraFilter) {
      deleteQuery = extraFilter(deleteQuery);
    }
    const { error } = await deleteQuery;

    if (error) {
      throw new Error(
        `Failed to clear ${table} for extra repertoires (${user.name}): ${error.message}`
      );
    }
  }

  const { error: repertoireDeleteError } = await client
    .from("repertoire")
    .delete()
    .eq("user_ref", user.userId)
    .in("repertoire_id", extraRepertoireIds);

  if (repertoireDeleteError) {
    throw new Error(
      `Failed to delete extra repertoires for ${user.name}: ${repertoireDeleteError.message}`
    );
  }

  log.debug(
    `✅ [${user.name}] Purged ${extraRepertoireIds.length} extra repertoire(s)`
  );
}

async function normalizeUserRepertoireRow(user: TestUser, supabase?: any) {
  const userKey = user.email.split(".")[0];
  const client = supabase ?? (await getTestUserClient(userKey)).supabase;

  await ensureUserProfileRow(user, client);

  await retryTransientSetupOperation(
    `repertoire normalization for ${user.name}`,
    async () => {
      // Shared setup expects a single seeded repertoire row per fixed test user.
      // Local exploratory runs can leave additional user-owned repertoires behind.
      await purgeExtraUserRepertoires(user, client);

      const { data: existingRows, error: queryError } = await client
        .from("repertoire")
        .select("sync_version")
        .eq("repertoire_id", user.repertoireId)
        .eq("user_ref", user.userId)
        .limit(1);

      if (queryError) {
        throw new Error(
          `Failed to read repertoire ${user.repertoireId} for ${user.name}: ${queryError.message}`
        );
      }

      const existingSyncVersion = Number(existingRows?.[0]?.sync_version ?? 0);
      const nextSyncVersion =
        Number.isFinite(existingSyncVersion) && existingSyncVersion > 0
          ? existingSyncVersion + 1
          : 1;

      const { error } = await client.from("repertoire").upsert(
        {
          repertoire_id: user.repertoireId,
          user_ref: user.userId,
          name: null,
          instrument_ref: CATALOG_INSTRUMENT_IRISH_FLUTE_ID,
          // Keep deterministic setup independent from shared genre seed rows.
          // The effective repertoire genre still resolves from the instrument.
          genre_default: null,
          sr_alg_type: null,
          deleted: false,
          sync_version: nextSyncVersion,
          last_modified_at: new Date().toISOString(),
          device_id: "test-seed",
        },
        { onConflict: "repertoire_id" }
      );

      if (error) {
        throw new Error(
          `Failed to normalize repertoire ${user.repertoireId} for ${user.name}: ${error.message}`
        );
      }
    }
  );
}

async function resetUserProfileAvatar(user: TestUser, supabase?: any) {
  const userKey = user.email.split(".")[0];
  const client = supabase ?? (await getTestUserClient(userKey)).supabase;

  await ensureUserProfileRow(user, client);

  await retryTransientSetupOperation(
    `avatar reset for ${user.name}`,
    async () => {
      const { data: existingRows, error: queryError } = await client
        .from("user_profile")
        .select("sync_version")
        .eq("id", user.userId)
        .limit(1);

      if (queryError) {
        throw new Error(
          `Failed to read user_profile ${user.userId} for ${user.name}: ${queryError.message}`
        );
      }

      if ((existingRows?.length ?? 0) === 0) {
        const { data: authData, error: authError } =
          await client.auth.getUser();
        const authUserId = authData.user?.id ?? null;
        const authDetail =
          authUserId === user.userId
            ? `authenticated as expected user ${authUserId}`
            : `authenticated as ${authUserId ?? "anonymous"}, expected ${user.userId}`;

        throw new Error(
          `user_profile ${user.userId} is not visible for ${user.name}; ${authDetail}. This usually means the current Supabase project is missing the user_profile RLS policies for the UUID id column or the helper is pointed at a different project.${authError ? ` auth.getUser() error: ${authError.message}` : ""}`
        );
      }

      const existingSyncVersion = Number(existingRows?.[0]?.sync_version ?? 0);
      const nextSyncVersion =
        Number.isFinite(existingSyncVersion) && existingSyncVersion > 0
          ? existingSyncVersion + 1
          : 1;

      const { error } = await client
        .from("user_profile")
        .update({
          avatar_url: null,
          sync_version: nextSyncVersion,
          last_modified_at: new Date().toISOString(),
          device_id: "test-seed",
        })
        .eq("id", user.userId);

      if (error) {
        throw new Error(
          `Failed to reset avatar for ${user.name}: ${error.message}`
        );
      }
    }
  );
}

type DeterministicSetupOptions = {
  clearRepertoire?: boolean;
  seedRepertoire?: string[];
  scheduleTunes?: { tuneIds: string[]; daysAgo: number };
  /** Optional list of title prefixes to purge (cascade delete) before setup */
  purgeTitlePrefixes?: string[];
  /** When true, clears user-created notes and references before syncing */
  clearNotesAndReferences?: boolean;
};

const DETERMINISTIC_TABLES = [
  "daily_practice_queue",
  "practice_record",
  "tune_override",
  "prefs_scheduling_options",
  "prefs_spaced_repetition",
  "plugin",
] as const;

/**
 * Returns true when the page is currently on the TuneTrees app itself rather
 * than on a blank page or transient data URL.
 */
function isAppUrl(url: string): boolean {
  return !!url && url !== "about:blank" && !url.startsWith("data:");
}

async function collectTuneIdsForPrefixes(
  supabase: any,
  user: TestUser,
  prefixes: string[]
): Promise<string[]> {
  const allTuneIds: string[] = [];

  for (const prefix of prefixes) {
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

    for (const row of data ?? []) {
      if (row?.id) {
        allTuneIds.push(row.id);
      }
    }
  }

  return [...new Set(allTuneIds)];
}

async function deleteDependentTuneRows(
  supabase: any,
  user: TestUser,
  tuneIds: string[]
) {
  const tablesToDelete: {
    table: string;
    column: string;
    extraFilters?: (q: any) => any;
  }[] = [
    {
      table: "table_transient_data",
      column: "tune_id",
      extraFilters: (q) =>
        q.eq("user_id", user.userId).eq("repertoire_id", user.repertoireId),
    },
    {
      table: "daily_practice_queue",
      column: "tune_ref",
      extraFilters: (q) => q.eq("repertoire_ref", user.repertoireId),
    },
    {
      table: "practice_record",
      column: "tune_ref",
      extraFilters: (q) => q.eq("repertoire_ref", user.repertoireId),
    },
    {
      table: "repertoire_tune",
      column: "tune_ref",
      extraFilters: (q) => q.eq("repertoire_ref", user.repertoireId),
    },
    { table: "tune_override", column: "tune_ref" },
  ];

  for (const { table, column, extraFilters } of tablesToDelete) {
    try {
      if (table === "practice_record") {
        const { error } = await supabase.rpc(
          "e2e_delete_practice_record_by_tunes",
          {
            target_repertoire: user.repertoireId,
            tune_ids: tuneIds,
          }
        );
        if (error) {
          console.warn(
            `[${user.name}] Error deleting from ${table}: ${error.message}`
          );
        }
        continue;
      }

      let del = supabase.from(table).delete().in(column, tuneIds);
      if (extraFilters) {
        del = extraFilters(del);
      }

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
}

async function purgeTunesByTitlePrefixes(user: TestUser, prefixes: string[]) {
  try {
    const userKey = user.email.split(".")[0];
    const { supabase } = await getTestUserClient(userKey);
    const tuneIds = await collectTuneIdsForPrefixes(supabase, user, prefixes);

    if (tuneIds.length === 0) {
      return;
    }

    log.debug(
      `[${user.name}] Purging ${tuneIds.length} tune(s) matching prefixes: ${prefixes.join(", ")}`
    );
    await deleteDependentTuneRows(supabase, user, tuneIds);

    const { error: tuneDeleteError } = await supabase
      .from("tune")
      .delete()
      .in("id", tuneIds);

    if (tuneDeleteError) {
      console.warn(
        `[${user.name}] Error deleting tunes: ${tuneDeleteError.message}`
      );
      return;
    }

    log.debug(`[${user.name}] ✅ Purged test tunes: ${tuneIds.join(", ")}`);
  } catch (err: any) {
    console.warn(
      `[${user.name}] Failed purgeTitlePrefixes pass: ${err?.message || err}`
    );
  }
}

function getDeterministicTablesToVerify(
  opts: DeterministicSetupOptions
): string[] {
  const tables = [...DETERMINISTIC_TABLES];

  if (opts.clearNotesAndReferences) {
    tables.push("note", "reference");
  }

  if (opts.clearRepertoire) {
    tables.push("repertoire_tune");
  }

  return tables;
}

async function clearDeterministicUserState(
  user: TestUser,
  opts: DeterministicSetupOptions
) {
  if (opts.clearRepertoire) {
    await clearUserTable(user, "repertoire_tune");
  }

  await clearUserTable(user, "user_genre_selection");

  if (opts.clearNotesAndReferences) {
    await clearUserTable(user, "note");
    await clearUserTable(user, "reference");
  }

  for (const tableName of DETERMINISTIC_TABLES) {
    await clearUserTable(user, tableName);
  }

  await clearUserTable(user, "table_transient_data");
  await verifyTablesEmpty(user, getDeterministicTablesToVerify(opts));
  await normalizeUserRepertoireRow(user);
  await resetUserProfileAvatar(user);
}

async function scheduleDeterministicTunes(
  user: TestUser,
  scheduleTunes: DeterministicSetupOptions["scheduleTunes"]
) {
  if (!scheduleTunes) {
    return;
  }

  const userKey = user.email.split(".")[0];
  const { supabase } = await getTestUserClient(userKey);
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - scheduleTunes.daysAgo);
  const scheduledDateStr = pastDate.toISOString();

  for (const tuneId of scheduleTunes.tuneIds) {
    const { error } = await supabase
      .from("repertoire_tune")
      .update({ scheduled: scheduledDateStr })
      .eq("repertoire_ref", user.repertoireId)
      .eq("tune_ref", tuneId);

    if (error) {
      throw new Error(`Failed to schedule tune ${tuneId}: ${error.message}`);
    }
  }
}

async function ensureDeterministicSetupPageReady(page: Page, currentUrl: string) {
  if (isAppUrl(currentUrl)) {
    return;
  }

  await page.goto(`${BASE_URL}`);
  await page.waitForLoadState("domcontentloaded");
}

/**
 * Parallel-safe version of setupDeterministicTest
 * Sets up a deterministic test state for a specific user
 */
export async function setupDeterministicTestParallel(
  page: Page,
  user: TestUser,
  opts: DeterministicSetupOptions = {}
) {
  log.debug(`🔧 [${user.name}] Setting up deterministic test state...`);

  // IMPORTANT: Avoid racing the running app's sync engine while clearing remote tables.
  // If the app is already loaded, temporarily force offline so it can't re-upload rows
  // while we clear/verify deterministic state.
  const currentUrl = page.url();
  const shouldIsolateSync = isAppUrl(currentUrl);
  let setupSucceeded = false;
  if (shouldIsolateSync) {
    await page.context().setOffline(true);
  }

  try {
    if (opts.purgeTitlePrefixes && opts.purgeTitlePrefixes.length > 0) {
      await purgeTunesByTitlePrefixes(user, opts.purgeTitlePrefixes);
    }

    await clearDeterministicUserState(user, opts);

    if (opts.seedRepertoire && opts.seedRepertoire.length > 0) {
      await seedUserRepertoire(user, opts.seedRepertoire);
    }

    await scheduleDeterministicTunes(user, opts.scheduleTunes);
    await ensureDeterministicSetupPageReady(page, currentUrl);
    setupSucceeded = true;
  } finally {
    if (shouldIsolateSync) {
      if (!setupSucceeded) {
        // Best-effort recovery only: move away from the running app before
        // restoring network so a partially reset page cannot immediately sync.
        await page.goto("about:blank").catch((error) => {
          log.warn(
            `[${user.name}] Failed to navigate away from the app during setup recovery:`,
            error
          );
        });
      }
      await page.context().setOffline(false);
    }
  }

  await resetLocalDbAndResync(page);

  log.debug(`✅ [${user.name}] Deterministic test state ready`);
}

// clearUserRepertoire removed; use clearUserTable(user, "repertoire_tune") + verifyTablesEmpty

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

  // Verify repertoire_tune is empty before seeding (consistent helper)
  if (preCheck) {
    await verifyTablesEmpty(user, ["repertoire_tune"], supabase);
  }

  const maxAttempts = 5;
  for (const tuneId of tuneIds) {
    let attempt = 0;
    while (true) {
      attempt++;
      const { error } = await supabase
        .from("repertoire_tune")
        .upsert({
          repertoire_ref: user.repertoireId,
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
        .eq("repertoire_ref", user.repertoireId)
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
        .from("repertoire_tune")
        .select("*", { count: "exact", head: true })
        .eq("repertoire_ref", user.repertoireId)
        .in("tune_ref", tuneIds);

      if (error) {
        console.warn(
          `[${user.name}] Transient error reading repertoire_tune count, retrying:`,
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
        `⚠️ [${user.name}] Timed out waiting for repertoire_tune to contain ${tuneIds.length} rows`
      );
    }
  }

  log.debug(`✅ [${user.name}] Seeded ${tuneIds.length} tunes in repertoire`);
}

function applyTableQueryFilters<
  TQuery extends { eq: (column: string, value: unknown) => TQuery },
>(tableName: string, query: TQuery, user: TestUser) {
  if (tableName === "daily_practice_queue") {
    // Belt-and-suspenders: filter by both repertoire and user for safety
    query = query
      .eq("repertoire_ref", user.repertoireId)
      .eq("user_ref", user.userId);
  } else if (tableName === "practice_record") {
    // practice_record is keyed by repertoire_ref
    query = query.eq("repertoire_ref", user.repertoireId);
  } else if (tableName === "repertoire_tune") {
    // repertoire_tune rows are keyed by repertoire_ref; no user_ref column
    query = query.eq("repertoire_ref", user.repertoireId);
  } else if (tableName === "table_transient_data") {
    query = query.eq("user_id", user.userId);
  } else if (tableName === "prefs_scheduling_options") {
    // prefs_scheduling_options is keyed by user_id (not user_ref)
    query = query.eq("user_id", user.userId);
  } else if (tableName === "prefs_spaced_repetition") {
    // prefs_spaced_repetition is keyed by user_id (not user_ref)
    query = query.eq("user_id", user.userId);
  } else if (tableName === "user_genre_selection") {
    // user_genre_selection is keyed by user_id (not user_ref)
    query = query.eq("user_id", user.userId);
  } else if (tableName === "tune_override") {
    // tune_override.user_ref references user_profile.id (Supabase Auth UUID)
    const cached = internalUserRefCache.get(user.userId);
    if (cached) {
      query = query.eq("user_ref", cached);
    } else {
      // Fallback: use userId directly (which IS the Supabase Auth UUID)
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

  const timeoutMs = 20000; // increase timeout to reduce flake
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

        // If something re-inserted rows (e.g. a still-running client sync), try clearing again.
        // This is safe because RLS prevents us from touching other users' rows.
        await clearUserTable(user, tableName);
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
    try {
      await clearPracticeRecordForUser(user);
    } catch (practiceRecordError) {
      const message =
        practiceRecordError instanceof Error
          ? practiceRecordError.message
          : String(practiceRecordError);
      console.warn(
        `[${user.name}] Failed to clear practice_record via direct Postgres cleanup: ${message}`
      );
      error = practiceRecordError;
    }
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

  // Always ensure we're online at the start of setup.
  // Browser-context offline state is sticky across tests within a worker.
  await page.context().setOffline(false);

  // Avoid racing the app's sync engine while we clear/seed remote tables.
  const currentUrlBeforeSetup = page.url();
  const shouldIsolateSync =
    !!currentUrlBeforeSetup &&
    currentUrlBeforeSetup !== "about:blank" &&
    !currentUrlBeforeSetup.startsWith("data:");
  if (shouldIsolateSync) {
    await page.context().setOffline(true);
  }

  try {
    // 1. Clear practice-specific tables
    await clearUserTable(user, "practice_record");
    await clearUserTable(user, "daily_practice_queue");
    await clearUserTable(user, "table_transient_data");
    await clearUserTable(user, "tune_override");
    await clearUserTable(user, "prefs_scheduling_options");
    await clearUserTable(user, "prefs_spaced_repetition");
    await clearUserTable(user, "plugin");

    // 2. Reset repertoire
    await clearUserTable(user, "repertoire_tune");
    await clearUserTable(user, "user_genre_selection");

    await verifyTablesEmpty(user, [
      "practice_record",
      "daily_practice_queue",
      "table_transient_data",
      "tune_override",
      "prefs_scheduling_options",
      "prefs_spaced_repetition",
      "plugin",
      "repertoire_tune",
      "user_genre_selection",
    ]);
    await normalizeUserRepertoireRow(user);

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
          .from("repertoire_tune")
          .update({ scheduled: scheduleDateStr })
          .eq("repertoire_ref", user.repertoireId)
          .eq("tune_ref", tuneId);

        if (error) {
          console.warn(
            `[${user.name}] Failed to schedule tune ${tuneId}: ${error.message}`
          );
        }
      }
    }
  } finally {
    if (shouldIsolateSync) {
      await page.context().setOffline(false);
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
    await page.waitForLoadState("domcontentloaded");
  }

  // 4-5) Reset local DB and trigger a fresh sync from Supabase.
  await resetLocalDbAndResync(page);

  // Practice tests should not inherit a cached queue date from auth storageState.
  // Those keys can point the UI at a stale/future queue window and surface an
  // incorrect "All Caught Up!" state even when setup just seeded due tunes.
  await page.evaluate(() => {
    localStorage.removeItem("TT_PRACTICE_QUEUE_DATE");
    localStorage.removeItem("TT_PRACTICE_QUEUE_DATE_MANUAL");
  });

  // 6. Navigate to starting tab (skip if already active)
  await navigateToTabForTest(page, startTab);

  // 7. Ensure Practice tab is rendered before tests start interacting.
  // NOTE: When there are no tunes due (or repertoire is empty), the app shows an empty-state
  // message and does not render the scheduled grid table.
  if (startTab === "practice") {
    await expect(page.getByTestId("practice-columns-button")).toBeVisible({
      timeout: 15000,
    });

    if (repertoireTunes.length > 0) {
      // For practice-driven scenarios we expect at least one scheduled tune row (and thus at least
      // one recall-eval control) to exist.
      const practiceGrid = page.getByTestId("tunes-grid-scheduled");
      const waitForPracticeQueueReady = async (timeoutMs: number) => {
        await expect(practiceGrid).toBeVisible({ timeout: timeoutMs });

        // Wait for at least one recall-eval control to appear
        await expect
          .poll(
            async () => {
              return await practiceGrid
                .getByTestId(/^recall-eval-[0-9a-f-]+$/i)
                .count();
            },
            { timeout: timeoutMs, intervals: [200, 500, 1000] }
          )
          .toBeGreaterThan(0);

        // CRITICAL: Additional wait for queue generation resource to complete.
        // The grid renders when practice_list_staged has data, but the daily_practice_queue
        // table is populated asynchronously via a SolidJS createResource (ensureDailyQueue).
        // In slow CI environments, the queue resource may still be initializing when the grid appears.
        // Without this wait, flashcard tests proceed with an empty queue and fail with "element(s) not found".
        // Wait for count to stabilize (same value twice in a row = queue ready)
        let lastCount = 0;
        let stableCount = 0;
        await expect
          .poll(
            async () => {
              const currentCount = await practiceGrid
                .getByTestId(/^recall-eval-[0-9a-f-]+$/i)
                .count();
              if (currentCount === lastCount && currentCount > 0) {
                stableCount++;
              } else {
                stableCount = 0;
              }
              lastCount = currentCount;
              return stableCount >= 2; // Same count twice = stable
            },
            { timeout: timeoutMs, intervals: [500, 1000, 2000] }
          )
          .toBeTruthy();

        return lastCount;
      };

      let readyCount: number;
      try {
        readyCount = await waitForPracticeQueueReady(25000);
      } catch {
        const [loadingVisible, emptyVisible] = await Promise.all([
          page
            .getByText("Loading practice queue...")
            .isVisible()
            .catch(() => false),
          page
            .getByText("All Caught Up!")
            .isVisible()
            .catch(() => false),
        ]);

        console.warn(
          `[${user.name}] Practice grid did not become ready during setup; forcing sync down and retrying.`,
          { loadingVisible, emptyVisible }
        );

        await page.evaluate(async () => {
          const forceSyncDown = (window as any).__forceSyncDownForTest;
          if (typeof forceSyncDown === "function") {
            await forceSyncDown();
          }
        });
        await page
          .waitForLoadState("networkidle", { timeout: 15000 })
          .catch(() => undefined);
        await expect(page.getByTestId("practice-columns-button")).toBeVisible({
          timeout: 15000,
        });

        readyCount = await waitForPracticeQueueReady(30000);
      }

      log.debug(
        `[${user.name}] Queue ready: ${readyCount} tunes in practice grid`
      );

      // Some tests later simulate a fresh device by wiping local SQLite and
      // re-syncing from Supabase. When this helper explicitly seeded a due queue,
      // flush that queue upstream so the fresh-device step sees the same latest
      // queue window instead of silently losing it with the local wipe.
      if (scheduleDaysAgo !== undefined) {
        await page.evaluate(async () => {
          const forceSyncUp = (window as any).__forceSyncUpForTest;
          if (typeof forceSyncUp !== "function") {
            throw new Error("__forceSyncUpForTest not available");
          }
          await forceSyncUp();
        });
      }
    }
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

  // Ensure online state before setup (offline state is sticky across tests).
  await page.context().setOffline(false);

  // 1. Clear practice state
  await clearUserTable(user, "practice_record");
  await clearUserTable(user, "daily_practice_queue");
  await clearUserTable(user, "table_transient_data");
  await clearUserTable(user, "tune_override");
  await clearUserTable(user, "prefs_scheduling_options");
  await clearUserTable(user, "prefs_spaced_repetition");
  await clearUserTable(user, "plugin");

  // 2. Reset repertoire
  await clearUserTable(user, "repertoire_tune");
  await clearUserTable(user, "user_genre_selection");

  await verifyTablesEmpty(user, [
    "practice_record",
    "daily_practice_queue",
    "table_transient_data",
    "tune_override",
    "prefs_scheduling_options",
    "prefs_spaced_repetition",
    "plugin",
    "repertoire_tune",
    "user_genre_selection",
  ]);
  await normalizeUserRepertoireRow(user);

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
        .from("repertoire_tune")
        .update({ scheduled: scheduleDateStr })
        .eq("tune_ref", tuneId)
        .eq("repertoire_ref", user.repertoireId);

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
    const text = msg.text();
    // Always surface sync diagnostics in CI/local logs.
    if (text.startsWith("[SyncDiag]")) {
      console.log(`[Browser] ${text}`);
      return;
    }

    // Always surface TopNav DB diagnostics in CI/local logs.
    if (text.startsWith("[TopNavDiag]")) {
      console.log(`[Browser] ${text}`);
      return;
    }

    // Always surface DB-init diagnostics in CI/local logs.
    if (text.startsWith("[DbInitDiag]")) {
      console.log(`[Browser] ${text}`);
      return;
    }

    // E2E-only DB persistence telemetry should be visible, but not treated as an error.
    if (text.startsWith("🔬 [E2E Persist")) {
      console.log(`[Browser] ${text}`);
      return;
    }

    if (msg.type() === "error") {
      console.error(`[Browser Error] ${text}`);
    } else {
      if (
        process.env.E2E_TEST_SETUP_DEBUG === "true" ||
        process.env.E2E_TEST_SETUP_DEBUG === "1"
      ) {
        console.log(`[Browser] ${text}`);
      }
    }
  });

  const currentUrl = page.url();
  if (
    !currentUrl ||
    currentUrl === "about:blank" ||
    currentUrl.startsWith("data:")
  ) {
    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState("domcontentloaded");
  }

  // 5-6) Reset local DB and trigger a fresh sync from Supabase.
  await resetLocalDbAndResync(page);

  // If repertoires didn't sync down, onboarding modal will block UI clicks.
  await assertHasLocalRepertoires(page, 1);

  // 7. Navigate to repertoire tab
  await navigateToTabForTest(page, "repertoire");
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
    "prefs_spaced_repetition",
    "repertoire_tune",
    "plugin",
  ];

  // 1. Clear only user's repertoire (keep catalog!)
  if (emptyRepertoire) {
    await clearUserTable(user, "repertoire_tune");
    whichTables = [...whichTables, "repertoire_tune"];
  }
  await clearUserTable(user, "user_genre_selection");

  // 2. Clear practice state
  await clearUserTable(user, "practice_record");
  await clearUserTable(user, "daily_practice_queue");
  await clearUserTable(user, "table_transient_data");
  await clearUserTable(user, "tune_override");
  await clearUserTable(user, "prefs_scheduling_options");
  await clearUserTable(user, "prefs_spaced_repetition");
  await clearUserTable(user, "plugin");

  await verifyTablesEmpty(user, whichTables);
  await normalizeUserRepertoireRow(user);

  // 2b. Optionally schedule tunes if not emptying repertoire and requested
  if (!emptyRepertoire && scheduleTunes) {
    const userKey = user.email.split(".")[0];
    const { supabase } = await getTestUserClient(userKey);
    const base = scheduleBaseDate ? new Date(scheduleBaseDate) : new Date();
    base.setDate(base.getDate() - scheduleDaysAgo);
    const scheduleDateStr = base.toISOString();

    // Fetch repertoire tunes for this repertoire
    const { data: repRows, error: repErr } = await supabase
      .from("repertoire_tune")
      .select("tune_ref")
      .eq("repertoire_ref", user.repertoireId);
    if (!repErr && repRows) {
      for (const row of repRows) {
        const { error } = await supabase
          .from("repertoire_tune")
          .update({ scheduled: scheduleDateStr })
          .eq("repertoire_ref", user.repertoireId)
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

  // 4-5) Reset local DB and trigger a fresh sync from Supabase.
  await resetLocalDbAndResync(page);

  // 6. Wait for repertoire dropdown to show correct data
  const repertoireLocator = page.getByTestId("repertoire-dropdown-button");
  await repertoireLocator.waitFor({ state: "visible", timeout: 10000 });

  const expectedTitle = `Irish Flute`;
  await expect(repertoireLocator).toContainText(expectedTitle, {
    timeout: 10000,
  });

  log.debug(`✅ [${user.name}] Repertoire title matched: ${expectedTitle}`);

  // 6. Navigate to starting tab
  await navigateToTabForTest(page, startTab);
  await page.waitForTimeout(500);

  const catalogOverflowButton = page.getByTestId("catalog-columns-button");
  await catalogOverflowButton.waitFor({
    state: "visible",
    timeout: 10000,
  });

  const catalogGrid = page.getByTestId("tunes-grid-catalog");
  await catalogGrid.waitFor({ state: "visible", timeout: 10000 });

  const catalogRows = page.locator(
    '[data-testid="tunes-grid-catalog"] tbody tr[data-index], [data-testid="tunes-grid-catalog"] li[data-testid^="stacked-item-"]'
  );

  await page.waitForTimeout(2000);

  let catalogRowCount = 0;
  try {
    await expect
      .poll(
        async () => {
          catalogRowCount = await catalogRows.count().catch(() => 0);
          return catalogRowCount;
        },
        {
          timeout: 10000,
          intervals: [200, 500, 1000],
        }
      )
      .toBeGreaterThan(0);
  } catch {
    const snapshotName = `e2e/tests/artifacts/catalog-missing-${user.email.split(".")[0]}-${Date.now()}.png`;
    try {
      await page.screenshot({ path: snapshotName, fullPage: true });
      console.error(`📸 Snapshot saved: ${snapshotName}`);
    } catch (err) {
      console.warn("⚠️ Failed to save snapshot:", String(err));
    }
    throw new Error(
      `Catalog grid did not render any rows; snapshot saved as ${snapshotName}`
    );
  }

  // await tuneCountComponent.waitFor({
  //   state: "visible",
  //   timeout: 10000,
  // });

  await page.waitForTimeout(500);

  log.debug(`✅ [${user.name}] setupForCatalogTests Ready on ${startTab} tab`);
}
