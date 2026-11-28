/** #426: isolated recovery UI and real IndexedDB; no auth or server data mutations. */
import { expect, test } from "@playwright/test";

// Load the real components through the running Vite server in a fresh browser context.
// Intercept only the document to avoid initializing auth/sync for this storage test.
test("blocked upgrade requires confirmation and discards only the current account", async ({
  page,
}) => {
  await page.route("http://localhost:5173/recovery-harness", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div>',
    })
  );
  await page.goto("http://localhost:5173/recovery-harness");
  await page.evaluate(async () => {
    const storage = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("tunetrees-storage");
      request.onupgradeneeded = () =>
        request.result.createObjectStore("databases");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = storage.transaction("databases", "readwrite");
      for (const user of ["recovery-owner", "other-owner"]) {
        for (const prefix of [
          "tunetrees-db",
          "tunetrees-db-version",
          "tunetrees-outbox-backup",
        ]) {
          tx.objectStore("databases").put("saved data", `${prefix}-${user}`);
        }
      }
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    storage.close();
    localStorage.setItem(
      "TT_LAST_SYNC_TIMESTAMP_recovery-owner",
      "old watermark"
    );
    localStorage.setItem(
      "TT_LAST_SYNC_TIMESTAMP_other-owner",
      "other watermark"
    );
    localStorage.setItem("unrelated-preference", "keep me");
    const stylePath = "/src/App.css";
    await import(stylePath);
    const componentPath = "/src/components/auth/DatabaseUpgradeBlocked.tsx";
    const discardPath = "/src/lib/db/discard-blocked-database.ts";
    const renderPath = "/node_modules/.vite/deps/solid-js_web.js";
    const { DatabaseUpgradeBlocked } = await import(componentPath);
    const { discardBlockedDatabase } = await import(discardPath);
    const { render } = await import(renderPath);
    render(
      () =>
        DatabaseUpgradeBlocked({
          reason: "outbox",
          account: "recovery@example.com",
          userId: "recovery-owner",
          onDiscard: async () => {
            await discardBlockedDatabase("recovery-owner");
            document.body.dataset.discarded = "true";
          },
        }),
      document.getElementById("root")
    );
  });
  await page.getByTestId("discard-blocked-database").click();
  const cancel = page.getByRole("button", { name: "Cancel", exact: true });
  await expect(cancel).toBeFocused({ timeout: 10000 });
  await expect(cancel.locator("..")).toHaveCSS(
    "flex-direction",
    page.viewportSize()!.width < 640 ? "column" : "row"
  );
  await expect(page.getByRole("dialog")).toContainText("recovery@example.com");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("discard-blocked-database")).toBeFocused({
    timeout: 10000,
  });
  await expect(page.locator("body")).not.toHaveAttribute(
    "data-discarded",
    "true"
  );
  await page.getByTestId("discard-blocked-database").click();
  await page.getByTestId("confirm-discard-blocked-database").click();
  await expect(page.locator("body")).toHaveAttribute("data-discarded", "true", {
    timeout: 10000,
  });
  const remaining = await page.evaluate(async () => {
    const request = indexedDB.open("tunetrees-storage");
    const db = await new Promise<IDBDatabase>((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
    const keys = await new Promise<IDBValidKey[]>((resolve) => {
      const read = db
        .transaction("databases")
        .objectStore("databases")
        .getAllKeys();
      read.onsuccess = () => resolve(read.result);
    });
    db.close();
    return {
      keys,
      fullPull: Boolean(
        localStorage.getItem("TT_UPGRADE_FULL_PULL_recovery-owner")
      ),
      watermark: localStorage.getItem("TT_LAST_SYNC_TIMESTAMP_recovery-owner"),
      otherWatermark: localStorage.getItem(
        "TT_LAST_SYNC_TIMESTAMP_other-owner"
      ),
      preference: localStorage.getItem("unrelated-preference"),
    };
  });
  expect(remaining).toEqual({
    keys: [
      "tunetrees-db-other-owner",
      "tunetrees-db-version-other-owner",
      "tunetrees-outbox-backup-other-owner",
    ],
    fullPull: true,
    watermark: null,
    otherWatermark: "other watermark",
    preference: "keep me",
  });
});
