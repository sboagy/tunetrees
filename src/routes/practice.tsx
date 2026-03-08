/**
 * Practice Page (Index)
 *
 * Protected route - main practice interface with grid view.
 * Clean layout with sticky control banner and practice queue grid.
 *
 * @module routes/practice
 */

import { useLocation, useNavigate } from "@solidjs/router";
import type { Component } from "solid-js";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { toast } from "solid-sonner";
import { AIChatDrawer } from "../components/ai/AIChatDrawer";
import { TunesGridScheduled } from "../components/grids";
import { GridStatusMessage } from "../components/grids/GridStatusMessage";
import { GRID_CONTENT_CONTAINER } from "../components/grids/shared-toolbar-styles";
import type { ITuneOverview } from "../components/grids/types";
import {
  DateRolloverBanner,
  FlashcardView,
  PracticeControlBanner,
} from "../components/practice";
import { RepertoireEmptyState } from "../components/repertoire";
import { RepertoireEditorDialog } from "../components/repertoires/RepertoireEditorDialog";
import { useAuth } from "../lib/auth/AuthContext";
import { useCurrentRepertoire } from "../lib/context/CurrentRepertoireContext";
import { getUserRepertoires } from "../lib/db/queries/repertoires";
import { type GoalRow, getGoals } from "../lib/db/queries/user-settings";
import type { RepertoireWithSummary } from "../lib/db/types";
import { ensureDailyQueue } from "../lib/services/practice-queue";
import {
  formatAsWindowStart,
  getPracticeDate,
} from "../lib/utils/practice-date";
import { useFlashcardPersistence } from "./practice/useFlashcardPersistence";
import { usePracticeEvaluations } from "./practice/usePracticeEvaluations";
import { usePracticeQueueDate } from "./practice/usePracticeQueueDate";
import { usePracticeSubmit } from "./practice/usePracticeSubmit";
import { useRolloverStateMachine } from "./practice/useRolloverStateMachine";

