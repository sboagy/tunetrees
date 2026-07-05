/// <reference types="node" />

import { defineConfig, devices } from "@playwright/test";

// Production smoke tests are run via `op run --env-file=".env.prod.template"`.
// The fallback URL is only for quick local checks outside GitHub Actions.
const baseURL =
  process.env.PRODUCTION_BASE_URL ?? "https://tunetrees-pwa.pages.dev";

export default defineConfig({
  testDir: "./e2e/production",
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
