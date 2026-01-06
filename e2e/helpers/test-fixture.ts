/**
 * Test Worker Assignment
 * Automatically assigns test users to Playwright workers
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import type { Page } from "@playwright/test";
import { test as base } from "@playwright/test";
import log from "loglevel";
import { clearTunetreesStorageDB } from "./practice-scenarios";
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

const AUTH_EXPIRY_MINUTES = 10080; // 7 days in minutes (matches jwt_expiry = 604800 seconds)

/**
 * Check if auth file exists and is fresh (< AUTH_EXPIRY_MINUTES old)
 */
function isAuthFresh(authFile: string, userEmail: string): boolean {
  if (!existsSync(authFile)) {
    console.log(`⚠️  Auth file missing: ${authFile}`);
    return false;
  }

  try {
    const authData = JSON.parse(readFileSync(authFile, "utf-8"));

    // Check if this auth file is for the correct user
    const origins = authData.origins || [];
    const hasUserData = origins.some((origin: any) => {
      const localStorage = origin.localStorage || [];
      return localStorage.some((item: any) => item.value?.includes(userEmail));
    });

    if (!hasUserData) {
      console.log(`⚠️  Auth file is not for ${userEmail}: ${authFile}`);
      return false;
    }

    // Skip age check in CI - files are freshly generated
    if (process.env.CI) {
      return true;
    }

    const fileStats = statSync(authFile);
    const fileAgeMinutes = (Date.now() - fileStats.mtimeMs) / 1000 / 60;

    if (fileAgeMinutes >= AUTH_EXPIRY_MINUTES) {
      console.log(
        `⚠️  Auth file is stale (${Math.round(fileAgeMinutes)} min old): ${authFile}`
      );
      return false;
    }

    return true;
  } catch (error) {
    console.log(`⚠️  Invalid auth file: ${authFile}`, error);
    return false;
  }
}

export interface TestUserFixture {
  testUser: TestUser;
  testUserKey: string;
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
  // Auto-cleanup: ensure we clear local IndexedDB/sql.js state after every test.
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

        // Signal teardown intent early to prevent app-side DB init/sync while we clear.
        // This may fail if the page is mid-navigation; ignore and proceed.
        try {
          await page.evaluate(() => {
            (window as any).__ttE2eIsClearing = true;
          });
        } catch {
          /* ignore */
        }

        // Avoid long hangs on failures that happen before the app boots.
        await page.waitForFunction(() => !!(window as any).__ttTestApi, {
          timeout: 2000,
        });

        await clearTunetreesStorageDB(page);
      } catch (e) {
        // This fixture runs during teardown, when Playwright may already be
        // closing the page/context due to timeouts or failures.
        // Treat these errors as expected unless diagnostics are explicitly enabled.
        if (!isExpectedPlaywrightTeardownError(e) || E2E_CLEANUP_DIAGNOSTICS) {
          console.warn("[E2E] auto cleanup skipped/failed:", e);
          if (E2E_CLEANUP_DIAGNOSTICS && e instanceof Error && e.stack) {
            console.warn("[E2E] auto cleanup stack:\n" + e.stack);
          }
        }
      }
    },
    { auto: true },
  ],

  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture pattern requires empty object
  testUser: async ({}, use, testInfo) => {
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

    // Check if auth file is fresh, warn if stale
    if (!isAuthFresh(authFile, testUser.email)) {
      console.log(
        `❌ STALE AUTH: ${authFile} - Run 'npm run db:local:reset' to regenerate auth files`
      );
      throw new Error(
        `Authentication expired for ${testUser.email}. Run: npm run db:local:reset`
      );
    }

    // For preview/PWA tests (port 4173), rewrite origins from dev port (5173)
    const baseUrl = testInfo.project.use.baseURL || "";
    if (baseUrl.includes("4173")) {
      const authData = JSON.parse(readFileSync(authFile, "utf-8"));

      // Rewrite all origin URLs from localhost:5173 to localhost:4173
      if (authData.origins) {
        authData.origins = authData.origins.map((origin: any) => ({
          ...origin,
          origin: origin.origin?.replace("localhost:5173", "localhost:4173"),
        }));
      }

      log.debug(
        `🔐 Worker auth: ${authFile} (rewritten for preview port 4173)`
      );
      await use(authData);
    } else {
      log.debug(`🔐 Worker auth: ${authFile} (fresh)`);
      await use(authFile);
    }
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
export { TEST_USERS, getTestUserByWorkerIndex };
