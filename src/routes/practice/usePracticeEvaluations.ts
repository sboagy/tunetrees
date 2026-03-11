import { and, eq } from "drizzle-orm";
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
} from "solid-js";
import { toast } from "solid-sonner";
import type { ITuneOverview } from "../../components/grids/types";
import type { SqliteDatabase } from "../../lib/db/client-sqlite";
import type { GoalRow } from "../../lib/db/queries/user-settings";
import { repertoireTune } from "../../lib/db/schema";
import {
  clearStagedEvaluation,
  stagePracticeEvaluation,
} from "../../lib/services/practice-staging";

export interface PracticeEvaluationsProps {
  localDb: Accessor<SqliteDatabase | null>;
  getUserId: () => Promise<string | null>;
  currentRepertoireId: Accessor<string | null>;
  practiceListData: Accessor<ITuneOverview[]>;
  filteredPracticeList: Accessor<ITuneOverview[]>;
  goalsMap: Accessor<Map<string, GoalRow>>;
  incrementPracticeListStagedChanged: () => void;
  suppressNextViewRefresh: (
    scope: "repertoire" | "practice" | "catalog",
    count?: number
  ) => void;
}

export interface PracticeEvaluationsState {
  evaluations: Accessor<Record<string, string>>;
  isStaging: Accessor<boolean>;
  evaluationsCount: Accessor<number>;
  handleRecallEvalChange: (tuneId: string, evaluation: string) => Promise<void>;
  handleGoalChange: (tuneId: string, goal: string | null) => Promise<void>;
  clearEvaluations: () => void;
}

export function usePracticeEvaluations(
  props: PracticeEvaluationsProps
): PracticeEvaluationsState {
  const [stagingTuneIds, setStagingTuneIds] = createSignal<string[]>([]);
  const [evaluations, setEvaluations] = createSignal<Record<string, string>>(
    {}
  );
  const [didHydrateEvaluations, setDidHydrateEvaluations] = createSignal(false);

  createEffect(() => {
    props.currentRepertoireId();
    setDidHydrateEvaluations(false);
    setEvaluations({});
  });

  createEffect(() => {
    if (didHydrateEvaluations()) return;

    const list = props.filteredPracticeList();
    if (!list || list.length === 0) return;

    const hydrated: Record<string, string> = {};
    for (const tune of list) {
      const recallEval = tune.recall_eval;
      if (typeof recallEval === "string" && recallEval.length > 0) {
        hydrated[String(tune.id)] = recallEval;
      }
    }

    if (Object.keys(hydrated).length > 0) {
      setEvaluations(hydrated);
    }
    setDidHydrateEvaluations(true);
  });

  const isStaging = createMemo(() => stagingTuneIds().length > 0);

  const evaluationsCount = createMemo(() => {
    return props.practiceListData().reduce((count, tune) => {
      return count + (Number(tune.has_staged) === 1 ? 1 : 0);
    }, 0);
  });

  const handleRecallEvalChange = async (tuneId: string, evaluation: string) => {
    console.log(`Recall evaluation for tune ${tuneId}: ${evaluation}`);

    const previousEvaluation = evaluations()[tuneId];
    setEvaluations({
      ...evaluations(),
      [tuneId]: evaluation,
    });

    const db = props.localDb();
    const repertoireId = props.currentRepertoireId();
    const userIdValue = await props.getUserId();

    if (!db || !repertoireId || !userIdValue) {
      console.warn(
        "[PracticePage] Skipping staging: missing db/repertoire/userId",
        {
          hasDb: !!db,
          repertoireId,
          userIdValue,
        }
      );
      return;
    }

    setStagingTuneIds((prev) =>
      prev.includes(tuneId) ? prev : [...prev, tuneId]
    );

    try {
      if (evaluation === "") {
        await clearStagedEvaluation(db, userIdValue, tuneId, repertoireId);
        console.log(
          `🗑️  [PracticePage] Cleared staged evaluation for tune ${tuneId}`
        );
      } else {
        const tuneEntry = props
          .practiceListData()
          .find((entry) => entry.id === tuneId);
        const tuneGoal = tuneEntry?.goal ?? "recall";
        const goalDef = props.goalsMap().get(tuneGoal);
        const technique = goalDef?.defaultTechnique ?? "fsrs";

        await stagePracticeEvaluation(
          db,
          userIdValue,
          repertoireId,
          tuneId,
          evaluation,
          tuneGoal,
          technique
        );
        console.log(
          `✅ [PracticePage] Staged preview for tune ${tuneId} (goal=${tuneGoal}, technique=${technique})`
        );
      }

      props.incrementPracticeListStagedChanged();
    } catch (error) {
      console.error(
        `❌ [PracticePage] Failed to ${evaluation === "" ? "clear" : "stage"} evaluation for ${tuneId}:`,
        error
      );
      setEvaluations((prev) => {
        const restored = { ...prev };
        if (previousEvaluation === undefined) {
          delete restored[tuneId];
        } else {
          restored[tuneId] = previousEvaluation;
        }
        return restored;
      });
      toast.error("Failed to stage evaluation. Please try again.");
    } finally {
      setStagingTuneIds((prev) => prev.filter((id) => id !== tuneId));
    }
  };

  const handleGoalChange = async (tuneId: string, goal: string | null) => {
    const db = props.localDb();
    const repertoireId = props.currentRepertoireId();
    const userIdValue = await props.getUserId();
    if (!db || !repertoireId || !userIdValue) return;

    const previousEvaluation = evaluations()[tuneId];

    setEvaluations((prev) => {
      const next = { ...prev };
      delete next[tuneId];
      return next;
    });

    try {
      props.suppressNextViewRefresh("repertoire");
      await db
        .update(repertoireTune)
        .set({ goal: goal ?? null })
        .where(
          and(
            eq(repertoireTune.tuneRef, tuneId),
            eq(repertoireTune.repertoireRef, repertoireId)
          )
        );
      await clearStagedEvaluation(db, userIdValue, tuneId, repertoireId);
      props.incrementPracticeListStagedChanged();
    } catch (error) {
      setEvaluations((prev) => {
        const next = { ...prev };
        if (previousEvaluation === undefined) {
          delete next[tuneId];
        } else {
          next[tuneId] = previousEvaluation;
        }
        return next;
      });
      console.error(
        `[PracticePage] Failed to update goal for tune ${tuneId}:`,
        error
      );
      toast.error("Failed to update goal. Please try again.");
    }
  };

  return {
    evaluations,
    isStaging,
    evaluationsCount,
    handleRecallEvalChange,
    handleGoalChange,
    clearEvaluations: () => setEvaluations({}),
  };
}
