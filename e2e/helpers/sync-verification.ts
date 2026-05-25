/**
 * Sync Verification Helpers
 *
 * Utilities for verifying sync status and data integrity
 * between local SQLite WASM and Supabase.
 *
 * @module e2e/helpers/sync-verification
 */

import { expect, type Page } from "@playwright/test";
import log from "loglevel";
import { BASE_URL } from "../test-config";

log.setLevel("info");

let lastKnownAppUrl: string | null = null;

function isRealAppUrl(currentUrl: string, baseUrl: string): boolean {
  return (
    currentUrl.startsWith(baseUrl) &&
    !currentUrl.includes("e2e-origin.html") &&
    currentUrl !== "about:blank" &&
    !currentUrl.startsWith("data:")
  );
}

async function waitForTestApi(page: Page): Promise<void> {
  await page.waitForFunction(() => !!(window as any).__ttTestApi, {
    timeout: 20_000,
  });
}

async function waitForInitializedApp(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const url = globalThis.location.href;
      const api = (window as any).__ttTestApi;
      const authMarker = document.querySelector<HTMLElement>(
        "[data-auth-initialized]"
      );
      const isAuthInitialized = authMarker?.dataset.authInitialized;

      return (
        Boolean(api) &&
        isAuthInitialized === "true" &&
        !url.includes("e2e-origin.html") &&
        url !== "about:blank" &&
        !url.startsWith("data:")
      );
    },
    { timeout: 20_000 }
  );
}

/**
 * Navigate back to the app if the current page is not on the app URL.
 * Rapid offline/online toggling can cause the service worker or app to
 * redirect to the e2e-origin fallback page.
 */
async function ensureAppPage(page: Page): Promise<void> {
  const currentUrl = page.url();
  const baseUrl = String(BASE_URL).replace(/\/+$/, "");

  // Preserve the last real app route so recovery doesn't reset the test back
  // to the root page while sync is still settling after connectivity changes.
  if (isRealAppUrl(currentUrl, baseUrl)) {
    try {
      await waitForInitializedApp(page);
      lastKnownAppUrl = page.url();
      return;
    } catch {
      log.info(
        `🔁 App URL ${currentUrl} is present but not initialized yet, forcing route recovery...`
      );
    }
  }

  const targetUrl = lastKnownAppUrl ?? `${baseUrl}/?tab=practice`;

  // The offline/online transition can bounce through e2e-origin.html more
  // than once before the real app regains control, so retry recovery a few
  // times instead of polling a helper page that has no test API attached.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    log.info(
      `🔁 Redirected to ${page.url()}, navigating back to app at ${targetUrl} (attempt ${attempt + 1}/3)...`
    );
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await waitForTestApi(page);
    await waitForInitializedApp(page);

    const recoveredUrl = page.url();
    if (isRealAppUrl(recoveredUrl, baseUrl)) {
      lastKnownAppUrl = recoveredUrl;
      return;
    }

    await page.waitForTimeout(1000);
  }

  throw new Error(
    `App did not recover from redirect helper page after 3 attempts (current URL: ${page.url()}).`
  );
}

async function readSyncOutboxCount(page: Page): Promise<number> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await ensureAppPage(page);

    try {
      return await page.evaluate(async () => {
        const api = (window as any).__ttTestApi;
        if (!api) throw new Error("__ttTestApi not available");
        return await api.getSyncOutboxCount();
      });
    } catch (error) {
      // Reconnect flows can still bounce through the origin helper after the
      // previous recovery step. Retry once so sync polling reads from the real
      // app instance instead of failing on a transient helper-page swap.
      if (attempt === 1) {
        throw error;
      }
      log.info(
        "🔁 __ttTestApi disappeared during sync poll, retrying app recovery..."
      );
      await page.waitForTimeout(500);
    }
  }

  throw new Error(
    "Failed to read sync outbox count after app recovery retries."
  );
}

