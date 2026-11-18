import { createRoot, createSignal } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";
import { runGoalQueueCommand } from "@/lib/goals/queue-commands";
import { getLatestActiveQueueWindow } from "@/lib/services/practice-queue";
import { usePracticeQueueDate } from "@/routes/practice/usePracticeQueueDate";

vi.mock("@/lib/services/practice-queue", () => ({
  getLatestActiveQueueWindow: vi.fn(),
  getRecentActiveQueueWindows: vi.fn(async () => []),
}));

vi.mock("@/lib/goals/queue-commands", () => ({
  runGoalQueueCommand: vi.fn(async () => ({
    rows: [],
    addedTuneIds: [],
    shortfalls: [],
    notices: [],
  })),
}));

let dispose: () => void;
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => dispose());

function setup(initialSync = false) {
  return createRoot((cleanup) => {
    dispose = cleanup;
    const [localDb, setDb] = createSignal({} as SqliteDatabase);
    const [userId, setUser] = createSignal("user");
    const [currentRepertoireId, setRepertoire] = createSignal("rep");
    const dates = usePracticeQueueDate({
      localDb,
      userId,
      currentRepertoireId,
      // Exercise navigation independently of the initial-sync resource.
      initialSyncComplete: () => initialSync,
      remoteSyncDownCompletionVersion: () => 1,
    });
    return { dates, setDb, setUser, setRepertoire };
  });
}

it("preserves a historical selection made while refresh is awaiting persistence", async () => {
  const { dates } = setup();
  const isCurrent = dates.captureQueueSelection();
  await dates.setManualDate(new Date("2020-01-02T12:00:00"));
  expect(isCurrent()).toBe(false);
  expect(dates.queueDate()).toEqual(new Date("2020-01-02T12:00:00"));
  expect(dates.isManual()).toBe(true);
  expect(localStorage.getItem("TT_PRACTICE_QUEUE_DATE_MANUAL")).toBe("true");
});

it("invalidates refresh even when the user navigates away and back to the same date", async () => {
  const { dates } = setup();
  const original = new Date("2020-01-02T12:00:00");
  await dates.setManualDate(original);
  const isCurrent = dates.captureQueueSelection();
  await dates.setManualDate(new Date("2020-01-03T12:00:00"));
  await dates.setManualDate(original);
  expect(dates.queueDate()).toEqual(original);
  expect(isCurrent()).toBe(false);
});

it("invalidates refresh when Latest is selected", async () => {
  const { dates } = setup();
  const isCurrent = dates.captureQueueSelection();
  await dates.selectLatestQueueDate();
  expect(isCurrent()).toBe(false);
});

it("invalidates refresh when today is explicitly selected", async () => {
  const { dates } = setup();
  const isCurrent = dates.captureQueueSelection();
  await dates.setManualDate(new Date());
  expect(isCurrent()).toBe(false);
});

it("retains refresh ownership when only queue metadata is refreshed", async () => {
  const { dates } = setup();
  const isCurrent = dates.captureQueueSelection();
  await dates.refreshQueueWindowState();
  expect(isCurrent()).toBe(true);
});

it("invalidates refresh after changing repertoire", () => {
  const { dates, setRepertoire } = setup();
  const isCurrent = dates.captureQueueSelection();
  setRepertoire("other");
  expect(isCurrent()).toBe(false);
});

it("invalidates refresh after changing database", () => {
  const { dates, setDb } = setup();
  const isCurrent = dates.captureQueueSelection();
  setDb({} as SqliteDatabase);
  expect(isCurrent()).toBe(false);
});

it("invalidates refresh after changing user", () => {
  const { dates, setUser } = setup();
  const isCurrent = dates.captureQueueSelection();
  setUser("other");
  expect(isCurrent()).toBe(false);
});

it("invalidates refresh after leaving the page", () => {
  const { dates } = setup();
  const isCurrent = dates.captureQueueSelection();
  dispose();
  expect(isCurrent()).toBe(false);
});

it("retains an explicitly refreshed empty day on reload instead of reopening yesterday", async () => {
  localStorage.setItem(
    "TT_EMPTY_QUEUE_WINDOW:user:rep",
    "2020-01-03T12:00:00.000Z"
  );
  vi.mocked(getLatestActiveQueueWindow).mockResolvedValue({
    windowStartUtc: "2020-01-02T00:00:00",
    hasIncompleteRows: true,
    rowCount: 1,
  });
  const { dates } = setup(true);
  await vi.waitFor(() => expect(dates.queueReady()).toBe(true));
  expect(dates.queueDate()).toEqual(new Date("2020-01-03T12:00:00.000Z"));
  expect(runGoalQueueCommand).not.toHaveBeenCalled();
});

it("publishes the generated refresh date rather than reading a later clock", () => {
  const { dates } = setup();
  const generatedDate = new Date("2020-01-02T12:00:00");
  dates.clearManualAndSetToday(generatedDate, true);
  expect(dates.queueDate()).toEqual(generatedDate);
  expect(localStorage.getItem("TT_EMPTY_QUEUE_WINDOW:user:rep")).toBe(
    generatedDate.toISOString()
  );
});

it("does not publish an automatic lookup over a newer historical selection", async () => {
  let resolve!: (
    value: Awaited<ReturnType<typeof getLatestActiveQueueWindow>>
  ) => void;
  vi.mocked(getLatestActiveQueueWindow).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const { dates } = setup(true);
  await vi.waitFor(() =>
    expect(getLatestActiveQueueWindow).toHaveBeenCalledTimes(1)
  );
  await dates.setManualDate(new Date("2020-01-02T12:00:00"));
  resolve({
    windowStartUtc: "2020-01-03T00:00:00",
    hasIncompleteRows: true,
    rowCount: 1,
  });
  await vi.waitFor(() => expect(dates.queueReady()).toBe(true));
  expect(dates.queueDate()).toEqual(new Date("2020-01-02T12:00:00"));
  expect(dates.isManual()).toBe(true);
});

it("does not turn a superseded automatic load into a readiness error", async () => {
  vi.mocked(getLatestActiveQueueWindow).mockResolvedValue({
    windowStartUtc: "2020-01-03T00:00:00",
    hasIncompleteRows: true,
    rowCount: 1,
  });
  let finish!: (value: Awaited<ReturnType<typeof runGoalQueueCommand>>) => void;
  vi.mocked(runGoalQueueCommand).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const { dates } = setup(true);
  await vi.waitFor(() => expect(runGoalQueueCommand).toHaveBeenCalledTimes(1));
  await dates.setManualDate(new Date("2020-01-02T12:00:00"));
  finish({ rows: [], addedTuneIds: [], shortfalls: [], notices: [] });
  await vi.waitFor(() => expect(dates.queueReady()).toBe(true));
  expect(dates.queueReady.error).toBeUndefined();
  expect(dates.queueDate()).toEqual(new Date("2020-01-02T12:00:00"));
});
