// biome-ignore lint/correctness/noUnusedImports: Because it's a seed file for tests, not sure if the expect import is needed.
import { expect, test } from "@playwright/test";

test.describe("Test group", () => {
  // biome-ignore lint/correctness/noUnusedFunctionParameters: Because it's a seed file for tests, not sure if its needed.
  test("seed", async ({ page }) => {
    // generate code here.
  });
});
