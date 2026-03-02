import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, ".env.local") });

const DEV_PORT = 5173; // Your standard development port
const PREVIEW_PORT = 4173; // The port for the production build
const WORKER_PORT = 8787;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./e2e", // More specific path
  testMatch: /.*\.spec\.ts/,

  outputDir: path.resolve(__dirname, "test-results"), // Example: './test-results-ci'

  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  /* BUT: Because of the recallEval issue , go ahead and retry locally 3 times also for now. */
  /* Remove local retries once recallEval issue is fixed */
  retries: process.env.CI ? 0 : 0,
  /* Enable parallel workers - each worker gets dedicated test user to avoid conflicts */
  workers: process.env.CI ? 2 : 8,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  // reporter: process.env.CI ? [["blob"], ["list"]] : [["html"], ["list"]],
  reporter: process.env.CI ? [["blob"], ["list"]] : [["list"]],
  // Global expect configuration (assertion polling timeout). Adjust as needed.
  // Increasing for debug sessions helps when stepping through code.
  expect: {
    timeout: process.env.PWDEBUG ? 300_000 : 5_000,
  },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL: `http://localhost:${DEV_PORT}/`,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    // trace: "on-first-retry",
    trace: "retain-on-failure",

    /* Record video only on failure to save disk space in CI */
    video: "retain-on-failure",

    /* Take screenshots only on failure */
    screenshot: "only-on-failure",

    // headless: true,
  },

  // Global timeout for each test (in milliseconds)
  // timeout: 120 * 1000,

  // 60 minutes (60 * 60 * 1000 ms = 3,600,000 ms = 1 hour).
  globalTimeout:
    process.env.CI || process.env.PWDEBUG ? 60 * 60 * 1000 : undefined,

  /* Configure projects for major browsers */
  projects: [
    // Setup project runs first for authenticated tests
    {
      name: "setup",
      testDir: "./e2e/setup",
      testMatch: /.*\.setup\.ts$/,
    },

    {
      name: "preview-setup",
      testDir: "./e2e/setup",
      testMatch: /.*\.setup\.ts$/,
      use: {
        baseURL: `http://localhost:${PREVIEW_PORT}`,
      },
    },

    // Auth tests run independently (no setup dependency, test login flow)
    {
      name: "chromium-auth",
      testDir: "./e2e/tests",
      testMatch: /auth-.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: { cookies: [], origins: [] }, // Start unauthenticated
      },
    },

    // Authenticated tests use saved state (per-worker via fixture)
    {
      name: "chromium",
      testDir: "./e2e/tests",
      testIgnore: /auth-.*\.spec\.ts/, // Exclude auth tests
      use: {
        ...devices["Desktop Chrome"],
        // headless: true,
        // channel: "chromium",
        // storageState is set per-worker by test-fixture.ts
        launchOptions: {
          args: [
            // "--remote-debugging-port=9222",
            // Set X (Horizontal) and Y (Vertical) coordinates
            // Example: X=1950, Y=50 (Pushes the window onto the second monitor)
            // "--window-position=-1950,50",
            // OPTIONAL: Also set a specific window size
            // "--window-size=1280,1024",
            // "--window-size=1728,1117",
          ],
        },
      },
      dependencies: ["setup"],
    },

    {
      name: "chromium-debug",
      testDir: "./e2e/tests",
      testIgnore: /auth-.*\.spec\.ts/, // Exclude auth tests
      timeout: 0, // Disable overall test timeout for debugging
      use: {
        ...devices["Desktop Chrome"],
        // headless: true,
        // channel: "chromium",
        // storageState is set per-worker by test-fixture.ts
        actionTimeout: 0, // No limit on individual page actions
        navigationTimeout: 0, // No limit on page.goto / waits
        launchOptions: {
          args: [
            "--remote-debugging-port=9222",
            // Set X (Horizontal) and Y (Vertical) coordinates
            // Example: X=1950, Y=50 (Pushes the window onto the second monitor)
            // "--window-position=-1950,50",
            // OPTIONAL: Also set a specific window size
            // "--window-size=1280,1024",
            // "--window-size=1728,1117",
          ],
        },
      },
      dependencies: ["setup"],
    },

    {
      name: "firefox",
      testDir: "./e2e/tests",
      testIgnore: /auth-.*\.spec\.ts/,
      use: {
        ...devices["Desktop Firefox"],
        // storageState: "e2e/.auth/alice.json",
      },
      dependencies: ["setup"],
    },

    {
      name: "webkit",
      testDir: "./e2e/tests",
      testIgnore: /auth-.*\.spec\.ts/,
      use: {
        ...devices["Desktop Safari"],
        // storageState: "e2e/.auth/alice.json",
      },
      dependencies: ["setup"],
    },

    /* Test against mobile viewports. */
    {
      name: "Mobile Chrome",
      testDir: "./e2e/tests",
      testIgnore: /auth-.*\.spec\.ts/, // Exclude auth tests
      use: {
        ...devices["Pixel 5"],
        // storageState: "e2e/.auth/alice.json",
        launchOptions: {
          args: [
            // "--remote-debugging-port=9222",
            // Set X (Horizontal) and Y (Vertical) coordinates
            // Example: X=1950, Y=50 (Pushes the window onto the second monitor)
            // "--window-position=-1950,50",
            // OPTIONAL: Also set a specific window size
            // "--window-size=1280,1024",
          ],
        },
      },
      dependencies: ["setup"],
    },
    {
      name: "chromium-pwa-offline",
      testDir: "./e2e/tests-preview", // Use a separate directory for PWA tests
      use: {
        ...devices["Desktop Chrome"],
        // Base URL will point to the preview port
        baseURL: `http://localhost:${PREVIEW_PORT}`,
      },
      dependencies: ["preview-setup"], // Ensure setup runs first if authenticated access is needed
    },
    {
      name: "chromium-sboagy-1",
      testDir: "./e2e/tests-sboagy-1",
      testIgnore: /auth-.*\.spec\.ts/, // Exclude auth tests
      use: {
        ...devices["Desktop Chrome"],
        // headless: true,
        // channel: "chromium",
        // storageState is set per-worker by test-fixture.ts
        launchOptions: {
          args: [
            "--remote-debugging-port=9222",
            // Set X (Horizontal) and Y (Vertical) coordinates
            // Example: X=1950, Y=50 (Pushes the window onto the second monitor)
            // "--window-position=-1950,50",
            // OPTIONAL: Also set a specific window size
            // "--window-size=1280,1024",
            // "--window-size=1728,1117",
          ],
        },
      },
      // dependencies: ["setup"],
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    // 1. Main Dev Server
    {
      command: "npm run dev",
      url: `http://localhost:${DEV_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || "",
        VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || "",
        VITE_DISABLE_HMR_FOR_E2E:
          process.env.VITE_DISABLE_HMR_FOR_E2E || "true",
        // Forward optional diagnostics flags into the Vite server process.
        VITE_SYNC_DIAGNOSTICS: process.env.VITE_SYNC_DIAGNOSTICS || "",
        VITE_SYNC_DEBUG: process.env.VITE_SYNC_DEBUG || "",
        VITE_SCHEDULING_PLUGIN_DIAGNOSTICS:
          process.env.VITE_SCHEDULING_PLUGIN_DIAGNOSTICS || "true",
      },
    },
    // 2. Worker/API Server
    {
      command: "npm run dev:worker",
      url: `http://localhost:${WORKER_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    // 3. PWA PREVIEW SERVER (Defined here, but only runs when needed)
    // Must be run externally.
    // {
    //   // Give it a unique ID to prevent running it automatically if we don't need it
    //   // Playwright will run all servers by default, so we'll stop that in the next step.
    //   command: `npm run build && npm run preview -- --port ${PREVIEW_PORT}`,
    //   url: `http://localhost:${PREVIEW_PORT}`,
    //   reuseExistingServer: !process.env.CI,
    //   timeout: 180 * 1000, // Increased timeout for build step
    // },
  ],
});
