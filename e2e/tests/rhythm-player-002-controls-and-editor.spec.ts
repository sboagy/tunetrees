/**
 * RHYTHM-002: Rhythm player controls and custom pattern editor
 * Priority: High
 *
 * Covers the Phase 8 browser flows for swing/tempo overrides, dialog/notation
 * visibility, and the custom `swing_desc` editor with inherited default-row
 * fallback for custom patterns that save `NULL` descriptors.
 */

import { expect, type Locator, type Page } from "@playwright/test";
import {
  TEST_TUNE_BANISH_ID,
  TEST_TUNE_BANISH_TITLE,
  TEST_TUNE_MORRISON_ID,
  TEST_TUNE_MORRISON_TITLE,
} from "../../tests/fixtures/test-data";
import {
  navigateToTabForTest,
  setupForRepertoireTestsParallel,
} from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

const RHYTHM_DIALOG_TIMEOUT_MS = 15_000;

async function openRhythmPlayerForTune(
  page: Page,
  ttPage: TuneTreesPage,
  tuneTitle: string
): Promise<void> {
  await navigateToTabForTest(page, "repertoire");
  await ttPage.expectGridHasContent(ttPage.repertoireGrid);
  await ttPage.expectTuneVisible(tuneTitle, ttPage.repertoireGrid, 10_000);

  const tuneRow = ttPage.repertoireGrid
    .locator('tbody tr[data-index], li[data-testid^="stacked-item-"]')
    .filter({ hasText: tuneTitle })
    .first();
  await expect(tuneRow).toBeVisible({ timeout: 10_000 });
  await tuneRow
    .getByRole("button", { name: /Open rhythm player for/i })
    .click();

  await expect(page.getByTestId("rhythm-player-dialog")).toBeVisible({
    timeout: RHYTHM_DIALOG_TIMEOUT_MS,
  });
  await expect(page.getByTestId("rhythm-player-title")).toContainText(
    "Rhythm Player",
    {
      timeout: RHYTHM_DIALOG_TIMEOUT_MS,
    }
  );
  await expect(page.getByTestId("rhythm-player-notation")).toBeVisible({
    timeout: RHYTHM_DIALOG_TIMEOUT_MS,
  });
}

async function ensureRhythmControlsVisible(page: Page): Promise<{
  tempoInput: Locator;
  swingInput: Locator;
  startSectionSelect: Locator;
  usingOverflow: boolean;
}> {
  const tempoInput = page.getByTestId("rhythm-player-tempo-input");
  const swingInput = page.getByTestId("rhythm-player-swing-input");
  const startSectionSelect = page.getByTestId(
    "rhythm-player-start-section-select"
  );

  const usingOverflow = !(await tempoInput.isVisible().catch(() => false));
  if (usingOverflow) {
    await expect(page.getByTestId("rhythm-player-overflow-button")).toBeVisible(
      {
        timeout: 10_000,
      }
    );
    await page.getByTestId("rhythm-player-overflow-button").click();
  }

  await expect(tempoInput).toBeVisible({ timeout: 10_000 });
  await expect(swingInput).toBeVisible({ timeout: 10_000 });
  await expect(startSectionSelect).toBeVisible({ timeout: 10_000 });

  return {
    tempoInput,
    swingInput,
    startSectionSelect,
    usingOverflow,
  };
}

async function closeRhythmOverflowIfNeeded(
  page: Page,
  usingOverflow: boolean
): Promise<void> {
  if (!usingOverflow) {
    return;
  }

  await page.keyboard.press("Escape").catch(() => undefined);
}

async function readSelectedPatternLabel(page: Page): Promise<string> {
  const patternSelect = page.getByTestId("rhythm-player-pattern-select");
  if (await patternSelect.isVisible().catch(() => false)) {
    return await patternSelect.evaluate((element) => {
      if (!(element instanceof HTMLSelectElement)) {
        return "";
      }

      return element.selectedOptions[0]?.textContent?.trim() ?? "";
    });
  }

  const currentPatternBadge = page.getByTestId(
    "rhythm-player-current-pattern-badge"
  );
  if (await currentPatternBadge.isVisible().catch(() => false)) {
    return (await currentPatternBadge.textContent())?.trim() ?? "";
  }

  return "";
}

async function clearUserRhythmPatterns(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const api = (
      globalThis as unknown as {
        __ttTestApi?: {
          clearUserRhythmPatterns?: (userId?: string) => Promise<number>;
        };
      }
    ).__ttTestApi;

    if (typeof api?.clearUserRhythmPatterns !== "function") {
      throw new TypeError(
        "__ttTestApi.clearUserRhythmPatterns is not available"
      );
    }

    await api.clearUserRhythmPatterns();
  });
}

