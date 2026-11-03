import { expect, type Route } from "@playwright/test";
import {
  addLegacyAudio,
  cancelFromTab,
  readByosDatabase,
  replayFromTab,
} from "../helpers/byos-browser-state";
import {
  configureMockDropboxByos,
  createSilentWavBuffer,
  mockDropboxRequests,
  saveMockStorageSettings,
} from "../helpers/byos-provider";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/** BYOS-001: Private Dropbox ingestion, OAuth continuity and durable drafts.
 * Priority: Critical. HTTP is mocked; adapters, UI and IndexedDB are real.
 */
test.describe("BYOS-001: private storage regressions", () => {
  test.setTimeout(60_000);
  let app: TuneTreesPage;
  test.afterEach(async ({ context }) => {
    // Restore connectivity even after a failed assertion so fixture cleanup works.
    await context.setOffline(false);
  });
  test.beforeEach(async ({ page, testUser }) => {
    app = new TuneTreesPage(page);
    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
      clearNotesAndReferences: true,
    });
    await app.navigateToTab("catalog");
    await app.searchForTune("Banish Misfortune", app.catalogGrid);
    await expect(app.getRows("catalog").first()).toContainText(
      "Banish Misfortune",
      { timeout: 10000 }
    );
    await app.getRows("catalog").first().click();
    await app.ensureSidebarExpanded();
    await app.ensureTuneInfoExpanded();
    await configureMockDropboxByos(page, testUser.userId);
    await app.referencesAddButton.click();
    await expect(app.referenceForm).toBeVisible({ timeout: 10000 });
    await app.selectReferenceType("audio");
    await app.referenceAudioFileInput.setInputFiles({
      name: "dropbox-private.wav",
      mimeType: "audio/wav",
      buffer: createSilentWavBuffer(),
    });
  });

  test("uploads to Dropbox and reopens cached audio offline without another provider download", async ({
    page,
    context,
  }) => {
    await saveMockStorageSettings(page, "dropbox");
    const upload = page.waitForRequest(
      "https://content.dropboxapi.com/2/files/upload"
    );
    await app.referenceSubmitButton.click();
    const request = await upload;
    expect(JSON.parse(request.headers()["dropbox-api-arg"]).path).toMatch(
      /^id:e2e-folder\//
    );
    expect(request.headers().authorization).toBe(
      "Bearer e2e-dropbox-access-token"
    );
    await expect(app.referencesList).toContainText("dropbox-private", {
      timeout: 20000,
    });
    const reference = app.referencesList
      .locator('[data-testid^="reference-link-"]')
      .filter({ hasText: "dropbox-private" });
    const downloads: string[] = [];
    page.on("request", (request) => {
      if (request.url() === "https://content.dropboxapi.com/2/files/download")
        downloads.push(request.url());
    });
    const download = page.waitForRequest(
      "https://content.dropboxapi.com/2/files/download"
    );
    await reference.click();
    expect((await download).headers().authorization).toBe(
      "Bearer e2e-dropbox-access-token"
    );
    await expect(app.audioPlayerPlayToggle).toBeEnabled({ timeout: 10000 });
    await app.audioPlayerCloseButton.click();
    await context.setOffline(true);
    await reference.click();
    await expect(app.audioPlayerPlayToggle).toBeEnabled({ timeout: 10000 });
    await expect(page.getByTestId("audio-player-source-status")).toContainText(
      "pinned offline",
      { timeout: 10000 }
    );
    expect(downloads).toHaveLength(1);
    await context.setOffline(false);
  });

  test("keeps tokens and binary bytes out of the real SQLite outbox", async ({
    page,
  }) => {
    await saveMockStorageSettings(page, "dropbox");
    await page.evaluate(async () => {
      if (!globalThis.window.__ttSyncControl?.stop)
        throw new Error("Expected sync control");
      await globalThis.window.__ttSyncControl.stop();
    });
    await app.referenceAudioFileInput.setInputFiles({
      name: "dropbox-private.wav",
      mimeType: "audio/wav",
      buffer: Buffer.from("PRIVATE_BINARY_SENTINEL"),
    });
    await app.referenceSubmitButton.click();
    await expect(app.referencesList).toContainText("dropbox-private", {
      timeout: 20000,
    });
    const data = await readByosDatabase(page);
    const outbox = JSON.stringify(data.outbox);
    expect(outbox).toContain("media_asset");
    expect(outbox).toContain("reference");
    // Assert real trigger rows AND their source records, not an empty outbox.
    expect(JSON.stringify(data.assets)).toContain("id:e2e-dropbox-audio");
    expect(JSON.stringify(data)).not.toMatch(
      /PRIVATE_BINARY_SENTINEL|e2e-(google|dropbox)-(refresh|access)-token/
    );
  });

  test("plays legacy R2 and private BYOS audio in the same reference panel", async ({
    page,
    testUser,
  }) => {
    await saveMockStorageSettings(page, "dropbox");
    await app.referenceSubmitButton.click();
    await expect(app.referencesList).toContainText("dropbox-private", {
      timeout: 20000,
    });
    await page.route("**/api/media/view?**", (route) =>
      route.fulfill({ contentType: "audio/wav", body: createSilentWavBuffer() })
    );
    await addLegacyAudio(page, testUser.userId);
    await expect(app.referencesList).toContainText("Legacy R2 regression", {
      timeout: 10000,
    });
    const legacyRequest = page.waitForRequest("**/api/media/view?**");
    await app.referencesList
      .locator('[data-testid^="reference-link-"]')
      .filter({ hasText: "Legacy R2 regression" })
      .click();
    expect((await legacyRequest).url()).toContain("legacy-regression.wav");
    await expect(app.audioPlayerPlayToggle).toBeEnabled({ timeout: 10000 });
    await app.audioPlayerCloseButton.click();
    await app.referencesList
      .locator('[data-testid^="reference-link-"]')
      .filter({ hasText: "dropbox-private" })
      .click();
    await expect(app.audioPlayerPlayToggle).toBeEnabled({ timeout: 10000 });
    const data = JSON.stringify((await readByosDatabase(page)).assets);
    expect(data).toContain("r2");
    expect(data).toContain("byos");
  });

  test("requires independent provider authorization on a second device for the same user", async ({
    page,
    context,
    browser,
    testUser,
  }) => {
    await saveMockStorageSettings(page, "dropbox");
    await app.referenceSubmitButton.click();
    await expect(app.referencesList).toContainText("dropbox-private", {
      timeout: 20000,
    });
    // Bootstrap with the same user's persisted metadata/auth, but never copy
    // local provider credentials, pending binaries, or the playback cache.
    const state = await context.storageState({ indexedDB: true });
    for (const origin of state.origins) {
      // Playwright serializes this field but omits it from the declared return type.
      const snapshot = origin as typeof origin & {
        indexedDB?: { name: string }[];
      };
      snapshot.indexedDB = snapshot.indexedDB?.filter(
        (db) =>
          ![
            "tunetrees-byos-secrets",
            "tunetrees-byos-drafts",
            "tunetrees-media-vault",
          ].includes(db.name)
      );
    }
    const device = await browser.newContext({ storageState: state });
    try {
      const second = await device.newPage();
      await mockDropboxRequests(second);
      await second.goto(page.url());
      const other = new TuneTreesPage(second);
      await other.ensureSidebarExpanded();
      await other.ensureTuneInfoExpanded();
      const link = other.referencesList
        .locator('[data-testid^="reference-link-"]')
        .filter({ hasText: "dropbox-private" });
      await expect(link).toBeVisible({ timeout: 20000 });
      await link.click();
      await expect(
        second.getByText("This audio is unavailable on this device.").first()
      ).toBeVisible({ timeout: 10000 });
      await expect(other.audioPlayerOverlay).toBeHidden({ timeout: 10000 });
      await configureMockDropboxByos(second, testUser.userId);
      await link.click();
      await expect(other.audioPlayerPlayToggle).toBeEnabled({ timeout: 10000 });
    } finally {
      await device.close();
    }
  });

  for (const cancel of [false, true]) {
    test(`serializes cross-tab replay without duplicates (cancel=${cancel})`, async ({
      page,
      context,
      testUser,
    }) => {
      await saveMockStorageSettings(page, "dropbox");
      const second = await context.newPage();
      await mockDropboxRequests(second);
      await second.goto(page.url());
      await second.waitForFunction(
        () => !!globalThis.window.__ttTestApi?.isInitialSyncComplete(),
        undefined,
        { timeout: 20000 }
      );
      let release!: () => void;
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      let uploads = 0;
      const holdUpload = async (route: Route) => {
        uploads += 1;
        await barrier;
        await route.fulfill({
          json: { id: "id:e2e-dropbox-audio", size: 16044 },
        });
      };
      // Intercept both tabs: a locking regression must fail, never reach Dropbox.
      await page.route(
        "https://content.dropboxapi.com/2/files/upload",
        holdUpload
      );
      await second.route(
        "https://content.dropboxapi.com/2/files/upload",
        holdUpload
      );
      try {
        const started = page.waitForRequest(
          "https://content.dropboxapi.com/2/files/upload"
        );
        await app.referenceSubmitButton.click();
        await started;
        await replayFromTab(second, testUser.userId);
        expect(uploads).toBe(1);
        const actions = {
          keep: async () => undefined,
          cancel: () => cancelFromTab(second, testUser.userId),
        };
        await actions[cancel ? "cancel" : "keep"]();
        release();
        // The first tab must observe cancellation in IndexedDB before committing.
        await page.waitForFunction(
          async (id) => {
            return !(await navigator.locks.query()).held?.some(
              (lock) => lock.name === `byos-uploads:${id}`
            );
          },
          testUser.userId,
          { timeout: 10000 }
        );
        await replayFromTab(page, testUser.userId);
        const data = JSON.stringify((await readByosDatabase(page)).assets);
        expect(data.includes("id:e2e-dropbox-audio")).toBe(!cancel);
        expect(uploads).toBe(1);
      } finally {
        release();
        await second.close();
      }
    });
  }

  for (const outcome of ["success", "cancel"] as const) {
    test(`preserves the file and fields after Dropbox OAuth ${outcome}`, async ({
      page,
    }) => {
      await app.referenceTitleInput.fill("Keep my Dropbox draft");
      const returnUrl = page.url();
      await page.route(
        "https://www.dropbox.com/oauth2/authorize?**",
        async (route) => {
          const url = new URL(route.request().url());
          expect(url.searchParams.get("code_challenge_method")).toBe("S256");
          expect(url.searchParams.has("client_secret")).toBe(false);
          const callback = new URL(url.searchParams.get("redirect_uri")!);
          callback.searchParams.set("state", url.searchParams.get("state")!);
          const result = {
            success: ["code", "mock-code"],
            cancel: ["error", "access_denied"],
          };
          callback.searchParams.set(result[outcome][0], result[outcome][1]);
          await route.fulfill({
            status: 302,
            headers: { Location: callback.toString() },
          });
        }
      );
      await page.getByTestId("byos-configure-storage").click();
      await page.getByTestId("byos-provider-dropbox").check();
      await Promise.all([
        page.waitForURL("**/byos/callback?**"),
        page.getByTestId("byos-provider-connect").click(),
      ]);
      await expect(page).toHaveURL(returnUrl, { timeout: 20000 });
      await app.closeSettings();
      await expect(app.referenceAudioSelectedFile).toHaveText(
        "dropbox-private.wav",
        { timeout: 10000 }
      );
      await expect(app.referenceTitleInput).toHaveValue(
        "Keep my Dropbox draft",
        { timeout: 10000 }
      );
      await expect(app.referencesCount).toHaveText(/^1 reference$/i, {
        timeout: 10000,
      });
    });
  }

  test("preserves the unsaved file and prevents OAuth navigation when IndexedDB writes fail", async ({
    page,
  }) => {
    const returnUrl = page.url();
    await page.evaluate(() => {
      const put = IDBObjectStore.prototype.put;
      // Fail only draft writes, leaving authentication and SQLite persistence intact.
      IDBObjectStore.prototype.put = function (value, key) {
        if (this.transaction.db.name === "tunetrees-byos-drafts") {
          throw new DOMException(
            "Draft storage quota exceeded",
            "QuotaExceededError"
          );
        }
        return put.call(this, value, key);
      };
    });
    await page.getByTestId("byos-configure-storage").click();
    await page.getByTestId("byos-provider-dropbox").check();
    await page.getByTestId("byos-provider-connect").click();
    await expect(page.getByTestId("byos-connection-status")).toContainText(
      "quota exceeded",
      { timeout: 10000 }
    );
    await expect(page).toHaveURL(returnUrl);
    await app.closeSettings();
    await expect(app.referenceAudioSelectedFile).toHaveText(
      "dropbox-private.wav",
      { timeout: 10000 }
    );
  });

  test("retains a queued file across reload and uploads once after connectivity returns", async ({
    page,
  }) => {
    await saveMockStorageSettings(page, "dropbox");
    // Keep the app shell reachable across reload while exercising the queue's
    // offline gate. This is a persistence test, not a service-worker cache test.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        get: () => false,
      });
    });
    await page.evaluate(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        get: () => false,
      });
    });
    await app.referenceSubmitButton.click();
    await expect(page.getByTestId("byos-queued-upload")).toContainText(
      "dropbox-private",
      { timeout: 10000 }
    );
    await page.reload();
    await app.ensureSidebarExpanded();
    await app.ensureTuneInfoExpanded();
    await expect(page.getByTestId("byos-queued-upload")).toContainText(
      "dropbox-private",
      { timeout: 20000 }
    );
    const uploads: string[] = [];
    page.on("request", (request) => {
      if (request.url() === "https://content.dropboxapi.com/2/files/upload")
        uploads.push(request.url());
    });
    await page.evaluate(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        get: () => true,
      });
      globalThis.dispatchEvent(new Event("online"));
    });
    await expect(app.referencesList).toContainText("dropbox-private", {
      timeout: 20000,
    });
    await expect(page.getByTestId("byos-queued-upload")).toHaveCount(0, {
      timeout: 10000,
    });
    expect(uploads).toHaveLength(1);
  });
});
