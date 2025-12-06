import path from "node:path";

import { fileURLToPath } from "node:url";

import { type Cookie, expect, type Page } from "@playwright/test";

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

  const signInButton = page.getByRole("button", { name: "Sign in" });
  await expect(signInButton).toBeAttached();
  await expect(signInButton).toBeVisible();
  await expect(signInButton).toBeEnabled();

  await signInButton.click();

  const userEmailLocator = page.getByTestId("user_email");
  await expect(userEmailLocator).toBeAttached();
  await expect(userEmailLocator).toBeVisible();
  // await userEmailLocator.isEnabled();

  await userEmailLocator.fill(user || "");
  await userEmailLocator.press("Tab");

  const passwordEntryBox = page.getByTestId("user_password");
  await expect(passwordEntryBox).toBeVisible();
  // await passwordEntryBox.isEnabled();

  await passwordEntryBox.fill(pw || "");
  await page.waitForTimeout(100);
  await passwordEntryBox.press("Tab");

  // await page.waitForFunction(
  //   (button) => {
  //     const btn = button as HTMLButtonElement;
  //     return !btn.disabled;
  //   },
  //   await signInButton.elementHandle(),
  //   { timeout: 20000 }, // Increased timeout for CSRF token fetch
  // );

  const loginSubmitButton = page.getByTestId("login-submit-button");
  await expect(loginSubmitButton).toBeAttached();
  await expect(loginSubmitButton).toBeVisible();
  await expect(loginSubmitButton).toBeEnabled();

  await loginSubmitButton.click();
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