test.describe("RHYTHM-002: Rhythm player controls and custom pattern editor", () => {
  test.setTimeout(120_000);

  let ttPage: TuneTreesPage;

  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);

    await setupForRepertoireTestsParallel(page, testUser, {
      repertoireTunes: [TEST_TUNE_MORRISON_ID, TEST_TUNE_BANISH_ID],
      scheduleTunes: false,
    });
  });

  test("persists tempo and swing overrides and resets them to defaults", async ({
    page,
  }) => {
    await openRhythmPlayerForTune(page, ttPage, TEST_TUNE_MORRISON_TITLE);

    const { tempoInput, swingInput, usingOverflow } =
      await ensureRhythmControlsVisible(page);
    const swingError = page.getByTestId("rhythm-player-swing-error");
    const tempoReset = page.getByTestId("rhythm-player-tempo-reset");
    const swingReset = page.getByTestId("rhythm-player-swing-reset");

    const defaultTempo = await tempoInput.inputValue();
    const defaultSwing = await swingInput.inputValue();

    await swingInput.fill("101");
    await expect(swingError).toHaveText("Enter a whole number from 0 to 100.", {
      timeout: 10_000,
    });

    await tempoInput.fill("132");
    await swingInput.click();
    await swingInput.fill("27");
    await expect(tempoInput).toHaveValue("132", { timeout: 10_000 });
    await expect(swingInput).toHaveValue("27", { timeout: 10_000 });
    await expect(swingError).toHaveCount(0, { timeout: 10_000 });

    await closeRhythmOverflowIfNeeded(page, usingOverflow);
    await page.getByTestId("rhythm-player-close-button").click();
    await expect(page.getByTestId("rhythm-player-dialog")).toBeHidden({
      timeout: 10_000,
    });

    await openRhythmPlayerForTune(page, ttPage, TEST_TUNE_MORRISON_TITLE);

    const reopenedControls = await ensureRhythmControlsVisible(page);
    await expect(reopenedControls.tempoInput).toHaveValue("132", {
      timeout: 10_000,
    });
    await expect(reopenedControls.swingInput).toHaveValue("27", {
      timeout: 10_000,
    });

    await tempoReset.click();
    await swingReset.click();
    await expect(reopenedControls.tempoInput).toHaveValue(defaultTempo, {
      timeout: 10_000,
    });
    await expect(reopenedControls.swingInput).toHaveValue(defaultSwing, {
      timeout: 10_000,
    });
  });

  test("keeps the rhythm dialog and notation visible within a narrow viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 430, height: 900 });
    await openRhythmPlayerForTune(page, ttPage, TEST_TUNE_MORRISON_TITLE);

    const dialog = page.getByTestId("rhythm-player-dialog");
    const notationViewport = page.getByTestId("rhythm-player-notation");
    const notationContainer = page.getByTestId("abc-notation-container");

    const dialogMetrics = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        viewportWidth: globalThis.innerWidth,
        viewportHeight: globalThis.innerHeight,
      };
    });
    expect(dialogMetrics.left).toBeGreaterThanOrEqual(-1);
    expect(dialogMetrics.top).toBeGreaterThanOrEqual(-1);
    expect(dialogMetrics.right).toBeLessThanOrEqual(
      dialogMetrics.viewportWidth + 1
    );
    expect(dialogMetrics.bottom).toBeLessThanOrEqual(
      dialogMetrics.viewportHeight + 1
    );

    await expect(notationViewport).toBeVisible({ timeout: 10_000 });
    await expect(notationContainer).toBeVisible({ timeout: 10_000 });

    const notationMetrics = await notationContainer.evaluate((element) => {
      return {
        hasSvg: Boolean(element.querySelector("svg")),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      };
    });
    expect(notationMetrics.hasSvg).toBe(true);
    expect(
      notationMetrics.scrollWidth - notationMetrics.clientWidth
    ).toBeLessThanOrEqual(24);

    const narrowViewportControls = await ensureRhythmControlsVisible(page);
    expect(narrowViewportControls.usingOverflow).toBe(true);
  });

  test("saves swing_desc overrides and inherits default swing when descriptor is null", async ({
    page,
  }) => {
    await clearUserRhythmPatterns(page);
    await openRhythmPlayerForTune(page, ttPage, TEST_TUNE_BANISH_TITLE);

    const controls = await ensureRhythmControlsVisible(page);
    const inheritedDefaultSwing = await controls.swingInput.inputValue();
    await closeRhythmOverflowIfNeeded(page, controls.usingOverflow);

    const patternName = `RHYTHM-002 ${test.info().workerIndex} ${Date.now()}`;

    await page.getByTestId("rhythm-player-custom-pattern-open-button").click();
    const editor = page.getByTestId("rhythm-player-custom-pattern-editor");
    const inheritCheckbox = page.getByTestId(
      "rhythm-player-custom-pattern-swing-desc-inherit-checkbox"
    );

    await expect(editor).toBeVisible({ timeout: 10_000 });
    await page
      .getByTestId("rhythm-player-custom-pattern-name-input")
      .fill(patternName);
    await expect(inheritCheckbox).toBeChecked({ timeout: 10_000 });
    await expect(
      page.getByTestId(
        "rhythm-player-custom-pattern-swing-desc-inherit-summary"
      )
    ).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("rhythm-player-custom-pattern-save-button").click();
    await expect(editor).toBeHidden({ timeout: 10_000 });

    await expect(
      page.getByTestId("rhythm-player-current-pattern-badge")
    ).toBeVisible({ timeout: 10_000 });

    // Poll for the saved pattern name to surface after the async save/reload cycle.
    await expect
      .poll(async () => await readSelectedPatternLabel(page), {
        timeout: 10_000,
        intervals: [100, 250, 500],
      })
      .toContain(patternName);

    const inheritedControls = await ensureRhythmControlsVisible(page);
    const swingOverrideValue = inheritedDefaultSwing === "0" ? "25" : "0";
    await inheritedControls.swingInput.fill(swingOverrideValue);
    await expect(inheritedControls.swingInput).toHaveValue(swingOverrideValue, {
      timeout: 10_000,
    });
    await page.getByTestId("rhythm-player-swing-reset").click();
    await expect(inheritedControls.swingInput).toHaveValue(
      inheritedDefaultSwing,
      {
        timeout: 10_000,
      }
    );
    await closeRhythmOverflowIfNeeded(page, inheritedControls.usingOverflow);

    await page.getByTestId("rhythm-player-custom-pattern-edit-button").click();
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await expect(inheritCheckbox).toBeChecked({ timeout: 10_000 });

    await inheritCheckbox.uncheck();
    await expect(inheritCheckbox).not.toBeChecked({ timeout: 10_000 });
    await page
      .getByTestId(
        "rhythm-player-custom-pattern-swing-desc-default-factor-input"
      )
      .fill("1.24");
    await page
      .getByTestId("rhythm-player-custom-pattern-swing-desc-humanization-input")
      .fill("21");
    await page
      .getByTestId(
        "rhythm-player-custom-pattern-swing-desc-velocity-pattern-input"
      )
      .fill("100, 70, 50");
    await page
      .getByTestId("rhythm-player-custom-pattern-swing-desc-balance-checkbox")
      .uncheck();

    await page.getByTestId("rhythm-player-custom-pattern-save-button").click();
    await expect(editor).toBeHidden({ timeout: 10_000 });

    const overriddenControls = await ensureRhythmControlsVisible(page);
    await overriddenControls.swingInput.fill("0");
    await page.getByTestId("rhythm-player-swing-reset").click();
    await expect(overriddenControls.swingInput).toHaveValue("24", {
      timeout: 10_000,
    });
    await closeRhythmOverflowIfNeeded(page, overriddenControls.usingOverflow);

    await page.getByTestId("rhythm-player-custom-pattern-edit-button").click();
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await expect(inheritCheckbox).not.toBeChecked({ timeout: 10_000 });
    await expect(
      page.getByTestId(
        "rhythm-player-custom-pattern-swing-desc-default-factor-input"
      )
    ).toHaveValue("1.24", { timeout: 10_000 });
    await expect(
      page.getByTestId(
        "rhythm-player-custom-pattern-swing-desc-humanization-input"
      )
    ).toHaveValue("21", { timeout: 10_000 });
    await expect(
      page.getByTestId(
        "rhythm-player-custom-pattern-swing-desc-velocity-pattern-input"
      )
    ).toHaveValue("100, 70, 50", { timeout: 10_000 });
    await expect(
      page.getByTestId(
        "rhythm-player-custom-pattern-swing-desc-balance-checkbox"
      )
    ).not.toBeChecked({ timeout: 10_000 });
  });
});
