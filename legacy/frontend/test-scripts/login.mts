import path from "node:path";
import { fileURLToPath } from "node:url";
import { type BrowserContext, chromium } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(__filename);

export async function globalSetup() {
  const browser = await chromium.launch();
  const context: BrowserContext = await browser.newContext();
  const page = await context.newPage();

  // Perform login
  console.log("Navigating to login page...");
  await page.goto("https://localhost:3000");
  console.log("Clicking sign in button...");
  await page.getByRole("button", { name: "Sign in" }).click();
  console.log("Filling email...");
  await page.getByPlaceholder("person@example.com").fill("sboagy@gmail.com");
  await page.getByPlaceholder("person@example.com").press("Tab");
  console.log("Filling password...");
  await page.locator("#password").fill("abc");
  await page.locator("#password").press("Tab");
  console.log("Clicking sign in button...");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();

  // Wait for navigation to complete
  await page.waitForNavigation();

  // Sleep for 3 seconds
  console.log("Sleeping for 3 seconds...");
  await page.waitForTimeout(3000);

  // Save storage state to file
  console.log("Saving storage state...");
  const storageStatePath = path.resolve(
    __dirname,
    "../tests/storageStateSboagyLogin.json",
  );
  console.log("===> login.mts:39 ~ ", storageStatePath);

  await context.storageState({ path: storageStatePath });
  await browser.close();
  console.log("Browser closed.");
}
