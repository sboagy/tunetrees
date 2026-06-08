/// <reference types="node" />

import { defineConfig, devices } from "@playwright/test";

// dotenv is intentionally omitted here — staging tests are run via
// `op run --env-file=".env.staging.template"` which injects env vars
// (including STAGING_BASE_URL) at runtime. The hardcoded fallback below
// only applies when running outside op run (e.g. quick local smoke tests).
const baseURL = process.env.STAGING_BASE_URL ?? "https://staging.tunetrees.com";

export default defineConfig({
  testDir: "./e2e/staging",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: true,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["blob"], ["list"]] : [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
