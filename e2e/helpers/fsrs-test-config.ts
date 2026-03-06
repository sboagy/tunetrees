import type { Page } from "@playwright/test";

export type FsrsTestConfig = {
  repertoireSize: number;
  enableFuzz: boolean;
  maxReviews: number;
  scheduleNewTunesAutomatically?: boolean;
};

export const DEFAULT_DETERMINISTIC_FSRS_TEST_CONFIG: FsrsTestConfig = {
  repertoireSize: 419,
  enableFuzz: false,
  maxReviews: 7,
};

export async function applyDeterministicFsrsConfig(
  page: Page,
  overrides: Partial<FsrsTestConfig> = {}
): Promise<FsrsTestConfig> {
  const config: FsrsTestConfig = {
    ...DEFAULT_DETERMINISTIC_FSRS_TEST_CONFIG,
    ...overrides,
  };

  await page.addInitScript((cfg: FsrsTestConfig) => {
    (window as any).__TUNETREES_TEST_REPERTOIRE_SIZE__ = cfg.repertoireSize;
    (window as any).__TUNETREES_TEST_ENABLE_FUZZ__ = cfg.enableFuzz;
    (window as any).__TUNETREES_TEST_MAX_REVIEWS_PER_DAY__ = cfg.maxReviews;

    if (typeof cfg.scheduleNewTunesAutomatically === "boolean") {
      (window as any).__TUNETREES_TEST_SCHEDULE_NEW_TUNES_AUTOMATICALLY__ =
        cfg.scheduleNewTunesAutomatically;
    }
  }, config);

  return config;
}
