import { expect, type Page } from "@playwright/test";
import type { TuneTreesPage } from "../page-objects/TuneTreesPage";
import { setupForSetlistTestsParallel } from "./practice-scenarios";
import type { TestUser } from "./test-users";

export const SETLIST_TITLES = {
  alpha: "E2E Public Tune Setlist Alpha",
  beta: "E2E Public Tune Setlist Beta",
  gamma: "E2E Public Tune Setlist Gamma",
  delta: "E2E Public Tune Setlist Delta",
  defaultTuneSet: "Opening Pair",
  defaultSetlist: "Festival Warmup",
  secondarySetlist: "Encore Slots",
  emptySetlist: "Empty Finale",
} as const;

const PUBLIC_TUNE_TITLES = [
  SETLIST_TITLES.alpha,
  SETLIST_TITLES.beta,
  SETLIST_TITLES.gamma,
  SETLIST_TITLES.delta,
] as const;

export async function setupDefaultSetlistsScenario(
  page: Page,
  testUser: TestUser
) {
  return setupForSetlistTestsParallel(page, testUser, {
    repertoireTunes: [],
    publicTunes: PUBLIC_TUNE_TITLES.map((title) => ({ title })),
    sharedTuneSets: [
      {
        name: SETLIST_TITLES.defaultTuneSet,
        description: "Opening set for regression coverage",
        tuneIndexes: [1, 2],
      },
    ],
    setlists: [
      {
        name: SETLIST_TITLES.defaultSetlist,
        description: "Main stage opening run",
        items: [
          { kind: "tune", tuneIndex: 0 },
          { kind: "tune_set", tuneSetIndex: 0 },
          { kind: "tune", tuneIndex: 3 },
        ],
      },
      {
        name: SETLIST_TITLES.secondarySetlist,
        description: "Late-session backup order",
        items: [{ kind: "tune", tuneIndex: 1 }],
      },
    ],
  });
}

export async function setupEmptySetlistsScenario(
  page: Page,
  testUser: TestUser
) {
  return setupForSetlistTestsParallel(page, testUser, {
    repertoireTunes: [],
    setlists: [],
  });
}

export async function setupLibraryOnlySetlistsScenario(
  page: Page,
  testUser: TestUser
) {
  return setupForSetlistTestsParallel(page, testUser, {
    repertoireTunes: [],
    publicTunes: PUBLIC_TUNE_TITLES.map((title) => ({ title })),
    sharedTuneSets: [
      {
        name: SETLIST_TITLES.defaultTuneSet,
        description: "Opening set for regression coverage",
        tuneIndexes: [1, 2],
      },
    ],
    setlists: [],
  });
}

export async function setupNamedEmptySetlistScenario(
  page: Page,
  testUser: TestUser,
  setlistName = SETLIST_TITLES.emptySetlist
) {
  return setupForSetlistTestsParallel(page, testUser, {
    repertoireTunes: [],
    setlists: [
      {
        name: setlistName,
        description: "",
        items: [],
      },
    ],
  });
}

export async function acceptNextDialog(page: Page) {
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
}

export async function dismissNextDialog(page: Page) {
  page.once("dialog", async (dialog) => {
    await dialog.dismiss();
  });
}

export async function expectToast(page: Page, message: RegExp | string) {
  const toast =
    typeof message === "string"
      ? page.getByText(message, { exact: false })
      : page.getByText(message);
  await expect(toast).toBeVisible({ timeout: 10000 });
}

export async function waitForSetlistsViewReady(page: Page) {
  const grid = page.getByTestId("setlists-view-grid");
  await expect(grid).toBeVisible({ timeout: 15000 });
  await page
    .waitForLoadState("networkidle", { timeout: 15000 })
    .catch(() => undefined);
}

export async function waitForSetlistsEditReady(page: Page) {
  await expect(page.getByTestId("setlists-library-grid")).toBeVisible({
    timeout: 15000,
  });
  const editorGrid = page.getByTestId("setlists-editor-grid");
  const editorEmptyState = page.getByTestId("setlists-editor-empty-state");
  await expect
    .poll(
      async () => {
        const [gridVisible, emptyVisible] = await Promise.all([
          editorGrid.isVisible().catch(() => false),
          editorEmptyState.isVisible().catch(() => false),
        ]);
        return gridVisible || emptyVisible;
      },
      {
        timeout: 15000,
        intervals: [100, 250, 500, 1000],
      }
    )
    .toBe(true);
  await page
    .waitForLoadState("networkidle", { timeout: 15000 })
    .catch(() => undefined);
}

export async function enterSetlistsEditMode(ttPage: TuneTreesPage, page: Page) {
  await ttPage.clickSetlistsEdit();
  await waitForSetlistsEditReady(page);
}

export async function enterSetlistsCreateMode(
  ttPage: TuneTreesPage,
  page: Page
) {
  await ttPage.clickSetlistsNew();
  await waitForSetlistsEditReady(page);
}
