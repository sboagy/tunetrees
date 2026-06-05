import type { Page } from "@playwright/test";
import log from "loglevel";
import {
  trimLeadingSlashes,
  trimTrailingSlashes,
} from "../../src/lib/utils/url";
import { BASE_URL } from "../test-config";

function getPageOrigin(page: Page): string | null {
  try {
    const url = new URL(page.url());
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

function resolveBaseUrl(page: Page, path: string = ""): string {
  const base = getPageOrigin(page) ?? String(BASE_URL);
  const normalizedBase = `${trimTrailingSlashes(base)}/`;
  const normalizedPath = trimLeadingSlashes(path);
  return new URL(normalizedPath, normalizedBase).toString();
}

function isRealAppUrl(currentUrl: string, appOrigin: string): boolean {
  const baseUrl = trimTrailingSlashes(appOrigin);
  return (
    currentUrl.startsWith(baseUrl) &&
    !currentUrl.includes("e2e-origin.html") &&
    currentUrl !== "about:blank" &&
    !currentUrl.startsWith("data:")
  );
}

function isRecoverableInitialSyncFailure(summary: string): boolean {
  const s = summary.toLowerCase();
  return (
    s.includes("failed to fetch") ||
    // Some browsers / consoles truncate the final character in this message.
    s.includes("failed to fet") ||
    s.includes("networkerror") ||
    s.includes("load failed") ||
    s.includes("fetch") ||
    s.includes("foreign key constraint failed") ||
    s.includes("sqlite_constraint_foreignkey")
  );
}

function isRecoverableNavigationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("execution context was destroyed") ||
    message.includes("cannot find context with specified id") ||
    message.includes("target closed")
  );
}

export async function gotoE2eOrigin(page: Page): Promise<void> {
  await page.goto(resolveBaseUrl(page, "e2e-origin.html"), {
    waitUntil: "domcontentloaded",
  });
}

async function clearBrowserSessionStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      sessionStorage.clear();
    } catch (err) {
      console.warn("[E2ECleanup] Failed to clear sessionStorage:", err);
    }
  });
}

async function clearBrowserLocalStorage(
  page: Page,
  preserveAuth: boolean
): Promise<void> {
  await page.evaluate((keepAuth) => {
    try {
      if (!keepAuth) {
        localStorage.clear();
        return;
      }

      localStorage.removeItem("tunetrees_device_id");
      localStorage.removeItem("TT_PRACTICE_QUEUE_DATE");
      localStorage.removeItem("TT_PRACTICE_QUEUE_DATE_MANUAL");

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
      console.warn("[E2ECleanup] Failed to clear localStorage:", err);
    }
  }, preserveAuth);
}

async function clearBrowserCacheStorage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    if (typeof caches === "undefined") {
      return;
    }

    try {
      const cacheNames = await caches.keys();
      const toDelete = cacheNames.filter(
        (name) => !name.startsWith("workbox-precache-")
      );
      await Promise.all(toDelete.map((name) => caches.delete(name)));
    } catch (err) {
      console.warn("[E2ECleanup] Failed to clear CacheStorage:", err);
    }
  });
}

async function deleteIndexedDbOnce(
  page: Page,
  dbName: string
): Promise<"deleted" | "blocked" | "error"> {
  return page.evaluate(
    (name) =>
      new Promise<"deleted" | "blocked" | "error">((resolve) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve("deleted");
        request.onerror = () => resolve("error");
        request.onblocked = () => resolve("blocked");
      }),
    dbName
  );
}

async function deleteIndexedDbWithRetry(
  page: Page,
  dbName: string
): Promise<void> {
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await deleteIndexedDbOnce(page, dbName);
    if (result === "deleted") {
      return;
    }

    const delay = result === "blocked" ? 500 * attempt : 200 * attempt;
    const label = result === "blocked" ? "blocked" : "error";
    console.warn(
      `[E2ECleanup] IndexedDB delete ${label}, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`
    );
    await page.waitForTimeout(delay);
  }

  throw new Error(
    `Failed to delete IndexedDB database "${dbName}" after ${maxAttempts} attempts`
  );
}

async function getIndexedDbNames(page: Page): Promise<string[] | null> {
  return page.evaluate(async () => {
    if (typeof indexedDB.databases !== "function") {
      return null;
    }

    const dbs = await indexedDB.databases();
    return dbs.map((db) => db.name).filter((name): name is string => !!name);
  });
}

async function clearBrowserIndexedDbs(
  page: Page,
  deleteAllIndexedDbs: boolean
): Promise<void> {
  if (!deleteAllIndexedDbs) {
    await deleteIndexedDbWithRetry(page, "tunetrees-storage");
    return;
  }

  try {
    const names = await getIndexedDbNames(page);
    if (!names) {
      await deleteIndexedDbWithRetry(page, "tunetrees-storage");
      return;
    }

    await Promise.all(
      names.map((name) => deleteIndexedDbWithRetry(page, name))
    );
  } catch (err) {
    console.warn(
      "[E2ECleanup] Failed to enumerate IndexedDB databases; falling back to tunetrees-storage:",
      err
    );
    await deleteIndexedDbWithRetry(page, "tunetrees-storage");
  }
}

