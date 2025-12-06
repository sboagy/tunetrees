import type { Page } from "@playwright/test";
import { initialPageLoadTimeout } from "./paths-for-tests";

/**
 * Reliable page navigation for CI environments
 * Uses domcontentloaded instead of networkidle to avoid CI timeout issues
 */
export async function navigateToPage(page: Page, url: string) {
  await page.goto(url, {
    timeout: initialPageLoadTimeout,
    waitUntil: "domcontentloaded", // More reliable than networkidle in CI
  });

  // Ensure basic page elements are loaded
  await page.waitForSelector("body", { state: "attached" });
  await page.waitForLoadState("domcontentloaded");

  // Optional: Wait for any essential elements to be visible
  // This can be customized per page as needed
}

/**
 * Navigate with retry logic for flaky CI environments
 */
export async function navigateToPageWithRetry(
  page: Page,
  url: string,
  maxRetries = 3,
) {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await navigateToPage(page, url);
      return; // Success
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `Navigation attempt ${attempt}/${maxRetries} failed:`,
        error,
      );

      if (attempt < maxRetries) {
        await page.waitForTimeout(2000); // Wait before retry
      }
    }
  }

  throw new Error(
    `Navigation failed after ${maxRetries} attempts. Last error: ${lastError?.message}`,
  );
}
