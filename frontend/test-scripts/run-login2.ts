import path from "node:path";

import { fileURLToPath } from "node:url";

import type { Cookie, Page } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(__filename);

export async function runLoginStandalone(
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

  await page.waitForTimeout(500);

  const signInButton = page.getByRole("button", { name: "Sign in" });
  await signInButton.isVisible();
  await signInButton.isEnabled();

  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(1000);

  const userEmailLocator = page.getByTestId("user_email");
  await userEmailLocator.isVisible();
  // await userEmailLocator.isEnabled();

  await userEmailLocator.fill(user || "");
  await userEmailLocator.press("Tab");

  const passwordEntryBox = page.getByTestId("user_password");
  await passwordEntryBox.isVisible();
  // await passwordEntryBox.isEnabled();

  await passwordEntryBox.fill(pw || "");
  await page.waitForTimeout(100);
  await passwordEntryBox.press("Tab");
  await page.waitForTimeout(1000);

  // await page.waitForFunction(
  //   (button) => {
  //     const btn = button as HTMLButtonElement;
  //     return !btn.disabled;
  //   },
  //   await signInButton.elementHandle(),
  //   { timeout: 20000 }, // Increased timeout for CSRF token fetch
  // );

  const signInButton2 = page.getByRole("button", {
    name: "Sign In",
    exact: true,
  });
  await signInButton2.isVisible();
  await signInButton2.isEnabled();
  await signInButton2.click();
  await page.waitForTimeout(500);

  let sessionCookie: Cookie | undefined;
  for (let i = 0; i < 30; i++) {
    const cookies = await page.context().cookies();
    sessionCookie = cookies.find(
      (cookie) =>
        cookie.name === "__Secure-authjs.session-token" ||
        cookie.name === "next-auth.session-token" ||
        cookie.name === "authjs.session-token",
    );
    if (sessionCookie) break;
    await page.waitForTimeout(200); // wait a bit before retrying
  }
  if (!sessionCookie) {
    console.warn("NextAuth session cookie not found!");
    // You might want to pause here for debugging or retry
  }
}

export async function runLoginWithCookieSave(
  page: Page,
  user: string | undefined,
  pw: string | undefined,
): Promise<void> {
  await runLoginStandalone(page, user, pw);

  const storageStatePath = path.resolve(
    __dirname,
    "storageStateSboagyLogin.json",
  );

  await page.context().storageState({ path: storageStatePath });
}
