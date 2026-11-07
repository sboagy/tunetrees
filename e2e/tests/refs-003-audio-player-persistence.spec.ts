import { expect, type Page } from "@playwright/test";
import {
  configureMockGoogleDriveByos,
  createSilentWavBuffer,
  saveMockGoogleStorageSettings,
} from "../helpers/byos-provider";
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
  return page.evaluate((id) => {
    return (globalThis as any).__ttTestApi?.readMediaAssetRegions(id) ?? null;
  }, referenceId);
}

test.describe("REFS-003: Audio Reference Waveform Persistence", () => {
  test.setTimeout(180_000);

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
    testUser,
  }) => {
    await configureMockGoogleDriveByos(page, testUser.userId);
    // Use a long enough clip to observe transport transitions before it ends.
    const audioBytes = createSilentWavBuffer(12);
    await page.route(
      (url) =>
        url.hostname === "www.googleapis.com" &&
        url.searchParams.get("alt") === "media",
      (route) => route.fulfill({ contentType: "audio/wav", body: audioBytes })
    );
    await ttPage.referencesAddButton.click();
    await expect(ttPage.referenceForm).toBeVisible({ timeout: 10000 });

    await saveMockGoogleStorageSettings(page);

    await ttPage.selectReferenceType("audio");
    await ttPage.referenceAudioSourceUploadButton.click();
    await ttPage.referenceAudioFileInput.setInputFiles({
      name: "tt-e2e-audio-persist.wav",
      mimeType: "audio/wav",
      buffer: audioBytes,
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

    // Ensure WaveSurfer and regions plugin are fully ready before annotation clicks.
    await expect(ttPage.audioPlayerPlayToggle).toBeEnabled({ timeout: 10000 });

    await expect(page.getByTestId("audio-player-duration")).toHaveText("0:12");
    // Canvas lives in WaveSurfer's open shadow root; readiness alone does not
    // prove the waveform renderer survived the library upgrade.
    await expect(
      ttPage.audioPlayerWaveform.locator("canvas").first()
    ).toBeVisible({
      timeout: 10000,
    });
    await ttPage.audioPlayerPlayToggle.click();
    await expect(ttPage.audioPlayerPlayToggle).toHaveText("Pause (,)");
    await expect(page.getByTestId("audio-player-current-time")).not.toHaveText(
      "0:00"
    );
    await ttPage.audioPlayerPlayToggle.click();
    await expect(ttPage.audioPlayerPlayToggle).toHaveText("Play (,)");
    await page.getByTestId("audio-player-stop-button").click();
    await expect(page.getByTestId("audio-player-current-time")).toHaveText(
      "0:00"
    );
    await ttPage.audioPlayerWaveform.click({ position: { x: 100, y: 64 } });
    await expect(page.getByTestId("audio-player-current-time")).not.toHaveText(
      "0:00"
    );
    await page.getByTestId("audio-player-stop-button").click();
    await expect(page.getByTestId("audio-player-current-time")).toHaveText(
      "0:00"
    );

    await ttPage.audioPlayerAddRegionButton.click();
    await expect(ttPage.audioPlayerRegionList).toContainText("Loop 1");
    await ttPage.audioPlayerLoopToggle.check();
    await ttPage.audioPlayerPlayToggle.click();
    // Observe a real wrap across the four-second region boundary, rather than
    // only checking that the loop checkbox changes its appearance.
    await expect(page.getByTestId("audio-player-current-time")).toHaveText(
      "0:03",
      { timeout: 10000 }
    );
    await expect(page.getByTestId("audio-player-current-time")).toHaveText(
      "0:00",
      { timeout: 10000 }
    );
    await expect(ttPage.audioPlayerPlayToggle).toHaveText("Pause (,)");
    await page.getByTestId("audio-player-stop-button").click();
    await ttPage.audioPlayerAddBeatButton.click();
    await expect(ttPage.audioPlayerRegionList).toContainText("Beat 1");

    await ttPage.audioPlayerTempoSlider.fill("1.25");
    await ttPage.audioPlayerZoomSlider.fill("80");

    await expect(ttPage.audioPlayerZoomValue).toHaveText("80 px/s");
    await expect(ttPage.audioPlayerTempoSlider).toHaveValue("1.25");

    await ttPage.closeAudioPlayer();
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
