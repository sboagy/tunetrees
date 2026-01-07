import type { Page } from "@playwright/test";
import log from "loglevel";
import { BASE_URL } from "../test-config";

export async function gotoE2eOrigin(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/e2e-origin.html`, {
    waitUntil: "domcontentloaded",
  });
}

export async function clearTunetreesClientStorage(
  page: Page,
  opts: {
    preserveAuth?: boolean;
    deleteAllIndexedDbs?: boolean;
  } = {}
): Promise<void> {
  await page.evaluate(async (options) => {
    const preserveAuth = options.preserveAuth ?? true;
    const deleteAllIndexedDbs = options.deleteAllIndexedDbs ?? false;

    (window as any).__ttE2eIsClearing = true;

    try {
      // 1) sessionStorage is always safe to clear.
      try {
        sessionStorage.clear();
      } catch (err) {
        console.warn("[E2ECleanup] Failed to clear sessionStorage:", err);
      }

      // 2) localStorage: default is preserve auth (worker storageState).
      try {
        if (!preserveAuth) {
          localStorage.clear();
        } else {
          // These can leak in via Playwright storageState and cause Practice to render
          // an unexpected day (e.g., manual/future date) leading to "All Caught Up!".
          localStorage.removeItem("TT_PRACTICE_QUEUE_DATE");
          localStorage.removeItem("TT_PRACTICE_QUEUE_DATE_MANUAL");

          // Forces full initial sync.
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
        }
      } catch (err) {
        console.warn("[E2ECleanup] Failed to clear localStorage:", err);
      }

      // 3) CacheStorage (service worker / workbox caches).
      if (typeof caches !== "undefined") {
        try {
          const cacheNames = await caches.keys();
          // Preserve Workbox precache so offline SPA navigations can still work.
          const toDelete = cacheNames.filter(
            (n) => !n.startsWith("workbox-precache-")
          );
          await Promise.all(toDelete.map((n) => caches.delete(n)));
        } catch (err) {
          console.warn("[E2ECleanup] Failed to clear CacheStorage:", err);
        }
      }

      // 4) IndexedDB: delete the sql.js persistence DB.
      const deleteDbWithRetry = async (dbName: string): Promise<void> => {
        await new Promise<void>((resolve, reject) => {
          const maxAttempts = 5;
          let attempt = 0;

          function tryDelete() {
            attempt++;
            const req = indexedDB.deleteDatabase(dbName);

            req.onsuccess = () => resolve();

            req.onerror = () => {
              if (attempt < maxAttempts) {
                const delay = 200 * attempt;
                console.warn(
                  `[E2ECleanup] IndexedDB delete error, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`,
                  req.error
                );
                setTimeout(tryDelete, delay);
              } else {
                const msg = `[E2ECleanup] IndexedDB delete failed after ${maxAttempts} attempts: ${req.error}`;
                console.error(msg);
                reject(new Error(msg));
              }
            };

            req.onblocked = () => {
              if (attempt < maxAttempts) {
                const delay = 500 * attempt;
                console.warn(
                  `[E2ECleanup] IndexedDB delete blocked, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`
                );
                setTimeout(tryDelete, delay);
              } else {
                const msg = `[E2ECleanup] IndexedDB delete blocked after ${maxAttempts} attempts`;
                console.error(msg);
                reject(new Error(msg));
              }
            };
          }

          tryDelete();
        });
      };

      if (deleteAllIndexedDbs && typeof indexedDB.databases === "function") {
        try {
          const dbs = await indexedDB.databases();
          const names = dbs.map((d) => d.name).filter((n): n is string => !!n);
          await Promise.all(names.map((n) => deleteDbWithRetry(n)));
        } catch (err) {
          console.warn(
            "[E2ECleanup] Failed to enumerate IndexedDB databases; falling back to tunetrees-storage:",
            err
          );
          await deleteDbWithRetry("tunetrees-storage");
        }
      } else {
        await deleteDbWithRetry("tunetrees-storage");
      }

      // 5) Clear any in-memory test hooks (best-effort).
      try {
        delete (window as any).__ttTestApi;
      } catch {
        /* ignore */
      }
    } finally {
      (window as any).__ttE2eIsClearing = false;
    }
  }, opts);
}

export async function waitForSyncComplete(
  page: Page,
  timeoutMs = 30000
): Promise<void> {
  const startTime = Date.now();
  let didRetryAfterFetchFailure = false;

  log.debug("⏳ Waiting for initial sync to complete...");

  const isTransientFetchFailure = (summary: string): boolean => {
    const s = summary.toLowerCase();
    return (
      s.includes("failed to fetch") ||
      // Some browsers / consoles truncate the final character in this message.
      s.includes("failed to fet") ||
      s.includes("networkerror") ||
      s.includes("load failed") ||
      s.includes("fetch")
    );
  };

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

    if (status.version >= 1 && (!status.success || status.errorCount > 0)) {
      if (
        !didRetryAfterFetchFailure &&
        isTransientFetchFailure(status.errorSummary)
      ) {
        didRetryAfterFetchFailure = true;
        log.debug(
          `⚠️ Initial sync failed with transient fetch error; reloading once to retry. ${status.errorSummary}`
        );
        await page.waitForTimeout(500);
        await page.reload({ waitUntil: "domcontentloaded" });
        continue;
      }
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

  throw new Error(
    `⚠️ Initial sync did not complete within ${timeoutMs}ms - tests may fail`
  );
}

export async function resetLocalDbAndResync(
  page: Page,
  opts: {
    preserveAuth?: boolean;
  } = {}
): Promise<void> {
  await gotoE2eOrigin(page);
  await clearTunetreesClientStorage(page, { preserveAuth: opts.preserveAuth });
  await page.goto(`${BASE_URL}`, { waitUntil: "domcontentloaded" });
  await waitForSyncComplete(page);
}
