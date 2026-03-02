import { expect } from "@playwright/test";
import {
  TEST_TUNE_BANISH_ID,
  TEST_TUNE_BANISH_TITLE,
} from "../../tests/fixtures/test-data";
import {
  STANDARD_TEST_DATE,
  setStableDate,
  verifyClockFrozen,
} from "../helpers/clock-control";
import {
  seedSchedulingPluginLocally,
  setupForPracticeTestsParallel,
} from "../helpers/practice-scenarios";
import { queryLatestPracticeRecord } from "../helpers/scheduling-queries";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * SCHEDULING-010: Plugin Scheduler Override
 * Priority: HIGH
 *
 * Ensures scheduling plugins can override FSRS output deterministically.
 */

test.describe("SCHEDULING-010: Plugin Scheduler Override", () => {
  test.setTimeout(60000);

  let currentDate: Date;
  let ttPage: TuneTreesPage;

  test.beforeEach(async ({ page, context, testUser }) => {
    currentDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, currentDate);

    await page.addInitScript(() => {
      const stackTrace = () => {
        try {
          throw new Error("ReloadDiag");
        } catch (error) {
          if (error instanceof Error && typeof error.stack === "string") {
            return error.stack;
          }
          return String(error);
        }
      };

      const logReloadDiag = (
        event: string,
        details?: Record<string, unknown>
      ) => {
        const payload = {
          event,
          href: window.location.href,
          ts: new Date().toISOString(),
          details: details ?? null,
          stack: stackTrace(),
        };

        try {
          console.error(`[ReloadDiag] ${JSON.stringify(payload)}`);
        } catch (error) {
          console.error(
            `[ReloadDiag] serialization-failed ${event}: ${String(error)}`
          );
        }
      };

      const locationProto = Object.getPrototypeOf(window.location) as {
        reload?: (...args: unknown[]) => unknown;
        assign?: (...args: unknown[]) => unknown;
        replace?: (...args: unknown[]) => unknown;
        __ttReloadDiagPatched?: boolean;
      } | null;

      if (locationProto && !locationProto.__ttReloadDiagPatched) {
        const originalReload = locationProto.reload?.bind(window.location);
        const originalAssign = locationProto.assign?.bind(window.location);
        const originalReplace = locationProto.replace?.bind(window.location);

        if (typeof originalReload === "function") {
          locationProto.reload = (...args: unknown[]) => {
            logReloadDiag("location.reload", { argsCount: args.length });
            return originalReload(...args);
          };
        }

        if (typeof originalAssign === "function") {
          locationProto.assign = (...args: unknown[]) => {
            logReloadDiag("location.assign", { target: args[0] ?? null });
            return originalAssign(...args);
          };
        }

        if (typeof originalReplace === "function") {
          locationProto.replace = (...args: unknown[]) => {
            logReloadDiag("location.replace", { target: args[0] ?? null });
            return originalReplace(...args);
          };
        }

        locationProto.__ttReloadDiagPatched = true;
        logReloadDiag("location-hooks-installed");
      }

      const historyAny = window.history as {
        pushState?: (...args: unknown[]) => unknown;
        replaceState?: (...args: unknown[]) => unknown;
        __ttReloadDiagPatched?: boolean;
      };

      if (!historyAny.__ttReloadDiagPatched) {
        const originalPushState = historyAny.pushState?.bind(window.history);
        const originalReplaceState = historyAny.replaceState?.bind(
          window.history
        );

        if (typeof originalPushState === "function") {
          historyAny.pushState = (...args: unknown[]) => {
            logReloadDiag("history.pushState", { url: args[2] ?? null });
            return originalPushState(...args);
          };
        }

        if (typeof originalReplaceState === "function") {
          historyAny.replaceState = (...args: unknown[]) => {
            logReloadDiag("history.replaceState", { url: args[2] ?? null });
            return originalReplaceState(...args);
          };
        }

        historyAny.__ttReloadDiagPatched = true;
        logReloadDiag("history-hooks-installed");
      }

      window.addEventListener(
        "beforeunload",
        () => {
          logReloadDiag("event.beforeunload");
        },
        { capture: true }
      );

      window.addEventListener(
        "pagehide",
        (event) => {
          const persisted = (event as { persisted?: boolean }).persisted;
          logReloadDiag("event.pagehide", { persisted: persisted ?? null });
        },
        { capture: true }
      );

      document.addEventListener(
        "visibilitychange",
        () => {
          if (document.visibilityState === "hidden") {
            logReloadDiag("event.visibility.hidden");
          }
        },
        { capture: true }
      );
    });

    ttPage = new TuneTreesPage(page);
    await ttPage.setSchedulingPrefs();

    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: [TEST_TUNE_BANISH_ID],
      scheduleDaysAgo: 1,
      scheduleBaseDate: currentDate,
      startTab: "practice",
    });

    await seedSchedulingPluginLocally(page, {
      goals: ["recall"],
      userId: testUser.userId,
    });

    await verifyClockFrozen(
      page,
      currentDate,
      undefined,
      test.info().project.name
    );

    // Wait for any background syncs or plugin initialization to
    // complete before starting test actions.
    await page.waitForTimeout(4000);
  });

  test("should apply plugin schedule overrides", async ({ page, testUser }) => {
    const timeline: string[] = [];
    const stamp = (event: string, details?: Record<string, unknown>) => {
      const line = `[${new Date().toISOString()}] ${event}${details ? ` ${JSON.stringify(details)}` : ""}`;
      timeline.push(line);
      console.log(`[SCHED-010-DIAG] ${line}`);
    };

    const onConsole = (msg: import("@playwright/test").ConsoleMessage) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        stamp("browser-console", { type: msg.type(), text: msg.text() });
      }
    };

    const onMainFrameNavigated = (frame: import("@playwright/test").Frame) => {
      if (frame === page.mainFrame()) {
        stamp("main-frame-navigated", { url: frame.url() });
      }
    };

    page.on("console", onConsole);
    page.on("framenavigated", onMainFrameNavigated);
    page.on("load", () => stamp("page-load", { url: page.url() }));
    page.on("domcontentloaded", () =>
      stamp("domcontentloaded", { url: page.url() })
    );

    try {
      stamp("start", {
        userId: testUser.userId,
        repertoireId: testUser.repertoireId,
        url: page.url(),
      });

      await ttPage.navigateToTab("practice");
      stamp("after-navigate-to-practice", { url: page.url() });
      await expect(ttPage.practiceGrid).toBeVisible({ timeout: 20000 });
      stamp("practice-grid-visible");

      const row = ttPage.practiceGrid.locator("tbody tr[data-index='0']");
      await expect(
        row.getByRole("cell", { name: TEST_TUNE_BANISH_TITLE })
      ).toBeVisible({ timeout: 10000 });
      stamp("target-row-visible", { tuneTitle: TEST_TUNE_BANISH_TITLE });

      await ttPage.enableFlashcardMode();
      stamp("flashcard-mode-enabled");
      await expect(ttPage.flashcardView).toBeVisible({ timeout: 10000 });
      stamp("flashcard-visible");

      stamp("before-selectFlashcardEvaluation", {
        eval: "good",
        url: page.url(),
      });
      await ttPage.selectFlashcardEvaluation("good");
      stamp("after-selectFlashcardEvaluation");

      stamp("before-submitEvaluations", { timeoutMs: 60000, url: page.url() });
      await ttPage.submitEvaluations({ timeoutMs: 60000 });
      stamp("after-submitEvaluations");

      // await page.waitForLoadState("networkidle", { timeout: 15000 });
      await page.waitForTimeout(1200);
      stamp("after-post-submit-wait", {
        url: page.url(),
        hasLoadingQueue: await page
          .getByText("Loading practice queue...")
          .isVisible()
          .catch(() => false),
        hasNoTunes: await page
          .getByText("No tunes available")
          .isVisible()
          .catch(() => false),
      });

      const record = await queryLatestPracticeRecord(
        page,
        TEST_TUNE_BANISH_ID,
        testUser.repertoireId,
        { waitForRecordMs: 10000, pollIntervalMs: 300 }
      );
      if (!record) throw new Error("No practice record found after evaluation");
      stamp("queried-latest-practice-record", {
        interval: record.interval,
        practiced: record.practiced,
        due: record.due,
      });

      expect(record.interval).toBe(1);

      const practiced = new Date(record.practiced);
      const due = new Date(record.due);
      const diffDays = Math.round(
        (due.getTime() - practiced.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(diffDays).toBe(1);
      stamp("assertions-complete", { diffDays, interval: record.interval });
    } finally {
      page.off("console", onConsole);
      page.off("framenavigated", onMainFrameNavigated);
      await test.info().attach("scheduling-010-timeline", {
        body: timeline.join("\n"),
        contentType: "text/plain",
      });
    }
  });
});
