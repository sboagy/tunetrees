import type { Page } from "@playwright/test";

/**
 * Sets up test defaults in the browser context, including the sitdown date from the environment variable TT_REVIEW_SITDOWN_DATE.
 * Call this in your Playwright beforeEach hooks.
 */
export async function setTestDefaults(page: Page) {
  const sitdownDate = process.env.TT_REVIEW_SITDOWN_DATE;
  if (sitdownDate) {
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
}

export async function setTestDateTime(page: Page, sitdownDate: string) {
  if (sitdownDate) {
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
}