async function readSyncState(page: Page): Promise<{
  count: number;
  isSyncComplete: boolean;
  url: string;
  syncErrorCount: string;
  syncErrorSummary: string;
  syncSuccess: string;
  pendingItems: Array<{
    tableName: string;
    rowId: string;
    operation: string;
    status: string;
    attempts: number;
    lastError: string | null;
  }>;
}> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await ensureAppPage(page);

    try {
      return await page.evaluate(async () => {
        const api = (window as any).__ttTestApi;
        if (!api) throw new Error("__ttTestApi not available");

        return {
          count: await api.getSyncOutboxCount(),
          isSyncComplete: Boolean(api.isSyncComplete?.() ?? false),
          url: globalThis.location.href,
          pendingItems: await api.getPendingSyncOutboxItems?.(),
          syncErrorCount:
            document.querySelector<HTMLElement>("[data-auth-initialized]")
              ?.dataset.syncErrorCount ?? "",
          syncErrorSummary:
            document.querySelector<HTMLElement>("[data-auth-initialized]")
              ?.dataset.syncErrorSummary ?? "",
          syncSuccess:
            document.querySelector<HTMLElement>("[data-auth-initialized]")
              ?.dataset.syncSuccess ?? "",
        };
      });
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }
      log.info("🔁 Sync state read lost the app page, retrying recovery...");
      await page.waitForTimeout(500);
    }
  }

  throw new Error("Failed to read sync state after app recovery retries.");
}

/**
 * Wait for sync to complete
 * Polls the sync outbox until empty (all changes synced)
 *
 * @param page - Playwright page instance
 * @param timeoutMs - Maximum time to wait for sync
 * @param logPendingItems - When true, emit small pending-item snapshots for diagnostics
 * @param skipVerifyEmpty - When true, allow timeout fallback if sync is otherwise idle/successful
 */
