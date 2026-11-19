import { createRoot } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";
import {
  type GoalCommitItem,
  GoalPracticePersistenceError,
} from "@/lib/goals/commit";
import { usePracticeSubmit } from "@/routes/practice/usePracticeSubmit";

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  commit: vi.fn(),
  stage: vi.fn(),
}));
vi.mock("@/lib/goals/commit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/goals/commit")>()),
  readGoalCommitItems: mocks.capture,
  commitGoalPracticeEvaluations: mocks.commit,
}));
vi.mock("@/lib/goals/staging", () => ({
  stageGoalPracticeEvaluation: mocks.stage,
}));
vi.mock("solid-sonner", () => ({ toast: { success: vi.fn() } }));

let dispose: () => void;
const receipt = {
  queueRowId: "queue",
  draft: {
    tuneId: "tune",
    evaluationId: "good",
    practiced: "2026-11-18T12:00:00Z",
  },
} as GoalCommitItem;
function setup() {
  const db = {} as SqliteDatabase;
  const clear = vi.fn();
  const refresh = vi.fn();
  const state = createRoot((cleanup) => {
    dispose = cleanup;
    return usePracticeSubmit({
      localDb: () => db,
      userId: () => "owner",
      getUserId: async () => "owner",
      currentRepertoireId: () => "rep",
      queueDate: () => new Date("2026-11-18T12:00:00Z"),
      captureQueueSelection: () => () => true,
      evaluationsCount: () => 1,
      isStaging: () => false,
      hasEvaluationErrors: () => false,
      onSubmittingChange: vi.fn(),
      prepareClearEvaluations: () => clear,
      incrementPracticeListStagedChanged: refresh,
      syncPracticeScope: vi.fn(),
    });
  });
  return { ...state, clear, refresh };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.capture.mockReturnValue([receipt]);
  mocks.commit.mockResolvedValue({ status: "committed", eventIds: ["event"] });
  mocks.stage.mockResolvedValue({ status: "staged" });
});
afterEach(() => dispose());
it("retries a committed save with the same receipt after drafts are gone", async () => {
  const state = setup();
  mocks.commit.mockRejectedValueOnce(
    new GoalPracticePersistenceError(new Error("disk full"))
  );
  await state.handleSubmitEvaluations();
  expect(state.clear).not.toHaveBeenCalled();
  mocks.capture.mockReturnValue([]);
  await state.handleSubmitEvaluations();
  expect(mocks.commit.mock.calls[1][1].items).toEqual([receipt]);
  expect(state.clear).toHaveBeenCalledOnce();
});
it("does not resurrect a cleared evaluation after a validation error", async () => {
  const state = setup();
  mocks.commit.mockRejectedValueOnce(new Error("Invalid event"));
  await state.handleSubmitEvaluations();
  mocks.capture.mockReturnValue([]);
  await state.handleSubmitEvaluations();
  expect(mocks.commit).toHaveBeenCalledOnce();
  expect(state.submitError()).toBe("No evaluations to submit.");
});
it("refreshes stale inputs but requires a second Submit", async () => {
  const state = setup();
  mocks.commit.mockResolvedValueOnce({ status: "stale" });
  await state.handleSubmitEvaluations();
  expect(mocks.stage).toHaveBeenCalledOnce();
  expect(state.clear).not.toHaveBeenCalled();
  expect(state.submitError()).toContain("Submit again");
});
it("does not overwrite a draft replaced during Submit", async () => {
  const state = setup();
  mocks.commit.mockResolvedValueOnce({ status: "stale" });
  mocks.capture.mockReturnValueOnce([receipt]).mockReturnValue([]);
  await state.handleSubmitEvaluations();
  expect(mocks.stage).not.toHaveBeenCalled();
  expect(state.submitError()).toContain("changed during Submit");
});
it("ignores double activation while the first commit is pending", async () => {
  const state = setup();
  let complete!: (value: unknown) => void;
  mocks.commit.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    })
  );
  const first = state.handleSubmitEvaluations();
  await state.handleSubmitEvaluations();
  expect(mocks.commit).toHaveBeenCalledOnce();
  complete({ status: "committed", eventIds: ["event"] });
  await first;
});

it("refreshes visible previews when restaging fails after partial progress", async () => {
  const state = setup();
  const second = {
    queueRowId: "second",
    draft: { ...receipt.draft, tuneId: "other" },
  };
  mocks.capture.mockReturnValue([receipt, second]);
  mocks.commit.mockResolvedValueOnce({ status: "stale" });
  mocks.stage
    .mockResolvedValueOnce({ status: "staged" })
    .mockRejectedValueOnce(new Error("Plugin unavailable"));
  await state.handleSubmitEvaluations();
  expect(mocks.stage).toHaveBeenCalledTimes(2);
  expect(state.refresh).toHaveBeenCalledOnce();
  expect(state.clear).not.toHaveBeenCalled();
  expect(state.submitError()).toBe("Plugin unavailable");
});
