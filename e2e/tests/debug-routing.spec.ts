import { expect, test } from "@playwright/test";

test("check root page vs catalog page", async ({ page }) => {
  // Enable console logging
  page.on("console", (msg) => {
    console.log(`🔍 Console [${msg.type()}]:`, msg.text());
  });

  // First try root page
  await page.goto("/", {
    waitUntil: "domcontentloaded",
  });

  await page.waitForTimeout(1000);

  const rootContent = await page.textContent("body");
  console.log("ROOT page content preview:", rootContent?.substring(0, 300));
  console.log("ROOT URL:", page.url());

  await page.screenshot({
    path: "test-results/root-page.png",
    fullPage: true,
  });

  // Now try catalog page
  await page.goto("/catalog", {
    waitUntil: "domcontentloaded",
  });

  await page.waitForTimeout(1000);

  const catalogContent = await page.textContent("body");
  console.log(
    "CATALOG page content preview:",
    catalogContent?.substring(0, 300)
  );
  console.log("CATALOG URL:", page.url());

  await page.screenshot({
    path: "test-results/catalog-page.png",
    fullPage: true,
  });

  // Check if we have a navigation bar or any app structure
  const navCount = await page.locator("nav").count();
  console.log("Navigation elements:", navCount);

  // Check for SolidJS app mount
  const appElements = await page.locator("#app, #root, [data-solidjs]").count();
  console.log("App mount elements:", appElements);
});
