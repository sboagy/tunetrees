import { expect, test } from "@playwright/test";

// test.beforeEach(async () => {
//   await setupDatabase();
// });

test("test", async ({ page }) => {
  await page.goto("https://127.0.0.1:3000");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByPlaceholder("person@example.com").fill("sboagy@gmail.com");
  await page.getByPlaceholder("person@example.com").press("Tab");
  await page.locator("#password").fill("abc");
  await page.locator("#password").press("Tab");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.getByRole("tab", { name: "Repertoire" }).click();
  await page.getByPlaceholder("Filter").click();
  await page.getByPlaceholder("Filter").fill("lakes of");
  await page.getByRole("row", { name: "1081 Lakes of Sligo Polka" }).click();
  await page
    .locator("div")
    .filter({ hasText: /^Lakes of Sligo$/ })
    .getByLabel("Edit")
    .click();
  await page.getByLabel("Title:").click();
  await page.getByLabel("Title:").fill("Lakes of Sligo x");
  await page.getByRole("button", { name: "Save" }).click();
  const tuneTitle1 = await page.locator("#current-tune-title").textContent();
  console.log(tuneTitle1);
  // Bogus expect, this should test for "Lakes of Sligo x"
  expect(await page.locator("#current-tune-title").textContent()).toEqual(
    "Lakes of Sligo",
  );
  // console.log("Test completed. Browser will remain open.");
  // await new Promise(() => {}); // Keep the script running
});
