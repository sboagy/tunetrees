import { beforeEach, expect, it, vi } from "vitest";
import type { SqliteDatabase } from "../db/client-sqlite";
import {
  GoalQueuePersistenceError,
  type GoalQueueResult,
  persistGoalQueueResult,
  updateGoalPracticeQueue,
} from "./queue";
import { retryGoalQueueSave, runGoalQueueCommand } from "./queue-commands";

vi.mock("./queue", async (original) => ({
  ...(await original<typeof import("./queue")>()),
  persistGoalQueueResult: vi.fn(),
  updateGoalPracticeQueue: vi.fn(),
}));
const request = {
  userId: "owner",
  repertoireId: "rep",
  practiceDate: new Date("2026-11-18T12:00:00Z"),
};
const action = { kind: "add-more", count: 2 } as const;
const receipt: GoalQueueResult = {
  rows: [],
  addedTuneIds: ["a", "b"],
  notices: [],
  shortfalls: [],
};
let db: SqliteDatabase;
beforeEach(() => {
  vi.resetAllMocks();
  db = {} as SqliteDatabase;
  vi.mocked(updateGoalPracticeQueue).mockResolvedValue(receipt);
  vi.mocked(persistGoalQueueResult).mockResolvedValue(receipt);
});

it("retries the saved allocation without adding another batch", async () => {
  vi.mocked(updateGoalPracticeQueue).mockRejectedValueOnce(
    new GoalQueuePersistenceError(receipt, new Error("disk"))
  );
  await expect(
    runGoalQueueCommand(db, request, action, () => true)
  ).rejects.toThrow("saving");
  expect(await runGoalQueueCommand(db, request, action, () => true)).toEqual(
    receipt
  );
  expect(updateGoalPracticeQueue).toHaveBeenCalledTimes(1);
  expect(persistGoalQueueResult).toHaveBeenCalledWith(receipt);
});

it("retains the receipt when retrying persistence also fails", async () => {
  vi.mocked(updateGoalPracticeQueue).mockRejectedValueOnce(
    new GoalQueuePersistenceError(receipt, new Error("disk"))
  );
  await expect(
    runGoalQueueCommand(db, request, action, () => true)
  ).rejects.toThrow();
  vi.mocked(persistGoalQueueResult).mockRejectedValueOnce(new Error("disk"));
  await expect(
    runGoalQueueCommand(db, request, action, () => true)
  ).rejects.toThrow("disk");
  await runGoalQueueCommand(db, request, action, () => true);
  expect(updateGoalPracticeQueue).toHaveBeenCalledTimes(1);
});

it("does not mutate for an obsolete selection", async () => {
  await expect(
    runGoalQueueCommand(db, request, action, () => false)
  ).rejects.toThrow("selection changed");
  expect(updateGoalPracticeQueue).not.toHaveBeenCalled();
});

it("does not save another user's pending receipt", async () => {
  vi.mocked(updateGoalPracticeQueue).mockRejectedValueOnce(
    new GoalQueuePersistenceError(receipt, new Error("disk"))
  );
  await expect(
    runGoalQueueCommand(db, request, action, () => true)
  ).rejects.toThrow();
  await expect(
    runGoalQueueCommand(db, { ...request, userId: "other" }, action, () => true)
  ).rejects.toThrow("different user");
  expect(persistGoalQueueResult).not.toHaveBeenCalled();
});

it("rechecks selection after waiting behind a pending command", async () => {
  let finish!: (result: GoalQueueResult) => void;
  vi.mocked(updateGoalPracticeQueue).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const first = runGoalQueueCommand(db, request, action, () => true);
  await vi.waitFor(() =>
    expect(updateGoalPracticeQueue).toHaveBeenCalledTimes(1)
  );
  let current = true;
  const next = runGoalQueueCommand(
    db,
    request,
    { kind: "refresh" },
    () => current
  );
  current = false;
  finish(receipt);
  await first;
  await expect(next).rejects.toThrow("selection changed");
  expect(updateGoalPracticeQueue).toHaveBeenCalledTimes(1);
});

