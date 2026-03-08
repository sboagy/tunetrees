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
  onMount,
  Show,
} from "solid-js";
import { toast } from "solid-sonner";
import { AIChatDrawer } from "../components/ai/AIChatDrawer";
import { TunesGridScheduled } from "../components/grids";
import { GRID_CONTENT_CONTAINER } from "../components/grids/shared-toolbar-styles";
import type { ITuneOverview } from "../components/grids/types";
import {
  DateRolloverBanner,
  FlashcardView,
  PracticeControlBanner,
} from "../components/practice";
import { RepertoireEditorDialog } from "../components/repertoires/RepertoireEditorDialog";
import { useAuth } from "../lib/auth/AuthContext";
import { useCurrentRepertoire } from "../lib/context/CurrentRepertoireContext";
import { getUserRepertoires } from "../lib/db/queries/repertoires";
import { type GoalRow, getGoals } from "../lib/db/queries/user-settings";
import type { RepertoireWithSummary } from "../lib/db/types";
import { ensureDailyQueue } from "../lib/services/practice-queue";
import { getPracticeDate } from "../lib/utils/practice-date";
import { useFlashcardPersistence } from "./practice/useFlashcardPersistence";
import { usePracticeEvaluations } from "./practice/usePracticeEvaluations";
import { usePracticeListData } from "./practice/usePracticeListData";
import { usePracticePageGate } from "./practice/usePracticePageGate";
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

  const { isPracticeGateOpen, renderPracticeFallback } = usePracticePageGate({
    diagnosticsEnabled: PRACTICE_GATE_DIAGNOSTICS,
    user,
    localDb,
    currentRepertoireId,
    initialSyncComplete,
    userId,
    remoteSyncDownCompletionVersion,
    repertoires,
    repertoiresLoading: () => repertoires.loading,
    repertoiresVersion,
    repertoiresLoadedVersion,
    setRepertoiresLoadedVersion,
    onOpenAssistant: () => setIsChatOpen(true),
    onCreateRepertoire: () => setShowRepertoireDialog(true),
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

  const {
    practiceRows,
    filteredPracticeList,
    isQueueCompleted,
    practiceListLoading,
    practiceListError,
  } = usePracticeListData({
    localDb,
    userId,
    currentRepertoireId,
    practiceListStagedChanged,
    queueReady,
    queueDate,
    showSubmitted,
  });

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
