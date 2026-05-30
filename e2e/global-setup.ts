import { chromium, type FullConfig } from "@playwright/test";
import { BASE_URL } from "./test-config";

/**
 * Global setup for Playwright tests
 *
 * This runs once before all tests start.
 * Use for:
 * - Database seeding
 * - Authentication setup
 * - Global state preparation
 */
async function globalSetup(_config: FullConfig) {
  console.log("🎭 Playwright Global Setup");

  // Start a browser for any needed setup operations
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Wait for the dev server to be ready
    const baseURL = `${BASE_URL}`;
    console.log(`🌐 Waiting for dev server at ${baseURL}`);

    // Try to connect to the server with retries
    let retries = 30;
    let connected = false;

    while (retries > 0 && !connected) {
      try {
        const response = await page.goto(baseURL, {
          timeout: 5000,
          waitUntil: "domcontentloaded",
        });
        if (response?.ok()) {
          connected = true;
          console.log("✅ Dev server is ready");
        }
      } catch {
        retries--;
        if (retries > 0) {
          console.log(`⏳ Waiting for dev server... (${retries} retries left)`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } else {
          throw new Error(
            `❌ Dev server not available at ${baseURL} after 60 seconds`
          );
        }
      }
    }

    // Global setup placeholder: seed test data, setup auth, clear existing data
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;
