import { createRoot, createSignal } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";
import { usePracticeQueueDate } from "@/routes/practice/usePracticeQueueDate";

vi.mock("@/lib/services/practice-queue", () => ({
  ensureDailyQueue: vi.fn(async () => []),
  getLatestActiveQueueWindow: vi.fn(),
  getRecentActiveQueueWindows: vi.fn(async () => []),
}));

let dispose: () => void;
beforeEach(() => localStorage.clear());
afterEach(() => dispose());

function setup() {
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
      initialSyncComplete: () => false,
      remoteSyncDownCompletionVersion: () => 0,
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
