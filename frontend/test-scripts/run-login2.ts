import type { Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(__filename);

export async function runLogin(
  page: Page,
  user: string | undefined,
  pw: string | undefined,
): Promise<void> {
  if (
    !process.env.TEST1_LOGIN_USER_EMAIL ||
    !process.env.TEST1_LOGIN_USER_PASSWORD
  ) {
    console.log("===> run-login2.ts:20 ~ ", "No login credentials found");
    throw new Error("No login credentials found");
  }

  const storageStatePath = path.resolve(
    __dirname,
    "storageStateSboagyLogin.json",
  );

  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByPlaceholder("person@example.com").fill(user || "");
  await page.getByPlaceholder("person@example.com").press("Tab");
  const passwordEntryBox = page.locator("#password");
  await passwordEntryBox.fill(pw || "");
  // await page.waitForTimeout(500);
  const signInButton = page.getByRole("button", {
    name: "Sign In",
    exact: true,
  });
  await passwordEntryBox.press("Tab");

  await page.waitForFunction(
    (button) => {
      const btn = button as HTMLButtonElement;
      return !btn.disabled;
    },
    await signInButton.elementHandle(),
    { timeout: 2000 },
  );

  await signInButton.click();
  await page.waitForTimeout(3000);
  await page.context().storageState({ path: storageStatePath });
}
