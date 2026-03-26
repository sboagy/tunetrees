/**
 * Test Worker Assignment
 * Automatically assigns test users to Playwright workers
 */

import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { test as base } from "@playwright/test";
import log from "loglevel";
import {
  CURRENT_AUTH_STATE_DB_VERSION,
  CURRENT_AUTH_STATE_SNAPSHOT_VERSION,
  readStoredAuthStateMetadata,
} from "./auth-state";
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

/** Minimum remaining validity before we consider the snapshot stale. */
const AUTH_EXPIRY_SAFETY_WINDOW_MS = 5 * 60 * 1000;

/**
 * Check if a saved auth state file is still valid. Uses the metadata written
 * by `auth.setup.ts` (JWT expiry, snapshot version, DB schema version) instead
 * of file mtime.
 */
function isAuthFresh(authFile: string): boolean {
  const metadata = readStoredAuthStateMetadata(authFile);
  if (!metadata?.hasIndexedDbSnapshot) {
    console.log(
      `⚠️  Auth file missing or has no IndexedDB snapshot: ${authFile}`
    );
    return false;
  }
  if (metadata.expiresAtMs == null) {
    console.log(`⚠️  Auth file has no expiry: ${authFile}`);
    return false;
  }
  if (metadata.snapshotVersion !== CURRENT_AUTH_STATE_SNAPSHOT_VERSION) {
    console.log(
      `⚠️  Auth snapshot version mismatch (got ${metadata.snapshotVersion}, expected ${CURRENT_AUTH_STATE_SNAPSHOT_VERSION}): ${authFile}`
    );
    return false;
  }
  if (
    CURRENT_AUTH_STATE_DB_VERSION != null &&
    metadata.dbVersion !== CURRENT_AUTH_STATE_DB_VERSION
  ) {
    console.log(
      `⚠️  Auth DB version mismatch (got ${metadata.dbVersion}, expected ${CURRENT_AUTH_STATE_DB_VERSION}): ${authFile}`
    );
    return false;
  }
  if (metadata.expiresAtMs - Date.now() <= AUTH_EXPIRY_SAFETY_WINDOW_MS) {
    const remaining = Math.round(
      (metadata.expiresAtMs - Date.now()) / 1000 / 60
    );
    console.log(
      `⚠️  Auth file token expiring soon (${remaining} min left): ${authFile}`
    );
    return false;
  }
  return true;
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

        // Canonical cleanup: hop to a same-origin static page (unloads the SPA),
        // then clear IndexedDB/sql.js persistence and other transient storage.
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
    if (!isAuthFresh(authFile)) {
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
export { TEST_USERS, getTestUserByWorkerIndex };