it("does not let another command consume a failed add-more receipt", async () => {
  vi.mocked(updateGoalPracticeQueue).mockRejectedValueOnce(
    new GoalQueuePersistenceError(receipt, new Error("disk"))
  );
  await expect(
    runGoalQueueCommand(db, request, action, () => true)
  ).rejects.toThrow();
  await expect(
    runGoalQueueCommand(db, request, { kind: "load" }, () => true)
  ).rejects.toThrow("Retry the previous queue action");
  expect(persistGoalQueueResult).not.toHaveBeenCalled();
  expect(await runGoalQueueCommand(db, request, action, () => true)).toEqual(
    receipt
  );
  expect(updateGoalPracticeQueue).toHaveBeenCalledTimes(1);
});

it("coalesces overlapping clicks without allocating twice", async () => {
  let finish!: (result: GoalQueueResult) => void;
  vi.mocked(updateGoalPracticeQueue).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const first = runGoalQueueCommand(db, request, action, () => true);
  const second = runGoalQueueCommand(db, request, action, () => true);
  await vi.waitFor(() =>
    expect(updateGoalPracticeQueue).toHaveBeenCalledTimes(1)
  );
  finish(receipt);
  expect(await Promise.all([first, second])).toEqual([receipt, receipt]);
  expect(updateGoalPracticeQueue).toHaveBeenCalledTimes(1);
});

it("saves a pending receipt independently after the practice date changes", async () => {
  vi.mocked(updateGoalPracticeQueue).mockRejectedValueOnce(
    new GoalQueuePersistenceError(receipt, new Error("disk"))
  );
  await expect(
    runGoalQueueCommand(db, request, action, () => true)
  ).rejects.toThrow();
  await retryGoalQueueSave(db, request.userId, () => true);
  expect(updateGoalPracticeQueue).toHaveBeenCalledTimes(1);
  await runGoalQueueCommand(
    db,
    { ...request, practiceDate: new Date("2026-11-19T12:00:00Z") },
    { kind: "refresh" },
    () => true
  );
  expect(updateGoalPracticeQueue).toHaveBeenCalledTimes(2);
});

it("allows a current caller to own work queued by an obsolete caller", async () => {
  let finish!: (result: GoalQueueResult) => void;
  vi.mocked(updateGoalPracticeQueue).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const first = runGoalQueueCommand(db, request, action, () => true);
  await vi.waitFor(() =>
    expect(updateGoalPracticeQueue).toHaveBeenCalledTimes(1)
  );
  const stale = runGoalQueueCommand(
    db,
    request,
    { kind: "refresh" },
    () => false
  );
  const current = runGoalQueueCommand(
    db,
    request,
    { kind: "refresh" },
    () => true
  );
  finish(receipt);
  await Promise.all([first, stale, current]);
  expect(updateGoalPracticeQueue).toHaveBeenCalledTimes(2);
});

it("remembers an empty refreshed day after save-only recovery", async () => {
  const empty = { ...receipt, addedTuneIds: [] };
  vi.mocked(updateGoalPracticeQueue).mockRejectedValueOnce(
    new GoalQueuePersistenceError(empty, new Error("disk"))
  );
  await expect(
    runGoalQueueCommand(db, request, { kind: "refresh" }, () => true)
  ).rejects.toThrow();
  await retryGoalQueueSave(db, request.userId, () => true);
  expect(localStorage.getItem("TT_EMPTY_QUEUE_WINDOW:owner:rep")).toBe(
    request.practiceDate.toISOString()
  );
  expect(updateGoalPracticeQueue).toHaveBeenCalledTimes(1);
});

it("does not coalesce identical additions separated by another accepted command", async () => {
  let finish!: (result: GoalQueueResult) => void;
  vi.mocked(updateGoalPracticeQueue).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const first = runGoalQueueCommand(db, request, action, () => true);
  await vi.waitFor(() =>
    expect(updateGoalPracticeQueue).toHaveBeenCalledTimes(1)
  );
  const second = runGoalQueueCommand(
    db,
    request,
    { kind: "add-more", count: 10 },
    () => true
  );
  const third = runGoalQueueCommand(db, request, action, () => true);
  finish(receipt);
  await Promise.all([first, second, third]);
  expect(updateGoalPracticeQueue).toHaveBeenCalledTimes(3);
});
