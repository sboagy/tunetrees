/**
 * Test Worker Assignment
 * Automatically assigns test users to Playwright workers
 */

import { readFileSync } from "node:fs";
import type { BrowserContext, Page } from "@playwright/test";
import { test as base } from "@playwright/test";
import { isAuthFileFresh, mapAuthStateToOrigin } from "./auth-state";
import {
  clearTunetreesClientStorage,
  gotoE2eOrigin,
} from "./local-db-lifecycle";
import {
  getTestUserByWorkerIndex,
  TEST_USERS,
  type TestUser,
} from "./test-users";

export interface TestUserFixture {
  testUser: TestUser;
  testUserKey: string;
}

const E2E_CLEANUP_DIAGNOSTICS = process.env.E2E_CLEANUP_DIAGNOSTICS === "true";

function isExpectedPlaywrightTeardownError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("Test ended") ||
    msg.includes("Target closed") ||
    msg.includes("Execution context was destroyed")
  );
}

type ITuneTreesFixtures = TestUserFixture & {
  consoleLogs: string[];
  autoCleanupDb: undefined;
};

/**
 * Extended test with automatic user assignment based on worker index
 * Each worker gets a dedicated test user to avoid database conflicts
 * Also sets the correct auth state for the assigned user
 */
export const test = base.extend<ITuneTreesFixtures>({
  // Auto-cleanup: ensure we clear local IndexedDB/SQLite WASM state after every test.
  // This reduces cross-test leakage and prevents unbounded IndexedDB growth.
  autoCleanupDb: [
    async (
      { page }: { page: Page },
      use: (value: undefined) => Promise<void>
    ) => {
      await use(undefined);

      // If the test never loaded the app, skip cleanup quickly.
      try {
        if (page.isClosed()) return;

        // Canonical cleanup: hop to a same-origin static page (unloads the SPA),
        // then clear IndexedDB/SQLite WASM persistence and other transient storage.
        await gotoE2eOrigin(page);
        await clearTunetreesClientStorage(page);
      } catch (e) {
        // This fixture runs during teardown, when Playwright may already be
        // closing the page/context due to timeouts or failures.
        // Treat these errors as expected unless diagnostics are explicitly enabled.
        if (!isExpectedPlaywrightTeardownError(e) || E2E_CLEANUP_DIAGNOSTICS) {
          console.warn("[E2E] auto cleanup skipped/failed:", e);
          if (E2E_CLEANUP_DIAGNOSTICS && e instanceof Error && e.stack) {
            console.warn(`[E2E] auto cleanup stack:\n${e.stack}`);
          }
        }
      }
    },
    { auto: true },
  ],

  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture pattern requires empty object
  testUser: async ({}, use, testInfo) => {
    // parallelIndex is the stable active-worker slot. Playwright guarantees
    // concurrently running workers have different parallelIndex values, and a
    // restarted worker keeps the same slot instead of getting a new one.
    const user = getTestUserByWorkerIndex(testInfo.parallelIndex);
    await use(user);
  },

  testUserKey: async ({ testUser }, use) => {
    const userKey = Object.keys(TEST_USERS).find(
      (key) => TEST_USERS[key].email === testUser.email
    );

    if (!userKey || userKey.trim() === "") {
      throw new Error(
        `No test user key found for email "${testUser.email}". Available keys: ${Object.keys(TEST_USERS).join(", ")}`
      );
    }

    await use(userKey);
  },

  // Override storageState to use the assigned user's auth file (lowercase key)
  storageState: async ({ testUserKey, testUser }, use, testInfo) => {
    const authFile = `e2e/.auth/${testUserKey}.json`;

    const sourceUrl = testInfo.config.projects.find(
      (project) => project.name === "setup"
    )?.use.baseURL;
    const targetUrl = testInfo.project.use.baseURL;
    if (!sourceUrl || !targetUrl) {
      throw new Error(
        "Auth fixture requires setup and test project baseURL values."
      );
    }

    if (!isAuthFileFresh(authFile, sourceUrl, testUser.email)) {
      throw new Error(
        `Invalid authentication snapshot ${authFile}: expected ${testUser.email} at ${new URL(sourceUrl).origin} with a fresh session and compatible IndexedDB snapshot. Run the setup project again (without --no-deps); no database reset is required.`
      );
    }

    const authData = JSON.parse(readFileSync(authFile, "utf-8")) as Awaited<
      ReturnType<BrowserContext["storageState"]>
    >;
    // Preview gets a copy of the dev snapshot; never write a remapped state
    // back to the shared file used by desktop and mobile workers.
    await use(mapAuthStateToOrigin(authData, sourceUrl, targetUrl));
  },
  // Capture browser console logs and attach to test report
  consoleLogs: async ({ page }, use, testInfo) => {
    const buffer: string[] = [];
    const prefix = `[Browser][${testInfo.project.name}][w${testInfo.parallelIndex}]`;
    page.on("console", (msg) => {
      try {
        const type = msg.type();
        const text = msg.text();

        // Always surface sync diagnostics in stdout for easy log scraping.

        if (text.startsWith("[SyncDiag]")) {
          console.log(`${prefix} ${text}`);
        }

        // Always surface TopNav DB diagnostics in stdout for easy log scraping.
        if (text.startsWith("[TopNavDiag]")) {
          console.log(`${prefix} ${text}`);
        }

        // Always surface DB-init diagnostics in stdout for easy log scraping.
        if (text.startsWith("[DbInitDiag]")) {
          console.log(`${prefix} ${text}`);
        }

        // Always surface E2E persistence telemetry in stdout (informational).
        if (text.startsWith("🔬 [E2E Persist")) {
          console.log(`${prefix} ${text}`);
        }

        // Skip extremely noisy low-level logs if desired
        if (text && !text.startsWith("Downloaded DevTools")) {
          buffer.push(`[${type}] ${text}`);
        }
      } catch {
        // Ignore extraction errors
      }
    });
    await use(buffer);

    const failed = testInfo.status !== testInfo.expectedStatus;
    if (failed && buffer.length) {
      console.log(
        `${prefix} [FAILED TEST] dumping ${buffer.length} browser console line(s)`
      );
      for (const line of buffer) {
        console.log(`${prefix} ${line}`);
      }
    }

    if (buffer.length) {
      await testInfo.attach("browser-console", {
        body: buffer.join("\n"),
        contentType: "text/plain",
      });
    }
  },
});

export { expect } from "@playwright/test";

// Export test users for direct access if needed
export { getTestUserByWorkerIndex, TEST_USERS };
