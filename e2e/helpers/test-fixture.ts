/**
 * Test Worker Assignment
 * Automatically assigns test users to Playwright workers
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { test as base } from "@playwright/test";
import log from "loglevel";
import {
  getTestUserByWorkerIndex,
  TEST_USERS,
  type TestUser,
} from "./test-users";

export interface TestUserFixture {
  testUser: TestUser;
  testUserKey: string;
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

/**
 * Extended test with automatic user assignment based on worker index
 * Each worker gets a dedicated test user to avoid database conflicts
 * Also sets the correct auth state for the assigned user
 */
export const test = base.extend<TestUserFixture>({
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
  storageState: async ({ testUserKey, testUser }, use) => {
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

    log.debug(`🔐 Worker auth: ${authFile} (fresh)`);
    await use(authFile);
  },
});

export { expect } from "@playwright/test";

// Export test users for direct access if needed
export { TEST_USERS, getTestUserByWorkerIndex };
