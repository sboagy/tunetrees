import type { BrowserContext, Page } from "@playwright/test";

export async function contextCleanup(
  context: BrowserContext,
  page: Page | null = null,
): Promise<void> {
  // For some reason, I will not get a fetch error if I give a bit of a pause.
  if (page) {
    await page.waitForTimeout(1000);
  }
  await context.close();

  // As it turns out, closing the browser here is not a good idea.
  // await browser.close({ reason: "Test completed." });
  console.log("Test completed ===> browser-cleanup.ts:10 ~ success");

  // console.log("Test completed. Browser will remain open.");
  // await new Promise(() => {}); // Keep the script running
}
