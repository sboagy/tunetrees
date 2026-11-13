// @vitest-environment jsdom
import { createResource, createRoot, createSignal } from "solid-js";
import { afterEach, expect, it, vi } from "vitest";
import type { ITuneOverview } from "@/components/grids/types";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";
import { usePracticeEvaluations } from "@/routes/practice/usePracticeEvaluations";
import { usePracticeListData } from "@/routes/practice/usePracticeListData";

const { getPracticeList } = vi.hoisted(() => ({ getPracticeList: vi.fn() }));
vi.mock("@/lib/db/queries/practice", () => ({ getPracticeList }));
vi.mock("@/lib/services/practice-staging", () => ({}));
vi.mock("solid-sonner", () => ({ toast: { error: vi.fn() } }));
let dispose: () => void;
afterEach(() => {
  dispose();
  vi.restoreAllMocks();
  getPracticeList.mockReset();
});

it.each([
  ["database", null],
  ["database", "easy"],
  ["repertoire", null],
  ["repertoire", "easy"],
] as const)(
  "hydrates only fresh rows after changing %s (rating %s)",
  async (change, rating) => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const oldRow = {
      id: "tune",
      recall_eval: "good",
      has_staged: 1,
    } as ITuneOverview;
    getPracticeList.mockResolvedValueOnce([oldRow]);
    let resolveRows!: (rows: ITuneOverview[]) => void;
    getPracticeList.mockReturnValueOnce(
      new Promise<ITuneOverview[]>((resolve) => {
        resolveRows = resolve;
      })
    );
    const state = createRoot((cleanup) => {
      dispose = cleanup;
      const [localDb, setDb] = createSignal({} as SqliteDatabase);
      const [currentRepertoireId, setRepertoire] = createSignal("rep");
      const [queueReady] = createResource(async (): Promise<true> => true);
      const list = usePracticeListData({
        localDb,
        currentRepertoireId,
        userId: () => "user",
        queueReady,
        practiceListStagedChanged: () => 0,
        queueDate: () => new Date("2026-04-05T12:00:00Z"),
        showSubmitted: () => false,
        selectedTuneIds: () => undefined,
      });
      const evaluations = usePracticeEvaluations({
        localDb,
        currentRepertoireId,
        getUserId: async () => "user",
        practiceListData: list.practiceRows,
        filteredPracticeList: list.filteredPracticeList,
        goalsMap: () => new Map(),
        incrementPracticeListStagedChanged: () => {},
        suppressNextViewRefresh: () => {},
      });
      return {
        list,
        evaluations,
        change: {
          database: () => setDb({} as SqliteDatabase),
          repertoire: () => setRepertoire("other"),
        },
      };
    });
    await vi.waitFor(() =>
      expect(state.evaluations.evaluations()).toEqual({ tune: "good" })
    );
    state.change[change]();
    expect(state.list.practiceRows()).toEqual([]);
    expect(state.evaluations.evaluations()).toEqual({});
    await vi.waitFor(() => expect(getPracticeList).toHaveBeenCalledTimes(2));
    const freshRow = {
      ...oldRow,
      recall_eval: rating,
      has_staged: Number(rating !== null),
    };
    resolveRows([freshRow]);
    await vi.waitFor(() =>
      expect(state.list.practiceRows()).toEqual([freshRow])
    );
    expect(state.evaluations.evaluations()).toEqual(
      rating === null ? {} : { tune: rating }
    );
  }
);
