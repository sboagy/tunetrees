import { expect, type Page } from "@playwright/test";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

const GOOGLE_SECRET_DATABASE = "tunetrees-byos-secrets";
const GOOGLE_SECRET_STORE = "refresh-tokens";
const GOOGLE_FILE_ID = "e2e-google-drive-audio";

function createSilentWavBuffer(durationSeconds = 1, sampleRate = 8000) {
  const channelCount = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const sampleCount = durationSeconds * sampleRate;
  const dataSize = sampleCount * channelCount * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channelCount * bytesPerSample, 28);
  buffer.writeUInt16LE(channelCount * bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

/**
 * Exercises the production Google Drive adapter without contacting Google.
 * The provider still reads its isolated IndexedDB refresh-token store and
 * performs its normal refresh/upload/download calls; only those HTTP calls
 * are fulfilled by Playwright.
 */
export async function configureMockGoogleDriveByos(
  page: Page,
  userId: string
): Promise<void> {
  await page.evaluate(
    async ({ databaseName, storeName, key }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(storeName)) {
            request.result.createObjectStore(storeName, { keyPath: "key" });
          }
        };
        request.onerror = () =>
          reject(
            request.error ?? new Error("Could not open BYOS token store.")
          );
        request.onsuccess = () => resolve(request.result);
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction(storeName, "readwrite");
          transaction.objectStore(storeName).put({
            key,
            refreshToken: "e2e-google-refresh-token",
            updatedAt: new Date().toISOString(),
          });
          transaction.oncomplete = () => resolve();
          transaction.onerror = () =>
            reject(
              transaction.error ?? new Error("Could not seed BYOS token store.")
            );
        });
      } finally {
        database.close();
      }
    },
    {
      databaseName: GOOGLE_SECRET_DATABASE,
      storeName: GOOGLE_SECRET_STORE,
      key: `${userId}:google-drive`,
    }
  );

  await page.route("**/api/byos/google/token", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        token: { accessToken: "e2e-google-access-token", expiresIn: 3600 },
      }),
    });
  });
  await page.route(
    "https://www.googleapis.com/upload/drive/v3/files?**",
    async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          Location: "https://e2e-google-upload.invalid/session",
          "Access-Control-Expose-Headers": "Location",
        },
      });
    }
  );
  await page.route(
    "https://e2e-google-upload.invalid/session",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          id: GOOGLE_FILE_ID,
          name: "e2e-google-drive-audio.wav",
          mimeType: "audio/wav",
          size: "16044",
        }),
      });
    }
  );
  await page.route(
    "https://www.googleapis.com/drive/v3/files?**",
    async (route) =>
      route.fulfill({
        json: { files: [{ id: "e2e-folder", name: "tunetrees_storage" }] },
      })
  );
  await page.route(
    "https://www.googleapis.com/drive/v3/files/**",
    async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/generateIds")) {
        await route.fulfill({ json: { ids: [GOOGLE_FILE_ID] } });
      } else if (url.pathname.endsWith("/e2e-folder")) {
        await route.fulfill({
          json: {
            id: "e2e-folder",
            name: "tunetrees_storage",
            mimeType: "application/vnd.google-apps.folder",
          },
        });
      } else if (url.searchParams.get("alt") === "media") {
        await route.fulfill({
          contentType: "audio/wav",
          body: createSilentWavBuffer(),
        });
      } else {
        await route.fulfill({ status: 404, json: {} });
      }
    }
  );
}

/** Configure through the real settings dialog using the mocked local token. */
export async function saveMockGoogleStorageSettings(page: Page) {
  const before = page.url();
  await page.getByTestId("byos-configure-storage").click();
  await expect(page.getByTestId("byos-provider-google-drive")).toBeVisible({
    timeout: 10000,
  });
  await page.getByTestId("byos-provider-google-drive").check();
  await page.getByTestId("byos-folder-name").fill("tunetrees_storage");
  await page.getByTestId("byos-storage-save").click();
  await expect(page.getByTestId("byos-connection-status")).toContainText(
    /configured|Connected/,
    { timeout: 10000 }
  );
  await new TuneTreesPage(page).closeSettings();
  expect(page.url()).toBe(before);
  await expect(page.getByTestId("reference-form")).toBeVisible({
    timeout: 10000,
  });
}
