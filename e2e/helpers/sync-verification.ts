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

log.setLevel("info");

async function readSyncOutboxCount(page: Page): Promise<number> {
  return await page.evaluate(async () => {
    const api = (window as any).__ttTestApi;
    if (!api) throw new Error("__ttTestApi not available");
    return await api.getSyncOutboxCount();
  });
}

/**
 * Wait for sync to complete
 * Polls the sync outbox until empty (all changes synced)
 *
 * @param page - Playwright page instance
 * @param timeoutMs - Maximum time to wait for sync
 */
export async function waitForSync(
  page: Page,
  timeoutMs: number = 30000
): Promise<void> {
  log.info("⏳ Waiting for sync to complete...");

  const startTime = Date.now();
  const pollInterval = 250;
  const zeroStableForMs = 1000;
  let lastCount = -1;
  let zeroStableMs = 0;

  while (Date.now() - startTime < timeoutMs) {
    const count = await readSyncOutboxCount(page);

    if (count !== lastCount) {
      log.info(`🔄 Sync outbox count: ${count}`);
      lastCount = count;
    }

    if (count === 0) {
      zeroStableMs += pollInterval;
      if (zeroStableMs >= zeroStableForMs) {
        const elapsed = Date.now() - startTime;
        log.info(`✅ Sync completed in ${elapsed}ms`);
        return;
      }
    } else {
      zeroStableMs = 0;
    }

    await page.waitForTimeout(pollInterval);
  }

  // Timeout - log final state
  const finalCount = await readSyncOutboxCount(page);

  throw new Error(
    `Sync did not complete within ${timeoutMs}ms. ${finalCount} items still pending in outbox. Sync may not be running (check if offline or network issues).`
  );
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

  await page.evaluate(async () => {
    const forceSyncUp = (window as any).__forceSyncUpForTest;
    if (!forceSyncUp) throw new Error("__forceSyncUpForTest not available");
    await forceSyncUp();
  });

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
