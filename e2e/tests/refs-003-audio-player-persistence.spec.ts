import { expect, type Page } from "@playwright/test";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * REFS-003: Audio Reference Waveform Persistence
 * Priority: Critical
 *
 * Guards the browser save/reopen path for waveform marks, regions, and settings.
 */

let ttPage: TuneTreesPage;

async function readPersistedAudioState(page: Page, referenceId: string) {
  return page.evaluate(async (id) => {
    const { getDb } = await import("/src/lib/db/client-sqlite.ts");
    const { getMediaAssetByReferenceId } = await import(
      "/src/lib/db/queries/media-assets.ts"
    );

    const db = getDb();
    if (!db) {
      return null;
    }

    const mediaAsset = await getMediaAssetByReferenceId(db, id);
    return mediaAsset?.regionsJson ?? null;
  }, referenceId);
}

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

test.describe("REFS-003: Audio Reference Waveform Persistence", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);

    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
      clearNotesAndReferences: true,
    });

    await ttPage.navigateToTab("catalog");
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });

    await ttPage.searchForTune("Banish Misfortune", ttPage.catalogGrid);
    await page.waitForTimeout(500);

    const tuneRow = ttPage.getRows("catalog").first();
    await expect(tuneRow).toBeVisible({ timeout: 5000 });
    await tuneRow.click();

    await ttPage.ensureSidebarExpanded();
    await ttPage.ensureTuneInfoExpanded();

    await expect(
      page.getByRole("heading", { name: "Banish Misfortune" })
    ).toBeVisible({ timeout: 10000 });
  });

  test("should persist waveform marks, regions, tempo, and zoom after closing and reopening", async ({
    page,
  }) => {
    await ttPage.referencesAddButton.click();
    await expect(ttPage.referenceForm).toBeVisible({ timeout: 10000 });

    await ttPage.selectReferenceType("audio");
    await ttPage.referenceAudioSourceUploadButton.click();
    await ttPage.referenceAudioFileInput.setInputFiles({
      name: "tt-e2e-audio-persist.wav",
      mimeType: "audio/wav",
      buffer: createSilentWavBuffer(),
    });

    await expect(ttPage.referenceAudioSelectedFile).toHaveText(
      "tt-e2e-audio-persist.wav",
      {
        timeout: 5000,
      }
    );
    await expect(ttPage.referenceSubmitButton).toBeEnabled({ timeout: 5000 });

    await ttPage.referenceSubmitButton.click();
    await expect(ttPage.referencesCount).toHaveText(/^2 references$/i, {
      timeout: 20000,
    });

    const audioReference = ttPage.referencesList
      .locator('[data-testid^="reference-link-"]')
      .filter({ hasText: "tt-e2e-audio-persist" })
      .first();
    const referenceTestId = await audioReference.getAttribute("data-testid");
    const referenceId = referenceTestId?.replace("reference-link-", "");

    expect(referenceId).toBeTruthy();

    await audioReference.click();

    await expect(ttPage.audioPlayerOverlay).toBeVisible({ timeout: 10000 });
    await expect(ttPage.audioPlayerTitle).toContainText("tt-e2e-audio-persist");

    await ttPage.audioPlayerAddRegionButton.click();
    await ttPage.audioPlayerAddBeatButton.click();
    await page
      .locator('[data-testid^="audio-player-region-"]')
      .first()
      .waitFor({
        state: "visible",
        timeout: 5000,
      });

    await ttPage.audioPlayerTempoSlider.fill("1.25");
    await ttPage.audioPlayerZoomSlider.fill("80");

    await expect(ttPage.audioPlayerRegionList).toContainText("Loop 1");
    await expect(ttPage.audioPlayerRegionList).toContainText("Beat 1");
    await expect(ttPage.audioPlayerZoomValue).toHaveText("80 px/s");
    await expect(ttPage.audioPlayerTempoSlider).toHaveValue("1.25");

    await ttPage.audioPlayerCloseButton.click();
    await expect(ttPage.audioPlayerOverlay).toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(500);

    const persistedRegionsJson = await readPersistedAudioState(
      page,
      referenceId!
    );
    expect(persistedRegionsJson).toBeTruthy();

    const persistedState = JSON.parse(persistedRegionsJson!) as {
      regions: Array<{ label?: string | null }>;
      settings: { playbackRate: number; zoomLevel: number };
    };

    expect(persistedState.settings).toMatchObject({
      playbackRate: 1.25,
      zoomLevel: 80,
    });
    expect(persistedState.regions).toMatchObject([
      { label: "Loop 1" },
      { label: "Beat 1" },
    ]);

    await audioReference.click();

    await expect(ttPage.audioPlayerOverlay).toBeVisible({ timeout: 10000 });
    await expect(ttPage.audioPlayerRegionList).toContainText("Loop 1");
    await expect(ttPage.audioPlayerRegionList).toContainText("Beat 1");
    await expect(ttPage.audioPlayerZoomValue).toHaveText("80 px/s");
    await expect(ttPage.audioPlayerTempoSlider).toHaveValue("1.25");
  });
});
