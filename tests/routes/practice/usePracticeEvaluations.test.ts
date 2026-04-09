import { createRoot, createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ITuneOverview } from "@/components/grids/types";
import { usePracticeEvaluations } from "@/routes/practice/usePracticeEvaluations";

const { clearStagedEvaluationMock, stagePracticeEvaluationMock } = vi.hoisted(
  () => ({
    clearStagedEvaluationMock: vi.fn(),
    stagePracticeEvaluationMock: vi.fn(),
  })
);

vi.mock("solid-sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("@/lib/services/practice-staging", () => ({
  clearStagedEvaluation: clearStagedEvaluationMock,
  stagePracticeEvaluation: stagePracticeEvaluationMock,
}));

function makeTune(overrides: Partial<ITuneOverview> = {}): ITuneOverview {
  return {
    id: "tune-1",
    title: "Banish Misfortune",
    type: null,
    structure: null,
    mode: null,
    incipit: null,
    genre: null,
    composer: null,
    artist: null,
    id_foreign: null,
    primary_origin: null,
    release_year: null,
    private_for: null,
    deleted: 0,
    user_ref: "user-1",
    repertoire_id: "rep-1",
    instrument: null,
    learned: null,
    scheduled: 1,
    repertoire_deleted: null,
    latest_state: null,
    latest_practiced: null,
    latest_quality: null,
    latest_easiness: null,
    latest_difficulty: null,
    latest_stability: null,
    latest_interval: null,
    latest_step: null,
    latest_repetitions: null,
    latest_due: null,
    latest_backup_practiced: null,
    latest_goal: null,
    latest_technique: null,
    goal: "recall",
    purpose: null,
    note_private: null,
    note_public: null,
    recall_eval: null,
    bucket: 1,
    order_index: 0,
    completed_at: null,
    tags: null,
    notes: null,
    favorite_url: null,
    has_override: 0,
    has_staged: 0,
    ...overrides,
  };
}

describe("usePracticeEvaluations", () => {
  afterEach(() => {
    clearStagedEvaluationMock.mockReset();
    stagePracticeEvaluationMock.mockReset();
  });

  it("counts optimistic evaluations before the practice list refreshes", async () => {
    stagePracticeEvaluationMock.mockResolvedValue(undefined);

    const tune = makeTune();
    const [practiceListData] = createSignal<ITuneOverview[]>([tune]);
    const [filteredPracticeList] = createSignal<ITuneOverview[]>([tune]);

    const state = createRoot((dispose) => {
      const hook = usePracticeEvaluations({
        localDb: () => ({}) as never,
        getUserId: async () => "user-1",
        currentRepertoireId: () => "rep-1",
        practiceListData,
        filteredPracticeList,
        goalsMap: () => new Map(),
        incrementPracticeListStagedChanged: () => undefined,
        suppressNextViewRefresh: () => undefined,
      });

      return { ...hook, dispose };
    });

    expect(state.evaluationsCount()).toBe(0);

    await state.handleRecallEvalChange(tune.id, "good");

    expect(state.evaluations()[tune.id]).toBe("good");
    expect(state.evaluationsCount()).toBe(1);

    state.dispose();
  });

  it("lets a local clear override stale staged rows until the list catches up", async () => {
    clearStagedEvaluationMock.mockResolvedValue(undefined);

    const stagedTune = makeTune({
      has_staged: 1,
      recall_eval: "good",
    });
    const [practiceListData] = createSignal<ITuneOverview[]>([stagedTune]);
    const [filteredPracticeList] = createSignal<ITuneOverview[]>([stagedTune]);

    const state = createRoot((dispose) => {
      const hook = usePracticeEvaluations({
        localDb: () => ({}) as never,
        getUserId: async () => "user-1",
        currentRepertoireId: () => "rep-1",
        practiceListData,
        filteredPracticeList,
        goalsMap: () => new Map(),
        incrementPracticeListStagedChanged: () => undefined,
        suppressNextViewRefresh: () => undefined,
      });

      return { ...hook, dispose };
    });

    await Promise.resolve();

    expect(state.evaluationsCount()).toBe(1);

    await state.handleRecallEvalChange(stagedTune.id, "");

    expect(state.evaluations()[stagedTune.id]).toBe("");
    expect(state.evaluationsCount()).toBe(0);

    state.dispose();
  });
});
