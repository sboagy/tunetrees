import { test as base } from "@playwright/test";
import { installSyncErrorGuard } from "./sync-error-guard";

/** Shared by authenticated AND anonymous tests; does not install an auth snapshot. */
export const test = base.extend<{
  syncErrorGuard: { finish: () => Promise<void> };
}>({
  syncErrorGuard: [
    async ({ page }, use) => {
      // Depend on page so validation runs before Playwright closes it.
      const guard = await installSyncErrorGuard(page.context());
      await use(guard);
      await guard.finish();
    },
    { auto: true, timeout: 35000 },
  ],
});
