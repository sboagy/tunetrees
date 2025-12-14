import type { BrowserContext, Worker } from "@playwright/test";

// Define the Service Worker states for type safety
type ServiceWorkerState = "activated" | "installing" | "redundant" | "waiting"; // These are the states visible via registration.active.state

/**
 * Waits for a Service Worker associated with a given URL to register and reach the 'activated' state.
 * This is crucial for ensuring the Service Worker is ready to intercept network requests (e.g., for offline testing).
 * This function uses worker.evaluate() to reliably get the state from the Service Worker's own context.
 * @param context The Playwright BrowserContext object.
 * @param url The base URL of the PWA being tested (e.g., 'https://your-pwa-app.com/').
 * @param desiredState The state to wait for (default: 'activated').
 * @param timeoutMs The maximum time to wait in milliseconds.
 * @returns The Playwright Worker object representing the activated Service Worker.
 */
export async function waitForServiceWorker(
  context: BrowserContext,
  url: string,
  desiredState: ServiceWorkerState = "activated",
  timeoutMs: number = 15000 // 15 seconds timeout
): Promise<Worker> {
  const targetOrigin = new URL(url).origin;

  const startTime = Date.now();
  const pollIntervalMs = 500; // Check state every half second

  // 1. Check existing workers (RACE-FREE CHECK)
  const existingWorkers = await context.serviceWorkers();
  let worker = existingWorkers.find((sw) => sw.url().startsWith(targetOrigin));

  if (worker) {
    console.log("Service Worker already registered. Skipping waitForEvent.");
  } else {
    try {
      console.log(`Waiting for Service Worker registration at: ${url}`);

      const isMatchingWorker = (sw: Worker): boolean => {
        const swUrl = sw.url();
        const targetOrigin = new URL(url).origin;

        // --- DEBUG LOG HERE ---
        console.log(
          `[DEBUG SW URL] Checking SW URL: ${swUrl}. Target Origin: ${targetOrigin}`
        );
        // ----------------------

        return swUrl.startsWith(targetOrigin);
      };

      const workerPromise = context.waitForEvent("serviceworker", {
        predicate: isMatchingWorker,
        timeout: timeoutMs,
      });

      worker = await workerPromise;
    } catch (_error) {
      throw new Error(
        `Service Worker for URL ${url} did not register within ${timeoutMs}ms.`
      );
    }
  }

  // Ensure the worker was found before proceeding
  if (!worker) {
    throw new Error(
      "Logic error: Service Worker was neither found nor registered."
    );
  }

  // 2. Poll the worker's true state using worker.evaluate()
  console.log(
    `Service Worker found at ${worker.url()}. Polling for state: '${desiredState}'...`
  );

  let currentState: string = "unknown";

  while (currentState !== desiredState) {
    const elapsed = Date.now() - startTime;
    if (elapsed > timeoutMs) {
      throw new Error(
        `Service Worker failed to reach state '${desiredState}' within ${timeoutMs}ms. ` +
          `Final state was: '${currentState}'`
      );
    }

    try {
      // --- THE CRITICAL FIX ---
      // Evaluate code within the Service Worker's execution context to get its state.
      currentState = await worker.evaluate(() => {
        // Service Worker globals have access to self.registration
        return (self as any).registration.active?.state || "unknown";
      });
    } catch (_e) {
      // Handle cases where registration is not immediately available or worker is stopped
      currentState = "unknown";
    }

    if (currentState !== desiredState) {
      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  console.log(`Service Worker is now in state: '${desiredState}'.`);
  return worker;
}
