import { defineConfig, devices } from "@playwright/test";
// import path from "node:path";
// import { fileURLToPath } from "node:url";

// // eslint-disable-next-line @typescript-eslint/naming-convention
// const __filename = fileURLToPath(import.meta.url);
// // eslint-disable-next-line @typescript-eslint/naming-convention
// const __dirname = path.dirname(__filename);

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
  retries: process.env.CI ? 0 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never", merge: true }],
  ],
  /* Ensure output directory is set */
  outputDir: "test-results/playwright",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
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
    screenshot: "on",
    video: "on",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "backend",
      testDir: "./tests/backend",
      use: {
        baseURL: "http://localhost:8000",
      },
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
      // dependencies: ["backend"],
      testMatch: "test*.ts",
      timeout: 5 * 60 * 1000, // 5 minutes timeout per test (temporarily increased)
    },

    // {
    //   name: "firefox",
    //   use: { ...devices["Desktop Firefox"] },
    // },

    // {
    //   name: "webkit",
    //   use: { ...devices["Desktop Safari"] },
    // },

    {
      name: "backend-teardown",
      testDir: "./tests",
      // dependencies: ["backend", "chromium"],
      // dependencies: ["chromium", "firefox", "webkit"],
      testMatch: "**/backend-teardown.spec.ts",
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

  // TEMPORARILY DISABLED
  /* Run the local dev server before starting the tests */
  // webServer: {
  //   // When in the github actions CI, the server will be started by
  //   // the playwright test runner, controlled by
  //   // tunetrees/.github/workflows/playwright.yml,
  //   // so this shouldn't have any effect in that environment.
  //   command: "npm run dev", // Combine the command and arguments
  //   env: {
  //     NEXT_BASE_URL: process.env.NEXT_PUBLIC_TT_BASE_URL || "",
  //     NEXT_PUBLIC_TT_BASE_URL: process.env.NEXT_PUBLIC_TT_BASE_URL || "",
  //     AUTH_SECRET: process.env.AUTH_SECRET || "",
  //     NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "",
  //     AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID || "",
  //     AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET || "",
  //     AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID || "",
  //     AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET || "",
  //     GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  //     GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  //     GITHUB_CLIENT_ID: process.env.GGITHUB_CLIENT_ID || "",
  //     GITHUB_CLIENT_SECRET: process.env.GGITHUB_CLIENT_SECRET || "",
  //     TT_AUTH_SENDGRID_API_KEY: process.env.TT_AUTH_SENDGRID_API_KEY || "",
  //     CI: process.env.TT_AUTH_SENDGRID_API_KEY || "",
  //   },
  //   url: "https://localhost:3000/api/health",
  //   // Playwright seems to trip up due to SSL errors (because the self-signed certificate
  //   // via "next dev --experimental-https" won't be trusted), so we ignore them.
  //   ignoreHTTPSErrors: true,
  //   reuseExistingServer: !process.env.CI,

  //   // timeout: 2 * 1000,
  // },

  /* Specify global teardown script */
  // globalTeardown: path.resolve(__dirname, "./scripts/global-teardown.ts"),
});
