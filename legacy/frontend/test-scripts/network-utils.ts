import type { Page } from "@playwright/test";

export async function applyNetworkThrottle(page: Page, throttleMaxRequest = 0) {
  let throttleMax = throttleMaxRequest;
  if (throttleMax === 0) {
    throttleMax = process.env.THROTTLE_MAX
      ? Number.parseInt(process.env.THROTTLE_MAX)
      : 0;
  }
  if (throttleMax === 0) {
    return;
  }
  await page.route("**/*", async (route) => {
    const simulatedLatency = Math.floor(Math.random() * throttleMax);
    // const simulatedLatency = 500;
    await new Promise((resolve) => setTimeout(resolve, simulatedLatency)); // Simulate latency
    await route.continue();
  });
}
