import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(__filename);

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    headless: false, // Run tests in headed mode

    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://127.0.0.1:3000',
    baseURL: "https://127.0.0.1:3000",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",

    ignoreHTTPSErrors: true, // Accept self-signed certificates
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "backend",
      testDir: "./tests/backend",
      use: {
        baseURL: "http://localhost:8000",
      },
      // dependencies: ["frontend"],
      testMatch: "**/*.setup.ts",
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },

        /* Use the saved storage state saved in scripts/login.ts */
        // storageState: "tests/storageStateSboagyLogin.json",
      },
      // testMatch: "test*.ts",
      dependencies: ["backend"],
    },

    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },

    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
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
    command: "npm run dev", // Combine the command and arguments
    // Setting the URL causes Playwright to hang.  I don't know why.
    // The server starts and returns 200.  CoPilot suggests maybe specifying
    // a Health Check Endpoint, which is not a horrible idea.
    // url: "https://127.0.0.1:3000",
    // url: "https://127.0.0.1:3000/home",
    // reuseExistingServer: !process.env.CI,
    // url: "https://localhost:3000/api/health",
    reuseExistingServer: true,
    timeout: 20 * 1000, // Increase the timeout to 60 seconds
  },

  /* Specify global teardown script */
  globalTeardown: path.resolve(__dirname, "./scripts/global-teardown.ts"),
});