export async function waitForSync(
  page: Page,
  timeoutMs: number = 30000,
  logPendingItems = false,
  skipVerifyEmpty = false
): Promise<void> {
  log.info("⏳ Waiting for sync to complete...");

  const startTime = Date.now();
  const pollInterval = 250;
  const zeroStableForMs = 1000;
  const stalledCountRetryMs = 5000;
  const idleWithPendingRetryMs = 1000;
  const maxManualRetries = 2;
  let lastCount = -1;
  let zeroStableMs = 0;
  let stalledCountMs = 0;
  let idleWithPendingMs = 0;
  let manualRetryCount = 0;

  while (Date.now() - startTime < timeoutMs) {
    const {
      count,
      isSyncComplete,
      url,
      syncErrorCount,
      syncErrorSummary,
      syncSuccess,
      pendingItems,
    } = await readSyncState(page);

    if (count !== lastCount) {
      log.info(
        `🔄 Sync outbox count: ${count} (idle=${isSyncComplete}, url=${url}, syncSuccess=${syncSuccess}, syncErrorCount=${syncErrorCount})`
      );
      lastCount = count;
      stalledCountMs = 0;
      idleWithPendingMs = 0;
    } else if (count > 0) {
      stalledCountMs += pollInterval;
      if (isSyncComplete) {
        idleWithPendingMs += pollInterval;
      } else {
        idleWithPendingMs = 0;
      }
    }

    if (syncErrorSummary) {
      log.info(`⚠️ Sync error summary: ${syncErrorSummary}`);
    }

    if (logPendingItems && count > 0 && count <= 3 && pendingItems?.length) {
      log.info(`📦 Pending sync items: ${JSON.stringify(pendingItems)}`);
    }

    if (count === 0) {
      zeroStableMs += pollInterval;
      stalledCountMs = 0;
      idleWithPendingMs = 0;
      if (zeroStableMs >= zeroStableForMs) {
        const elapsed = Date.now() - startTime;
        log.info(`✅ Sync completed in ${elapsed}ms`);
        return;
      }
    } else {
      zeroStableMs = 0;

      // The app does not currently expose a trustworthy in-flight sync flag for
      // E2E. Retigger only when the queue count has genuinely stalled for a
      // while; otherwise repeated manual sync calls can thrash long-running
      // uploads when the full preview suite is under parallel load.
      if (
        stalledCountMs >= stalledCountRetryMs &&
        manualRetryCount < maxManualRetries
      ) {
        manualRetryCount += 1;
        log.info(
          `🔄 Sync count stalled at ${count}; retriggering manual sync (${manualRetryCount}/${maxManualRetries})...`
        );
        await triggerManualSync(page);
        stalledCountMs = 0;
        idleWithPendingMs = 0;
      } else if (
        isSyncComplete &&
        idleWithPendingMs >= idleWithPendingRetryMs &&
        manualRetryCount < maxManualRetries
      ) {
        manualRetryCount += 1;
        log.info(
          `🔄 Sync is idle with ${count} pending items; retriggering manual sync (${manualRetryCount}/${maxManualRetries})...`
        );
        await triggerManualSync(page);
        stalledCountMs = 0;
        idleWithPendingMs = 0;
      }
    }

    await page.waitForTimeout(pollInterval);
  }

  // Timeout - log final state
  const finalState = await readSyncState(page);

  const timeoutMessage =
    `Sync did not complete within ${timeoutMs}ms. ${finalState.count} items still pending in outbox (idle=${finalState.isSyncComplete}, url=${finalState.url}, syncSuccess=${finalState.syncSuccess}, syncErrorCount=${finalState.syncErrorCount}, syncErrorSummary=${finalState.syncErrorSummary || "none"}). Sync may not be running (check if offline or network issues).` +
    ` Pending items: ${JSON.stringify(finalState.pendingItems ?? [])}`;

  if (skipVerifyEmpty) {
    const hasSyncErrors = Number(finalState.syncErrorCount || "0") > 0;
    const syncSucceeded = finalState.syncSuccess === "true";

    if (finalState.isSyncComplete && syncSucceeded && !hasSyncErrors) {
      log.info(`⚠️ ${timeoutMessage}`);
      log.info(
        "⚠️ Continuing despite pending outbox rows because skipVerifyEmpty=true and sync otherwise reports success."
      );
      return;
    }
  }

  throw new Error(timeoutMessage);
}

/**
 * Verify sync_outbox table is empty (all changes synced)
 *
 * @param page - Playwright page instance
 */
export async function verifySyncOutboxEmpty(page: Page): Promise<void> {
  log.info("🔍 Verifying sync_outbox is empty...");

  await expect
    .poll(async () => await readSyncOutboxCount(page), {
      timeout: 10000,
      intervals: [200, 250, 500, 1000],
      message: "sync_outbox did not become empty",
    })
    .toBe(0);

  log.info("✅ sync_outbox is empty");
}

/**
 * Verify sync_outbox has expected number of pending changes
 *
 * @param page - Playwright page instance
 * @param expectedCount - Expected number of pending sync items
 */
export async function verifySyncOutboxCount(
  page: Page,
  expectedCount: number
): Promise<void> {
  log.info(`🔍 Verifying sync_outbox has ${expectedCount} items...`);

  const count = await readSyncOutboxCount(page);

  expect(count).toBe(expectedCount);
  log.info(`✅ sync_outbox has ${expectedCount} items`);
}

/**
 * Get sync_outbox count
 *
 * @param page - Playwright page instance
 * @returns Number of pending sync items
 */
export async function getSyncOutboxCount(page: Page): Promise<number> {
  return await readSyncOutboxCount(page);
}

/**
 * Trigger manual sync
 *
 * @param page - Playwright page instance
 */
