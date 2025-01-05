import globalTeardown from "@/scripts/global-teardown";
import { test } from "@playwright/test";

test.describe("Backend Teardown", () => {
  test("teardown", async () => {
    // Add your teardown logic here
    console.log("Teardown backend server");
    await globalTeardown();
  });
});
