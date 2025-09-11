import type { Page } from "@playwright/test";

/**
 * Sets up test defaults in the browser context, including the sitdown date from the environment variable TT_REVIEW_SITDOWN_DATE.
 * Call this in your Playwright beforeEach hooks.
 */
export async function setTestDefaults(page: Page) {
  // NOTE: Environment-driven sitdown seed removed. We now use a deterministic
  // fixed ISO timestamp (local noon) solely for test stability. Individual
  // specs that need dynamic dates should override via URL param or setTestDateTime.
  const sitdownDate = "2024-12-31T12:00:00.000Z"; // stable baseline
  await page.addInitScript((dateString) => {
    window.__TT_REVIEW_SITDOWN_DATE__ = dateString;
  }, sitdownDate);
  const dateObject = new Date(sitdownDate);
  await page.addInitScript(`{
      Date = class extends Date {
        constructor(...args) {
          if (args.length === 0) return super(${dateObject.getTime()});
          return super(...args);
        }
      }
    }`);
  // Get the current date from the browser and log it to Node stdout
  const browserDate = await page.evaluate(() => new Date().toISOString());
  console.log("Browser Date (default):", browserDate);
}

export async function setTestDateTime(page: Page, sitdownDate: string) {
  if (!sitdownDate) {
    throw new Error(
      "setTestDateTime requires a sitdown date string in ISO format.",
    );
  }
  await page.addInitScript((dateString) => {
    window.__TT_REVIEW_SITDOWN_DATE__ = dateString;
  }, sitdownDate);
  const dateObject = new Date(sitdownDate);
  await page.addInitScript(`{
      Date = class extends Date {
        constructor(...args) {
          if (args.length === 0) return super(${dateObject.getTime()});
          return super(...args);
        }
      }
    }`);
  // Get the current date from the browser and log it to Node stdout
  const browserDate = await page.evaluate(() => new Date().toISOString());
  console.log("Browser Date:", browserDate);
}
