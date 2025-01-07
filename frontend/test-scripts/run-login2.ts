import type { Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(__filename);

export async function runLogin(page: Page): Promise<void> {
  const storageStatePath = path.resolve(
    __dirname,
    "storageStateSboagyLogin.json",
  );

  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByPlaceholder("person@example.com").fill("sboagy@gmail.com");
  await page.getByPlaceholder("person@example.com").press("Tab");
  await page.locator("#password").fill("abc");
  await page.locator("#password").press("Tab");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.waitForTimeout(3000);
  await page.context().storageState({ path: storageStatePath });
}
