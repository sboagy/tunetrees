// Playwright configuration file. See https://playwright.dev/docs/test-configuration
//
// This file is used to configure the Playwright test runner. It is used to define the
// test environment, the browsers to run the tests in, and the test files to run.
import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";
import path from "node:path";
import {
  frontendDirPath,
  outputDir,
  videoDir,
} from "./test-scripts/paths-for-tests";

if (!process.env.CI) {
  dotenv.config({ path: path.resolve(frontendDirPath, ".env.local") });
}

// Define environment variables for the test environment
// Set environment variables for tests if they aren't already defined
if (!process.env.NEXT_PUBLIC_MOCK_EXTERNAL_APIS) {
  process.env.NEXT_PUBLIC_MOCK_EXTERNAL_APIS = "true";
}
if (!process.env.NEXT_PUBLIC_MOCK_EMAIL_CONFIRMATION) {
  process.env.NEXT_PUBLIC_MOCK_EMAIL_CONFIRMATION = "true";
}
// process.env.SAVE_COOKIES = "true"; // Save cookies for login tests

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 0 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never", merge: true }],
  ],
  /* Ensure output directory is set */
  outputDir: outputDir,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */

  globalSetup: path.resolve(frontendDirPath, "./test-scripts/global-setup.ts"),
  globalTeardown: path.resolve(
    frontendDirPath,
    "./test-scripts/global-teardown.ts",
  ),

  expect: {
    timeout: process.env.CI ? 60_000 : 30_000,
  },

  use: {
    // Run tests in headless mode if running in CI,
    // otherwise use PLAYWRIGHT_HEADLESS env var (default: false)
    headless: process.env.CI
      ? true
      : process.env.PLAYWRIGHT_HEADLESS
        ? process.env.PLAYWRIGHT_HEADLESS === "true"
        : false,

    /* Base URL to use in actions like `await page.goto('/')`. */
    // Use HTTP in CI (production start) and HTTPS locally (dev --experimental-https)
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ||
      (process.env.CI ? "http://127.0.0.1:3000" : "https://localhost:3000"),

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "retain-on-failure",

    ignoreHTTPSErrors: true, // Accept self-signed certificates

    // launchOptions: {
    //   slowMo: 1000,
    // },
    screenshot: "on-first-failure",
    video: "retain-on-failure",
    contextOptions: {
      recordVideo: {
        dir: videoDir, // Directory to save the videos
        size: { width: 1280, height: 720 }, // Optional: specify video size
      },
    },
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
        // Force Playwright to launch browser window on the same screen as the process (not the active screen)
        launchOptions: {
          // On multi-monitor setups, Playwright/Chromium will launch on the primary screen by default.
          // To force a specific screen, set the window position explicitly.
          // Example: position at (0,0) on the screen where the process starts.
          args: ["--window-position=0,0"],
        },
      },
      // dependencies: ["backend"],
      testMatch: "test*.ts",
      timeout: process.env.CI ? 120_000 : 50_000, // 120 seconds in CI, 50 seconds locally
    },

    // {
    //   name: "firefox",
    //   use: { ...devices["Desktop Firefox"] },
    // },

    // {
    //   name: "webkit",
    //   use: { ...devices["Desktop Safari"] },
    // },

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

  /* Run the local dev server before starting the tests */
  webServer: (() => {
    const isCI = !!process.env.CI;
    const logPath =
      process.env.TUNETREES_FRONTEND_LOG || "test-results/frontend.log";
    return {
      // Playwright will start the server using this webServer config in both local and CI environments.
      // In CI we build and start the production server for stability; locally we run dev with --experimental-https.
      command: isCI
        ? `npm run start 2>&1 | tee ${logPath}`
        : `npm run dev 2>&1 | tee ${process.env.TUNETREES_FRONTEND_LOG || "test-results/frontend.log"}`, // Combine the command and arguments,
      env: {
        // Always provide a concrete base URL for the app
        NEXT_BASE_URL:
          process.env.NEXT_BASE_URL ||
          (isCI ? "http://127.0.0.1:3000" : "https://localhost:3000"),
        NEXT_PUBLIC_MOCK_EXTERNAL_APIS:
          process.env.NEXT_PUBLIC_MOCK_EXTERNAL_APIS || "true",
        NEXT_PUBLIC_MOCK_EMAIL_CONFIRMATION:
          process.env.NEXT_PUBLIC_MOCK_EMAIL_CONFIRMATION || "true",
        // Point server-side axios to the local FastAPI by default so server actions don't 404
        TT_API_BASE_URL: process.env.TT_API_BASE_URL || "http://127.0.0.1:8000",
        // Ensure NextAuth works across both CI and local HTTPS dev
        AUTH_URL:
          process.env.AUTH_URL ||
          (isCI ? "http://127.0.0.1:3000" : "https://localhost:3000"),
        AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST || "true",
        AUTH_SECRET:
          process.env.AUTH_SECRET ||
          (isCI ? "test_auth_secret_for_ci_only" : "test_auth_secret_local"),
        NEXTAUTH_SECRET:
          process.env.NEXTAUTH_SECRET ||
          (isCI
            ? "test_nextauth_secret_for_ci_only"
            : "test_nextauth_secret_local"),
        AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID || "",
        AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET || "",
        AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID || "",
        AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET || "",
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
        GITHUB_CLIENT_ID: process.env.GGITHUB_CLIENT_ID || "",
        GITHUB_CLIENT_SECRET: process.env.GGITHUB_CLIENT_SECRET || "",
        // NODE_OPTIONS: process.env.NODE_OPTIONS || "--max-old-space-size=8192",
        TT_AUTH_SENDGRID_API_KEY: process.env.TT_AUTH_SENDGRID_API_KEY || "",
      },
      // In CI use HTTP health URL; locally just wait for port to open (avoids TLS validation issues)
      url: isCI ? "http://localhost:3000/api/health" : undefined,
      port: isCI ? undefined : 3000,

      // Playwright seems to trip up due to SSL errors (because the self-signed certificate
      // via "next dev --experimental-https" won't be trusted), so we ignore them in the `use` block above.

      // Reuse local server if already running (keeps VS Code runner snappy)
      reuseExistingServer: true,

      timeout: isCI ? 120_000 : 120_000,
    };
  })(),
});
