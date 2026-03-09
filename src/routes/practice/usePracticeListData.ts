import {
  type Accessor,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  type Resource,
} from "solid-js";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";
import type { ITuneOverview } from "../../components/grids/types";
import { formatAsWindowStart } from "../../lib/utils/practice-date";

export interface PracticeListDataProps {
  localDb: Accessor<SqliteDatabase | null>;
  userId: Accessor<string | null>;
  currentRepertoireId: Accessor<string | null>;
  practiceListStagedChanged: Accessor<number>;
  queueReady: Resource<true>;
  queueDate: Accessor<Date>;
  showSubmitted: Accessor<boolean>;
}

export interface PracticeListDataState {
  practiceRows: Accessor<ITuneOverview[]>;
  filteredPracticeList: Accessor<ITuneOverview[]>;
  isQueueCompleted: Accessor<boolean>;
  practiceListLoading: Accessor<boolean>;
  practiceListError: Accessor<unknown>;
}

export function usePracticeListData(
  props: PracticeListDataProps
): PracticeListDataState {
  const [practiceListData] = createResource(
    () => {
      const db = props.localDb();
      const resolvedUserId = props.userId();
      const repertoireId = props.currentRepertoireId();
      const version = props.practiceListStagedChanged();
      const initialized = props.queueReady();
      const isQueueLoading = props.queueReady.loading;
      const windowStartUtc = formatAsWindowStart(props.queueDate());

      console.log(
        `[PracticePage] practiceListData deps: db=${!!db}, userId=${resolvedUserId}, repertoire=${repertoireId}, version=${version}, queueInit=${initialized}, queueLoading=${isQueueLoading}, window=${windowStartUtc}`
      );

      return db &&
        resolvedUserId &&
        repertoireId &&
        initialized &&
        !isQueueLoading
        ? {
            db,
            userId: resolvedUserId,
            repertoireId,
            version,
            queueReady: initialized,
            windowStartUtc,
          }
        : null;
    },
    async (params) => {
      if (!params) return [];
      const { getPracticeList } = await import("../../lib/db/queries/practice");
      console.log(
        `[PracticePage] Fetching practice list for repertoire ${params.repertoireId} (queueReady=${params.queueReady})`
      );
      return getPracticeList(
        params.db,
        params.userId,
        params.repertoireId,
        7,
        params.windowStartUtc
      );
    }
  );

  const practiceRows = createMemo<ITuneOverview[]>(() => {
    return practiceListData.latest ?? practiceListData() ?? [];
  });

  const [isQueueCompleted, setIsQueueCompleted] = createSignal(false);
  createEffect(() => {
    const data = practiceRows();
    if (!data || data.length === 0) {
      setIsQueueCompleted(false);
      return;
    }

    setIsQueueCompleted(data.every((tune) => !!tune.completed_at));
  });

  const filteredPracticeList = createMemo<ITuneOverview[]>(() => {
    const data = practiceRows();
    const shouldShow = props.showSubmitted();

    console.log(
      `[PracticePage] Filtering practice list: ${data.length} total, showSubmitted=${shouldShow}`
    );

    const filtered = shouldShow
      ? data
      : data.filter((tune) => !tune.completed_at);

    console.log(`[PracticePage] After filtering: ${filtered.length} tunes`);
    return filtered;
  });

  const practiceListLoading = createMemo(() => {
    const hasCachedRows = practiceListData.latest != null;
    return (
      (practiceListData.loading || props.queueReady.loading) && !hasCachedRows
    );
  });

  const practiceListError = createMemo(() => {
    return (
      practiceListData.error ||
      (props.queueReady.error
        ? "Practice queue failed to initialize."
        : undefined)
    );
  });

  return {
    practiceRows,
    filteredPracticeList,
    isQueueCompleted,
    practiceListLoading,
    practiceListError,
  };
}
