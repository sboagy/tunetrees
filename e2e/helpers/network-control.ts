/**
 * Network Control Helpers
 *
 * Utilities for simulating offline/online states and network conditions
 * in Playwright E2E tests. Essential for testing offline-first PWA functionality.
 *
 * @module e2e/helpers/network-control
 */

import type { Page, Route } from "@playwright/test";
import log from "loglevel";

log.setLevel("info");

/**
 * Put the browser context offline
 * Simulates complete network disconnection
 *
 * @param page - Playwright page instance
 */
export async function goOffline(page: Page): Promise<void> {
  log.info("🔌 Going offline...");
  await page.context().setOffline(true);
  // Wait a bit for offline state to propagate
  await page.waitForTimeout(500);
  log.info("✅ Offline mode enabled");
}

/**
 * Restore network connectivity
 *
 * @param page - Playwright page instance
 */
export async function goOnline(page: Page): Promise<void> {
  log.info("🌐 Going online...");
  await page.context().setOffline(false);
  // Wait for network to stabilize
  await page.waitForTimeout(500);
  log.info("✅ Online mode enabled");
}

/**
 * Simulate slow network by delaying all requests
 *
 * @param page - Playwright page instance
 * @param delayMs - Delay in milliseconds to apply to each request
 * @returns Cleanup function to remove route handler
 */
export async function simulateSlowNetwork(
  page: Page,
  delayMs: number
): Promise<() => Promise<void>> {
  log.info(`🐌 Simulating slow network (${delayMs}ms delay)...`);

  const handler = async (route: Route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.continue();
  };

  await page.route("**/*", handler);

  // Return cleanup function
  return async () => {
    await page.unroute("**/*", handler);
    log.info("✅ Slow network simulation removed");
  };
}

/**
 * Simulate intermittent connection by randomly dropping requests
 *
 * @param page - Playwright page instance
 * @param dropRate - Probability (0-1) that a request will be dropped
 * @returns Cleanup function to remove route handler
 */
export async function simulateIntermittentConnection(
  page: Page,
  dropRate: number
): Promise<() => Promise<void>> {
  if (dropRate < 0 || dropRate > 1) {
    throw new Error("dropRate must be between 0 and 1");
  }

  log.info(
    `📡 Simulating intermittent connection (${dropRate * 100}% drop rate)...`
  );

  const handler = async (route: Route) => {
    if (Math.random() < dropRate) {
      log.debug(`❌ Dropping request: ${route.request().url()}`);
      await route.abort("failed");
    } else {
      await route.continue();
    }
  };

  await page.route("**/*", handler);

  // Return cleanup function
  return async () => {
    await page.unroute("**/*", handler);
    log.info("✅ Intermittent connection simulation removed");
  };
}

/**
 * Check if context is currently offline
 *
 * @param page - Playwright page instance
 * @returns true if offline, false if online
 */
export async function isOffline(page: Page): Promise<boolean> {
  return await page.evaluate(() => !navigator.onLine);
}

/**
 * Wait for network state to change
 *
 * @param page - Playwright page instance
 * @param targetState - "online" or "offline"
 * @param timeoutMs - Timeout in milliseconds
 */
export async function waitForNetworkState(
  page: Page,
  targetState: "online" | "offline",
  timeoutMs: number = 5000
): Promise<void> {
  const expectedOnline = targetState === "online";

  await page.waitForFunction(
    (expected) => navigator.onLine === expected,
    expectedOnline,
    { timeout: timeoutMs }
  );

  log.info(`✅ Network state is now: ${targetState}`);
}