export async function triggerManualSync(page: Page): Promise<void> {
  log.info("🔄 Triggering manual sync...");

  await ensureAppPage(page);

  const usedTestHook = await page
    .evaluate(async () => {
      const forceSyncUp = (window as any).__forceSyncUpForTest;
      if (!forceSyncUp) {
        return false;
      }
      await forceSyncUp();
      return true;
    })
    .catch(() => false);

  if (!usedTestHook) {
    const databaseStatusButton = page.getByTestId("database-status-button");
    const databaseDropdownPanel = page.getByTestId("database-dropdown-panel");
    const forceSyncUpButton = page.getByRole("button", {
      name: /force sync up/i,
    });
    const allowDeletesButton = page.getByRole("button", {
      name: "Upload (allow deletions)",
    });

    await databaseStatusButton.click();
    await databaseDropdownPanel.waitFor({ state: "visible", timeout: 5_000 });
    await forceSyncUpButton.click();

    if (
      await allowDeletesButton.isVisible({ timeout: 1_500 }).catch(() => false)
    ) {
      await allowDeletesButton.click();
    }
  }

  // Wait for network to settle
  await page.waitForLoadState("networkidle", { timeout: 15000 });
  log.info("✅ Manual sync triggered");
}

/**
 * Verify Supabase record exists and matches expected data
 *
 * @param page - Playwright page instance
 * @param table - Table name
 * @param recordId - Record ID to verify
 * @param expectedData - Expected record data (partial match)
 */
export async function verifySupabaseRecord(
  page: Page,
  table: string,
  recordId: string | number,
  expectedData: Record<string, any>
): Promise<void> {
  log.info(`🔍 Verifying Supabase record in ${table}[${recordId}]...`);

  const record = await page.evaluate(
    async ({ table, recordId }) => {
      const api = (window as any).__ttTestApi;
      if (!api) throw new Error("__ttTestApi not available");
      return await api.getSupabaseRecord(table, recordId);
    },
    { table, recordId }
  );

  expect(record).toBeTruthy();

  // Verify expected fields match
  for (const [key, value] of Object.entries(expectedData)) {
    expect(record[key]).toBe(value);
  }

  log.info("✅ Supabase record verified");
}

/**
 * Verify local SQLite record matches expected data
 *
 * @param page - Playwright page instance
 * @param table - Table name
 * @param recordId - Record ID to verify
 * @param expectedData - Expected record data (partial match)
 */
export async function verifyLocalRecord(
  page: Page,
  table: string,
  recordId: string | number,
  expectedData: Record<string, any>
): Promise<void> {
  log.info(`🔍 Verifying local SQLite record in ${table}[${recordId}]...`);

  const record = await page.evaluate(
    async ({ table, recordId }) => {
      const api = (window as any).__ttTestApi;
      if (!api) throw new Error("__ttTestApi not available");
      return await api.getLocalRecord(table, recordId);
    },
    { table, recordId }
  );

  expect(record).toBeTruthy();

  // Verify expected fields match
  for (const [key, value] of Object.entries(expectedData)) {
    expect(record[key]).toBe(value);
  }

  log.info("✅ Local SQLite record verified");
}

/**
 * Wait for sync indicator to show "syncing" state
 *
 * @param page - Playwright page instance
 * @param timeoutMs - Maximum time to wait
 */
export async function waitForSyncIndicator(
  page: Page,
  timeoutMs: number = 10000
): Promise<void> {
  log.info("⏳ Waiting for sync indicator...");

  // Look for sync status indicator (adjust selector based on actual UI)
  const syncIndicator = page.locator('[data-testid="sync-status-indicator"]');
  await syncIndicator.waitFor({ state: "visible", timeout: timeoutMs });

  log.info("✅ Sync indicator visible");
}

/**
 * Verify no sync errors occurred
 *
 * @param page - Playwright page instance
 */
export async function verifySyncSuccess(page: Page): Promise<void> {
  log.info("🔍 Verifying sync completed successfully...");

  const hasErrors = await page.evaluate(async () => {
    const api = (window as any).__ttTestApi;
    if (!api) throw new Error("__ttTestApi not available");
    return await api.getSyncErrors();
  });

  expect(hasErrors).toHaveLength(0);
  log.info("✅ No sync errors");
}
