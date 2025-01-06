import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(__filename);

// test.beforeEach(async () => {
//   await setupDatabase();
// });

// test.use({ storageState: "storageState.json" });

test("test", async ({ browser }) => {
  console.log("===> test-2.spec.ts:12 ~ ", __dirname);
  const storageStatePath = path.resolve(
    __dirname,
    "storageStateSboagyLogin.json",
  );
  console.log("===> test-2.spec.ts:22 ~ ", storageStatePath);

  const storageStateContent = await fs.readFile(storageStatePath, "utf8");
  const storageState = JSON.parse(storageStateContent);

  // Warning, don't normally enable this, it will show the storage state in the console.
  // console.log("===> test-2.spec.ts:27 ~ Storage State:", storageState);

  const context = await browser.newContext({ storageState: storageState });

  console.log("===> test-2.spec.ts:33 ~ creating new page for health check");
  const pageHello = await context.newPage();
  const response = await pageHello.request.get(
    "https://127.0.0.1:3000/api/health",
  );
  const responseBody = await response.json();
  console.log(`===> test-2.spec.ts:39 ~ health check ${responseBody.status}`);
  expect(responseBody.status).toBe("ok");

  console.log("===> test-2.spec.ts:42 ~ creating new page for tunetrees");
  // Set the storage state
  const page = await context.newPage();

  // await page.waitForTimeout(5000);

  // await page.waitForTimeout(2000);

  // Increase the timeout for page.goto
  await page.goto("https://127.0.0.1:3000", { timeout: 60000 });
  // storageState: "storageState.json";
  // await page.getByRole("button", { name: "Sign in" }).click();
  // await page.getByPlaceholder("person@example.com").fill("sboagy@gmail.com");
  // await page.getByPlaceholder("person@example.com").press("Tab");
  // await page.locator("#password").fill("abc");
  // await page.locator("#password").press("Tab");
  // await page.getByRole("button", { name: "Sign In", exact: true }).click();
  // await page.waitForTimeout(3000);
  // await page.context().storageState({ path: storageStatePath });
  await page.waitForTimeout(1000);

  console.log("===> test-2.spec.ts:42 ~ waiting for selector");
  await page.waitForSelector('role=tab[name="Repertoire"]', {
    state: "visible",
  });
  await page.waitForTimeout(1000);
  await page.getByRole("tab", { name: "Repertoire" }).click();
  await page.getByPlaceholder("Filter").click();
  await page.getByPlaceholder("Filter").fill("lakes of");
  await page.getByRole("row", { name: "1081 Lakes of Sligo Polka" }).click();

  // ========================
  await page
    .locator("div")
    .filter({ hasText: /^Lakes of Sligo$/ })
    .getByLabel("Edit")
    .click();
  await page.getByLabel("Title:").click();
  await page.getByLabel("Title:").fill("Lakes of Sligo x");

  // CANCEL
  await page.getByRole("button", { name: "Cancel" }).click();
  // I think this is needed mostly for the useEffect to take effect?
  await page.waitForTimeout(1000);

  const tuneTitle1 = await page.locator("#current-tune-title").textContent();
  console.log("===> test-2.spec.ts:63 ~ ", tuneTitle1);
  // Bogus expect, this should test for "Lakes of Sligo x"
  expect(await page.locator("#current-tune-title").textContent()).toEqual(
    "Lakes of Sligo",
  );
  // ========================
  // await page.waitForTimeout(1000);
  // ========================
  // Should this be two tests?
  await page
    .locator("div")
    .filter({ hasText: /^Lakes of Sligo$/ })
    .getByLabel("Edit")
    .click();
  await page.getByLabel("Title:").click();
  await page.getByLabel("Title:").fill("Lakes of Sligo x");

  // Save
  await page.getByRole("button", { name: "Save" }).click();
  // I think this is needed mostly for the useEffect to take effect?
  await page.waitForTimeout(1000);

  const tuneTitle2 = await page.locator("#current-tune-title").textContent();
  console.log("===> test-2.spec.ts:63 ~ ", tuneTitle2);
  // Bogus expect, this should test for "Lakes of Sligo x"
  expect(await page.locator("#current-tune-title").textContent()).toEqual(
    "Lakes of Sligo x",
  );

  // For some reason, I will not get a fetch error if I give a bit of a pause.
  await page.waitForTimeout(1000);
  await page.close();
  await context.close();
  await browser.close({ reason: "Test completed." });
  console.log("Test completed ===> test-2.spec.ts:68 ~ success");

  // console.log("Test completed. Browser will remain open.");
  // await new Promise(() => {}); // Keep the script running
});
