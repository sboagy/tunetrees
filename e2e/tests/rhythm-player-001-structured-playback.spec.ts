/**
 * RHYTHM-001: Structured Playback Reaches B Section
 * Priority: Critical
 *
 * Reproduces the browser-visible playback bug where the rhythm player loops the
 * first line instead of advancing through the tune structure.
 */

import { expect } from "@playwright/test";
import {
  TEST_TUNE_MORRISON_ID,
  TEST_TUNE_MORRISON_TITLE,
} from "../../tests/fixtures/test-data";
import {
  navigateToTabForTest,
  setupForRepertoireTestsParallel,
} from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

type ActiveNotationSnapshot = {
  lineIndex: number;
  x: number;
};

const ACTIVE_NOTE_POLL_INTERVAL_MS = 150;
const MIN_ACTIVE_NOTE_OBSERVATION_MS = 30_000;
const MAX_ACTIVE_NOTE_OBSERVATION_MS = 45_000;
const ACTIVE_NOTE_OBSERVATION_SAFETY_MULTIPLIER = 4;

function getStructureRepeatFactor(structureText: string): number {
  const sectionLabels = structureText.match(/[A-Za-z]+/g) ?? [];
  if (sectionLabels.length === 0) {
    return 1;
  }

  const normalizedLabels = sectionLabels.map((label) => label.toUpperCase());
  const distinctLabels = new Set(normalizedLabels);
  return Math.max(1, normalizedLabels.length / distinctLabels.size);
}

function getActiveNoteObservationBudgetMs(options: {
  structureText: string;
  renderedNoteCount: number;
  tempoQpm: number;
}): number {
  const normalizedTempo = Math.max(options.tempoQpm, 1);
  const normalizedRenderedNoteCount = Math.max(options.renderedNoteCount, 1);
  const repeatFactor = getStructureRepeatFactor(options.structureText);

  // abcjs timing callbacks can represent subdivisions denser than quarter-note
  // beats, so base the wait budget on an eighth-note cadence and pad it for CI.
  const estimatedTraversalMs =
    (normalizedRenderedNoteCount *
      repeatFactor *
      60_000 *
      ACTIVE_NOTE_OBSERVATION_SAFETY_MULTIPLIER) /
    (normalizedTempo * 2);

  return Math.min(
    MAX_ACTIVE_NOTE_OBSERVATION_MS,
    Math.max(MIN_ACTIVE_NOTE_OBSERVATION_MS, Math.ceil(estimatedTraversalMs))
  );
}