const PracticePage: Component = () => {
  const PRACTICE_GATE_DIAGNOSTICS =
    import.meta.env.VITE_PRACTICE_GATE_DIAGNOSTICS === "true";

  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    userIdInt,
    localDb,
    incrementPracticeListStagedChanged,
    practiceListStagedChanged,
    remoteSyncDownCompletionVersion,
    initialSyncComplete,
    syncPracticeScope,
    repertoireListChanged,
    incrementRepertoireListChanged,
    suppressNextViewRefresh,
  } = useAuth();
  const { currentRepertoireId } = useCurrentRepertoire();
  const [showRepertoireDialog, setShowRepertoireDialog] = createSignal(false);
  const [isChatOpen, setIsChatOpen] = createSignal(false);
  const [tableInstance, setTableInstance] = createSignal<any>(null);
  const repertoiresVersion = createMemo(() => `${repertoireListChanged()}`);
  const [repertoiresLoadedVersion, setRepertoiresLoadedVersion] = createSignal<
    string | null
  >(null);

  const userId = createMemo(() => userIdInt() ?? user()?.id ?? null);

  const [repertoires] = createResource(
    () => {
      const db = localDb();
      const currentUser = user();
      const internalUserId = userId();
      const version = repertoiresVersion();

      return db && currentUser && internalUserId
        ? { db, userId: currentUser.id, version }
        : null;
    },
    async (params) => {
      if (!params) return [] as RepertoireWithSummary[];
      return getUserRepertoires(params.db, params.userId);
    }
  );

  const practiceGateState = createMemo(() => {
    const currentUser = user();
    const db = localDb();
    const repertoireId = currentRepertoireId();
    const syncComplete = initialSyncComplete();
    const userIdValue = userId();
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    const syncDisabled = import.meta.env.VITE_DISABLE_SYNC === "true";
    const remoteSyncVersion = remoteSyncDownCompletionVersion();
    const remoteSyncReady = remoteSyncVersion > 0 || !isOnline || syncDisabled;

    return {
      hasUser: !!currentUser,
      hasLocalDb: !!db,
      hasRepertoire: !!repertoireId,
      syncComplete,
      hasUserId: !!userIdValue,
      remoteSyncVersion,
      remoteSyncReady,
      isOnline,
      syncDisabled,
    };
  });

  const isPracticeGateOpen = createMemo(() => {
    const state = practiceGateState();
    return (
      state.hasUser &&
      state.hasLocalDb &&
      state.hasRepertoire &&
      state.syncComplete &&
      state.hasUserId
    );
  });

  const practiceGateBlockingReasons = createMemo(() => {
    const state = practiceGateState();
    const reasons: string[] = [];

    if (!state.hasUser) reasons.push("auth user");
    if (!state.hasLocalDb) reasons.push("localDb");
    if (!state.hasRepertoire) reasons.push("currentRepertoireId");
    if (!state.syncComplete) reasons.push("initialSyncComplete");
    if (!state.hasUserId) reasons.push("userId()");

    return reasons;
  });

  let lastPracticeGateSignature: string | null = null;
  createEffect(() => {
    if (!PRACTICE_GATE_DIAGNOSTICS) return;

    const state = practiceGateState();
    const signature = JSON.stringify(state);

    if (signature === lastPracticeGateSignature) return;
    lastPracticeGateSignature = signature;

    if (!isPracticeGateOpen()) {
      console.log(
        `[PracticePageGate] blocked=${practiceGateBlockingReasons().join(",") || "none"} state=${signature}`
      );
    }
  });

  createEffect(() => {
    if (!initialSyncComplete() || !user() || !localDb() || !userId()) {
      setRepertoiresLoadedVersion(null);
      return;
    }

    if (!repertoires.loading && repertoires() !== undefined) {
      setRepertoiresLoadedVersion(repertoiresVersion());
    }
  });

  createEffect(() => {
    const handleOpenAssistant = () => setIsChatOpen(true);
    window.addEventListener("tt-open-ai-assistant", handleOpenAssistant);
    onCleanup(() => {
      window.removeEventListener("tt-open-ai-assistant", handleOpenAssistant);
    });
  });

  const getUserId = async (): Promise<string | null> => {
    return userId() ?? user()?.id ?? null;
  };

  const [goalsData] = createResource(
    () => {
      const db = localDb();
      const uid = userId();
      return db && uid ? { db, uid } : null;
    },
    async (params) => {
      if (!params) return [];
      return getGoals(params.db, params.uid);
    }
  );

  const goalsMap = createMemo(() => {
    const map = new Map<string, GoalRow>();
    const goals = goalsData() ?? [];
    for (const goal of goals) {
      if (goal.privateFor === null) map.set(goal.name, goal);
    }
    for (const goal of goals) {
      if (goal.privateFor !== null) map.set(goal.name, goal);
    }
    return map;
  });

  const SHOW_SUBMITTED_STORAGE_KEY = "TT_PRACTICE_SHOW_SUBMITTED";
  const [showSubmitted, setShowSubmitted] = createSignal(false);

  onMount(() => {
    const stored = localStorage.getItem(SHOW_SUBMITTED_STORAGE_KEY);
    if (stored !== null) {
      setShowSubmitted(stored === "true");
    }
  });

  createEffect(() => {
    localStorage.setItem(SHOW_SUBMITTED_STORAGE_KEY, String(showSubmitted()));
  });

  const {
    queueDate,
    isManual,
    queueReady,
    setManualDate,
    clearManualAndSetToday,
  } = usePracticeQueueDate({
    localDb,
    userId,
    currentRepertoireId,
    initialSyncComplete,
    remoteSyncDownCompletionVersion,
  });

  const {
    flashcardMode,
    setFlashcardMode,
    flashcardFieldVisibility,
    setFlashcardFieldVisibility,
  } = useFlashcardPersistence();

  const [practiceListData] = createResource(
    () => {
      const db = localDb();
      const resolvedUserId = userId();
      const repertoireId = currentRepertoireId();
      const version = practiceListStagedChanged();
      const initialized = queueReady();
      const isQueueLoading = queueReady.loading;
      const windowStartUtc = formatAsWindowStart(queueDate());

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
      const { getPracticeList } = await import("../lib/db/queries/practice");
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
    const shouldShow = showSubmitted();

    console.log(
      `[PracticePage] Filtering practice list: ${data.length} total, showSubmitted=${shouldShow}`
    );

    const filtered = shouldShow
      ? data
      : data.filter((tune) => !tune.completed_at);

    console.log(`[PracticePage] After filtering: ${filtered.length} tunes`);
    return filtered;
  });

  const practiceListLoading = () => {
    const hasCachedRows = practiceListData.latest != null;
    return (practiceListData.loading || queueReady.loading) && !hasCachedRows;
  };
  const practiceListError = () =>
    practiceListData.error ||
    (queueReady.error ? "Practice queue failed to initialize." : undefined);

  const {
    evaluations,
    isStaging,
    evaluationsCount,
    handleRecallEvalChange,
    handleGoalChange,
    clearEvaluations,
  } = usePracticeEvaluations({
    localDb,
    getUserId,
    currentRepertoireId,
    practiceListData: practiceRows,
    filteredPracticeList,
    goalsMap,
    incrementPracticeListStagedChanged,
    suppressNextViewRefresh,
  });

  const { handleSubmitEvaluations, handleAddTunes, handleQueueReset } =
    usePracticeSubmit({
      localDb,
      getUserId,
      currentRepertoireId,
      queueDate,
      evaluationsCount,
      isStaging,
      clearEvaluations,
      incrementPracticeListStagedChanged,
      syncPracticeScope,
    });

  const handleQueueDateChange = async (date: Date, isPreview: boolean) => {
    console.log(
      `Queue date changed to: ${date.toISOString()}, preview: ${isPreview}`
    );

    await setManualDate(date);
    incrementPracticeListStagedChanged();

    const dateStr = queueDate().toLocaleDateString();
    if (isPreview) {
      toast.info(`Previewing queue for ${dateStr} (changes won't be saved)`, {
        duration: 4000,
      });
    } else {
      toast.success(`Switched to queue for ${dateStr}`);
    }
  };

  const handlePracticeDateRefresh = async (
    mode: "manual" | "auto" = "manual"
  ) => {
    if (mode === "auto" && (queueReady() !== true || queueReady.loading)) {
      return;
    }

    const practiceDate = getPracticeDate();
    const db = localDb();
    const repertoireId = currentRepertoireId();
    const userIdValue = await getUserId();

    if (!db || !repertoireId || !userIdValue) {
      console.warn(
        "[PracticePage] Skipping refresh: missing db/repertoire/userId",
        {
          hasDb: !!db,
          repertoireId,
          userIdValue,
        }
      );
      return;
    }

    clearManualAndSetToday();

    try {
      await ensureDailyQueue(db, userIdValue, repertoireId, practiceDate);
    } catch (error) {
      console.warn(
        "[PracticePage] Failed to ensure queue during refresh:",
        error
      );
    }

    console.log(
      `[PracticePage] Refreshing queue for ${practiceDate.toLocaleDateString()} (${mode})`
    );
    incrementPracticeListStagedChanged();
  };

  const { rolloverStatus } = useRolloverStateMachine({
    queueDate,
    isManual,
    isQueueCompleted,
    queueReady,
    onAutoAdvance: () => handlePracticeDateRefresh("auto"),
    onClearManual: clearManualAndSetToday,
  });

  const handleTuneSelect = (tune: ITuneOverview) => {
    const fullPath = location.pathname + location.search;
    navigate(`/tunes/${tune.id}/edit`, { state: { from: fullPath } });
  };

  const renderPracticeFallback = () => {
    const gateBlocked = !isPracticeGateOpen();
    const blockingReasons = practiceGateBlockingReasons();
    const repertoiresReady =
      repertoiresLoadedVersion() === repertoiresVersion();
    const repertoiresLoading =
      !repertoiresReady || repertoires.loading || repertoires() === undefined;
    const repertoireCount = repertoires()?.length ?? 0;

    if (
      initialSyncComplete() &&
      !currentRepertoireId() &&
      !repertoiresLoading &&
      repertoireCount === 0
    ) {
      return (
        <RepertoireEmptyState
          title="No current repertoire"
          description={
            `Repertoires group tunes by instrument, genre, or goal. ` +
            `Create a new repertoire to start practicing, or select ` +
            `an existing repertoire, if one exists, from the Repertoire ` +
            `menu in the top banner.`
          }
          primaryAction={{
            label: "Create repertoire",
            onClick: () => setShowRepertoireDialog(true),
          }}
        />
      );
    }

    return (
      <GridStatusMessage
        variant="loading"
        title="Loading practice queue..."
        description={
          PRACTICE_GATE_DIAGNOSTICS && gateBlocked && blockingReasons.length > 0
            ? `Waiting for: ${blockingReasons.join(", ")}`
            : "Syncing your scheduled tunes."
        }
      />
    );
  };

  return (
    <div class="h-full flex flex-col">
      <Show when={rolloverStatus().showBanner}>
        <DateRolloverBanner
          newDate={rolloverStatus().wallClockDate}
          onRefresh={() => handlePracticeDateRefresh("manual")}
        />
      </Show>

      <PracticeControlBanner
        evaluationsCount={evaluationsCount()}
        isStaging={isStaging()}
        onSubmitEvaluations={handleSubmitEvaluations}
        onAddTunes={handleAddTunes}
        queueDate={queueDate()}
        onQueueDateChange={handleQueueDateChange}
        onQueueReset={handleQueueReset}
        showSubmitted={showSubmitted()}
        onShowSubmittedChange={setShowSubmitted}
        flashcardMode={flashcardMode()}
        onFlashcardModeChange={setFlashcardMode}
        table={tableInstance()}
        flashcardFieldVisibility={flashcardFieldVisibility()}
        onFlashcardFieldVisibilityChange={setFlashcardFieldVisibility}
      />

      <div class={GRID_CONTENT_CONTAINER}>
        <Show when={isPracticeGateOpen()} fallback={renderPracticeFallback()}>
          <Show
            when={!flashcardMode()}
            fallback={
              <FlashcardView
                tunes={filteredPracticeList}
                fieldVisibility={flashcardFieldVisibility()}
                evaluations={evaluations()}
                onRecallEvalChange={handleRecallEvalChange}
                localDb={localDb}
                userId={userId()!}
                repertoireId={currentRepertoireId()!}
              />
            }
          >
            <TunesGridScheduled
              userId={userId()!}
              repertoireId={currentRepertoireId()!}
              tablePurpose="scheduled"
              onRecallEvalChange={handleRecallEvalChange}
              onGoalChange={handleGoalChange}
              onTuneSelect={handleTuneSelect}
              evaluations={evaluations()}
              onTableInstanceChange={setTableInstance}
              practiceListData={filteredPracticeList()}
              isLoading={practiceListLoading()}
              loadError={practiceListError()}
            />
          </Show>
        </Show>
      </div>

      <Show when={showRepertoireDialog()}>
        <RepertoireEditorDialog
          isOpen={showRepertoireDialog()}
          onClose={() => setShowRepertoireDialog(false)}
          onSaved={() => {
            incrementRepertoireListChanged();
            setShowRepertoireDialog(false);
          }}
        />
      </Show>

      <AIChatDrawer
        isOpen={isChatOpen()}
        onClose={() => setIsChatOpen(false)}
        currentRepertoireId={currentRepertoireId() || undefined}
      />
    </div>
  );
};

export default PracticePage;
