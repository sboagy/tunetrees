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

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./e2e/tests", // More specific path
  testMatch: /.*\.spec\.ts/,

  outputDir: path.resolve(__dirname, "test-results"), // Example: './test-results-ci'

  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 4 : 0,
  /* Enable parallel workers - each worker gets dedicated test user to avoid conflicts */
  workers: process.env.CI ? 2 : 8,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  // reporter: process.env.CI ? [["blob"], ["list"]] : [["html"], ["list"]],
  reporter: process.env.CI ? [["blob"], ["list"]] : [["list"]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",

    /* Record video only on failure to save disk space in CI */
    video: "retain-on-failure",

    /* Take screenshots only on failure */
    screenshot: "only-on-failure",

    // headless: true,
  },

  // Global timeout for each test (in milliseconds)
  // timeout: 120 * 1000,

  globalTimeout: process.env.CI ? 60 * 60 * 1000 : undefined,

  /* Configure projects for major browsers */
  projects: [
    // Setup project runs first for authenticated tests
    {
      name: "setup",
      testDir: "./e2e/setup",
      testMatch: /.*\.setup\.ts$/,
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
        // launchOptions: {
        //   args: [
        //     // Set X (Horizontal) and Y (Vertical) coordinates
        //     // Example: X=1950, Y=50 (Pushes the window onto the second monitor)
        //     "--window-position=-1950,50",

        //     // OPTIONAL: Also set a specific window size
        //     // "--window-size=1280,1024",
        //     "--window-size=1728,1117",
        //   ],
        // },
      },
      dependencies: ["setup"],
    },

    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        // storageState: "e2e/.auth/alice.json",
      },
      dependencies: ["setup"],
    },

    {
      name: "webkit",
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
        // launchOptions: {
        //   args: [
        //     // Set X (Horizontal) and Y (Vertical) coordinates
        //     // Example: X=1950, Y=50 (Pushes the window onto the second monitor)
        //     "--window-position=-1950,50",

        //     // OPTIONAL: Also set a specific window size
        //     // "--window-size=1280,1024",
        //   ],
        // },
      },
      dependencies: ["setup"],
    },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || "",
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || "",
    },
  },
});
