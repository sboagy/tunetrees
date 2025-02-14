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
  workers: process.env.CI ? 1 : undefined,
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
    timeout: 20_000,
  },

  use: {
    headless: !!process.env.CI, // Run tests in headed mode unless running in CI

    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://127.0.0.1:3000',
    baseURL: "https://localhost:3000",

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
      },
      // dependencies: ["backend"],
      testMatch: "test*.ts",
      timeout: 6 * 60 * 1000, // 6 minutes timeout per test (temporarily increased)
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
  webServer: {
    // When in the github actions CI, the server will be started by
    // the playwright test runner, controlled by
    // tunetrees/.github/workflows/playwright.yml,
    // so this shouldn't have any effect in that environment.
    command: "npm run dev 2>&1 | tee test-results/frontend.log", // Combine the command and arguments
    env: {
      NEXT_BASE_URL: process.env.NEXT_BASE_URL || "",
      NEXT_PUBLIC_TT_BASE_URL: process.env.NEXT_PUBLIC_TT_BASE_URL || "",
      TT_API_BASE_URL: process.env.TT_API_BASE_URL || "",
      AUTH_SECRET: process.env.AUTH_SECRET || "",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "",
      AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID || "",
      AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET || "",
      AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID || "",
      AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET || "",
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
      GITHUB_CLIENT_ID: process.env.GGITHUB_CLIENT_ID || "",
      GITHUB_CLIENT_SECRET: process.env.GGITHUB_CLIENT_SECRET || "",
      TT_AUTH_SENDGRID_API_KEY: process.env.TT_AUTH_SENDGRID_API_KEY || "",
      CI: process.env.TT_AUTH_SENDGRID_API_KEY || "",
    },
    url: "https://localhost:3000/api/health",
    // Playwright seems to trip up due to SSL errors (because the self-signed certificate
    // via "next dev --experimental-https" won't be trusted), so we ignore them.
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env.CI,

    // timeout: 2 * 1000,
  },
});