async function clearBrowserTestHooks(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      delete (globalThis as any).__ttTestApi;
    } catch {
      /* ignore */
    }
  });
}

async function setBrowserE2eClearingFlag(
  page: Page,
  value: boolean
): Promise<void> {
  await page.evaluate((isClearing) => {
    (globalThis as any).__ttE2eIsClearing = isClearing;
  }, value);
}

export async function clearTunetreesClientStorage(
  page: Page,
  opts: {
    preserveAuth?: boolean;
    deleteAllIndexedDbs?: boolean;
  } = {}
): Promise<void> {
  await setBrowserE2eClearingFlag(page, true);

  try {
    await clearBrowserSessionStorage(page);
    await clearBrowserLocalStorage(page, opts.preserveAuth ?? true);
    await clearBrowserCacheStorage(page);
    await clearBrowserIndexedDbs(page, opts.deleteAllIndexedDbs ?? false);
    await clearBrowserTestHooks(page);
  } finally {
    await setBrowserE2eClearingFlag(page, false);
  }
}

export async function waitForSyncComplete(
  page: Page,
  timeoutMs = 30000
): Promise<void> {
  const startTime = Date.now();
  let didRetryAfterRecoverableFailure = false;
  let lastStatus: {
    url: string;
    version: number;
    successStr: string;
    errorCount: number;
    errorSummary: string;
    initialSyncComplete: boolean;
  } | null = null;

  log.debug("⏳ Waiting for initial sync to complete...");

  while (Date.now() - startTime < timeoutMs) {
    const appOrigin = getPageOrigin(page) ?? String(BASE_URL);

    // Initial sync status only exists on the real app page. Setup can
    // transiently bounce through e2e-origin.html while storage is being reset,
    // so recover to the app before polling instead of timing out on the helper page.
    if (!isRealAppUrl(page.url(), appOrigin)) {
      log.debug(
        `⏳ waitForSyncComplete is on ${page.url() || "<empty>"}; navigating back to app root`
      );
      await page.goto(resolveBaseUrl(page), { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(200);
      continue;
    }

    let status: {
      version: number;
      successStr: string;
      success: boolean;
      errorCount: number;
      errorSummary: string;
      initialSyncComplete: boolean;
    };

    try {
      status = await page.evaluate(() => {
        const el = document.querySelector(
          "[data-auth-initialized]"
        ) as HTMLElement | null;
        const versionStr = el?.dataset.syncVersion ?? "0";
        const successStr = el?.dataset.syncSuccess ?? "";
        const errorCountStr = el?.dataset.syncErrorCount ?? "0";
        const errorSummary = el?.dataset.syncErrorSummary ?? "";
        const initialSyncComplete = el?.dataset.initialSyncComplete === "true";

        const version = Number.parseInt(versionStr, 10) || 0;
        const errorCount = Number.parseInt(errorCountStr, 10) || 0;
        const success = successStr === "true";

        return {
          version,
          successStr,
          success,
          errorCount,
          errorSummary,
          initialSyncComplete,
        };
      });
    } catch (error) {
      if (isRecoverableNavigationError(error)) {
        log.debug(
          "⏳ waitForSyncComplete saw a transient navigation/context reset; retrying"
        );
        await page.waitForLoadState("domcontentloaded").catch(() => undefined);
        await page.waitForTimeout(200);
        continue;
      }
      throw error;
    }

    lastStatus = {
      url: page.url(),
      version: status.version,
      successStr: status.successStr,
      errorCount: status.errorCount,
      errorSummary: status.errorSummary,
      initialSyncComplete: status.initialSyncComplete,
    };

    if (status.version >= 1 && (!status.success || status.errorCount > 0)) {
      if (!didRetryAfterRecoverableFailure) {
        const summary = status.errorSummary || "";
        const canRecover = isRecoverableInitialSyncFailure(summary);
        if (canRecover) {
          didRetryAfterRecoverableFailure = true;
          log.debug(
            `⚠️ Initial sync failed with recoverable error; reloading once to retry. ${status.errorSummary}`
          );
          await page.waitForTimeout(500);
          await page.reload({ waitUntil: "domcontentloaded" });
          continue;
        }
      }
      throw new Error(
        `⚠️ Initial sync completed but failed (success='${status.successStr}', errors=${status.errorCount}). ${status.errorSummary}`
      );
    }

    if (
      status.version >= 1 &&
      status.success &&
      status.errorCount === 0 &&
      status.initialSyncComplete
    ) {
      log.debug("✅ Initial sync complete (success) detected");
      return;
    }

    await page.waitForTimeout(200);
  }

  throw new Error(
    `⚠️ Initial sync did not complete within ${timeoutMs}ms - tests may fail. Last status: ${JSON.stringify(
      lastStatus ?? { url: page.url() }
    )}`
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
  await page.goto(resolveBaseUrl(page), { waitUntil: "domcontentloaded" });
  await waitForSyncComplete(page);
}