test.describe
  .serial("RHYTHM-001: Structured Playback Reaches B Section", () => {
    test.setTimeout(90_000);

    test("should advance through the full AABB loop during browser playback", async ({
      page,
      testUser,
    }) => {
      await page.addInitScript(() => {
        const audioContextPrototype = globalThis.AudioContext?.prototype;
        if (!audioContextPrototype) {
          return;
        }

        const originalDecodeAudioData = audioContextPrototype.decodeAudioData;
        audioContextPrototype.decodeAudioData = function decodeAudioDataStub(
          this: AudioContext,
          audioData: ArrayBuffer
        ) {
          audioData;
          return Promise.resolve(this.createBuffer(1, 1, 44_100));
        };

        // Preserve a reference for debugging if the browser test needs to inspect
        // whether audio decoding was stubbed.
        (
          window as Window & {
            __ttOriginalDecodeAudioData?: typeof originalDecodeAudioData;
          }
        ).__ttOriginalDecodeAudioData = originalDecodeAudioData;
      });

      await page.route("**/audio/kits/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "audio/mpeg",
          body: "stub-audio",
        });
      });

      await setupForRepertoireTestsParallel(page, testUser, {
        repertoireTunes: [TEST_TUNE_MORRISON_ID],
        scheduleTunes: false,
      });

      const ttPage = new TuneTreesPage(page);
      await navigateToTabForTest(page, "repertoire");
      await ttPage.expectGridHasContent(ttPage.repertoireGrid);
      await ttPage.expectTuneVisible(
        TEST_TUNE_MORRISON_TITLE,
        ttPage.repertoireGrid
      );

      const tuneRow = ttPage.repertoireGrid
        .locator('tbody tr[data-index], li[data-testid^="stacked-item-"]')
        .filter({
          hasText: TEST_TUNE_MORRISON_TITLE,
        })
        .first();
      await expect(tuneRow).toBeVisible({ timeout: 10_000 });
      await tuneRow
        .getByRole("button", { name: /Open rhythm player for/i })
        .click();

      const sectionSelect = page.getByTestId(
        "rhythm-player-start-section-select"
      );
      const tempoInput = page.getByTestId("rhythm-player-tempo-input");
      const playButton = page.getByTestId("rhythm-player-play-toggle");
      const notation = page.getByTestId("rhythm-player-notation");
      const overflowButton = page.getByTestId("rhythm-player-overflow-button");
      const tempoQpm = 220;

      await expect(page.getByTestId("rhythm-player-title")).toContainText(
        "Rhythm Player",
        {
          timeout: 10_000,
        }
      );
      await expect(page.getByTestId("rhythm-player-structure")).toContainText(
        "AABB",
        {
          timeout: 10_000,
        }
      );
      const structureText =
        (await page.getByTestId("rhythm-player-structure").textContent()) ?? "";

      // Mobile moves the start-section and tempo controls into the overflow
      // menu. Open it only when the inline controls are not currently visible.
      const needsOverflowMenu = !(await sectionSelect
        .isVisible()
        .catch(() => false));
      if (needsOverflowMenu) {
        await overflowButton.click();
      }

      await expect(sectionSelect).toHaveValue("A1", {
        timeout: 10_000,
      });
      await tempoInput.fill(String(tempoQpm));
      await tempoInput.press("Tab");

      if (needsOverflowMenu) {
        await page.keyboard.press("Escape");
      }

      await playButton.click();

      let notationLineIndices: number[] = [];
      let renderedNoteCount = 0;
      await expect
        .poll(
          async () => {
            const notationState = await notation.evaluate((container) => {
              const noteLines = Array.from(
                container.querySelectorAll<SVGElement>(".abcjs-note")
              )
                .map((note) => {
                  const match = (note.getAttribute("class") ?? "").match(
                    /abcjs-l(\d+)/
                  );
                  return match ? Number.parseInt(match[1] ?? "", 10) : null;
                })
                .filter((value): value is number => value != null);

              return {
                lineIndices: Array.from(new Set(noteLines)).sort(
                  (left, right) => {
                    return left - right;
                  }
                ),
                noteCount: noteLines.length,
              };
            });

            notationLineIndices = notationState.lineIndices;
            renderedNoteCount = notationState.noteCount;

            return notationLineIndices.length;
          },
          {
            timeout: 10_000,
            intervals: [100, 250, 500, 1000],
          }
        )
        .toBeGreaterThan(1);

      const readActiveNotationSnapshot =
        async (): Promise<ActiveNotationSnapshot | null> =>
          notation.evaluate((container) => {
            const activeElement =
              container.querySelector<SVGGraphicsElement>(
                ".abcjs-notehead.tnt-active-note"
              ) ??
              container.querySelector<SVGGraphicsElement>(".tnt-active-note");

            if (!activeElement) {
              return null;
            }

            const noteGroup = activeElement.closest(".abcjs-note");
            const className =
              noteGroup?.getAttribute("class") ??
              activeElement.getAttribute("class") ??
              "";
            const match = className.match(/abcjs-l(\d+)/);
            if (!match) {
              return null;
            }

            const lineIndex = Number.parseInt(match[1] ?? "", 10);
            if (!Number.isFinite(lineIndex)) {
              return null;
            }

            const box = activeElement.getBBox();
            return {
              lineIndex,
              x: box.x,
            };
          });

      const firstNotationLine = notationLineIndices[0] ?? 0;
      const observedLineSegments: number[] = [];
      const firstVisitedNotationLines: number[] = [];
      const visitedNotationLines = new Set<number>();
      let lastSnapshot: ActiveNotationSnapshot | null = null;
      let returnedToFirstNotationLine = false;
      const activeNoteObservationBudgetMs = getActiveNoteObservationBudgetMs({
        structureText,
        renderedNoteCount,
        tempoQpm,
      });
      const maxObservationAttempts = Math.ceil(
        activeNoteObservationBudgetMs / ACTIVE_NOTE_POLL_INTERVAL_MS
      );

      // Follow the actual highlighted note in the rendered SVG. The notation
      // panel may be scrolled, so this reads the full SVG DOM rather than the
      // visible viewport. The regression should fail immediately the first time
      // the blue note jumps backward on the same rendered line before playback
      // has traversed the later notation lines. The wait budget scales with
      // the rendered note count and repeated-structure factor instead of using
      // a fixed 24-second cap that can be too short on slower CI runs.
      for (let attempt = 0; attempt < maxObservationAttempts; attempt += 1) {
        const snapshot = await readActiveNotationSnapshot();
        if (snapshot) {
          const wrappedOnSameLine =
            lastSnapshot &&
            snapshot.lineIndex === lastSnapshot.lineIndex &&
            snapshot.x < lastSnapshot.x - 8;
          const changedLine =
            !lastSnapshot || snapshot.lineIndex !== lastSnapshot.lineIndex;

          if (wrappedOnSameLine) {
            const remainingLines = notationLineIndices.filter(
              (lineIndex) => !visitedNotationLines.has(lineIndex)
            );

            if (remainingLines.length > 0) {
              throw new Error(
                `Playback wrapped backward on notation line ${snapshot.lineIndex} before reaching later lines: ${remainingLines.join(", ")}`
              );
            }
          }

          if (changedLine || wrappedOnSameLine) {
            observedLineSegments.push(snapshot.lineIndex);
          }

          if (!visitedNotationLines.has(snapshot.lineIndex)) {
            firstVisitedNotationLines.push(snapshot.lineIndex);
          }

          visitedNotationLines.add(snapshot.lineIndex);

          if (
            visitedNotationLines.size === notationLineIndices.length &&
            lastSnapshot &&
            snapshot.lineIndex === firstNotationLine &&
            snapshot.lineIndex !== lastSnapshot.lineIndex
          ) {
            returnedToFirstNotationLine = true;
            break;
          }

          lastSnapshot = snapshot;
        }

        await page.waitForTimeout(ACTIVE_NOTE_POLL_INTERVAL_MS);
      }

      expect(firstVisitedNotationLines).toEqual(notationLineIndices);
      expect(observedLineSegments.length).toBeGreaterThanOrEqual(
        notationLineIndices.length
      );
      expect(returnedToFirstNotationLine).toBe(true);
    });
  });
