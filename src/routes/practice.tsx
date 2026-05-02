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
import { FlashcardView, PracticeControlBanner } from "../components/practice";
import { RepertoireEditorDialog } from "../components/repertoires/RepertoireEditorDialog";
import { useAuth } from "../lib/auth/AuthContext";
import { useCurrentRepertoire } from "../lib/context/CurrentRepertoireContext";
import { useCurrentTuneSet } from "../lib/context/CurrentTuneSetContext";
import { useOnboarding } from "../lib/context/OnboardingContext";
import { getUserRepertoires } from "../lib/db/queries/repertoires";
import { getTuneIdsForTuneSet } from "../lib/db/queries/tune-sets";
import { updateRepertoireTuneFields } from "../lib/db/queries/tune-user-data";
import { type GoalRow, getGoals } from "../lib/db/queries/user-settings";
import type { RepertoireWithSummary } from "../lib/db/types";
import { useStarterRepertoire } from "../lib/hooks/useStarterRepertoire";
import { generateOrGetPracticeQueue } from "../lib/services/practice-queue";
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
  const { tuneSetListChanged } = useCurrentTuneSet();
  const { isCreatingStarter, starterError, handleStarterChosen } =
    useStarterRepertoire();
  const { beginOnboardingAtGenreStep } = useOnboarding();
  const [showRepertoireDialog, setShowRepertoireDialog] = createSignal(false);
  // Track whether the dialog was opened from the empty-state onboarding panel
  // (i.e. the user has no repertoire yet) so we can trigger genre selection after save.
  const [openedFromOnboarding, setOpenedFromOnboarding] = createSignal(false);
  const [isChatOpen, setIsChatOpen] = createSignal(false);
  const [tableInstance, setTableInstance] = createSignal<any>(null);
  const [selectedTuneSetId, setSelectedTuneSetId] = createSignal<string | null>(
    null
  );
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
    onCreateRepertoire: () => {
      // If no repertoire exists yet, the dialog is being opened from the
      // onboarding empty-state panel — remember this so we can chain into
      // genre selection once the repertoire is saved.
      setOpenedFromOnboarding(!currentRepertoireId());
      setShowRepertoireDialog(true);
    },
    onStarterChosen: handleStarterChosen,
    isCreatingStarter,
    starterError,
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
    latestQueueDate,
    recentQueueDates,
    hasMoreRecentQueueDates,
    isManual,
    queueReady,
    setManualDate,
    clearManualAndSetToday,
    selectLatestQueueDate,
    refreshQueueWindowState,
    loadMoreRecentQueueDates,
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

  const [selectedTuneSetTuneIds] = createResource(
    () => {
      const db = localDb();
      const userIdValue = userId();
      const tuneSetId = selectedTuneSetId();
      const version = tuneSetListChanged();
      return db && userIdValue && tuneSetId
        ? { db, userId: userIdValue, tuneSetId, version }
        : null;
    },
    async (params) => {
      if (!params) return undefined;
      return getTuneIdsForTuneSet(params.db, params.tuneSetId, params.userId);
    }
  );

  const {
    practiceRows,
    filteredPracticeList,
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
    selectedTuneIds: () =>
      selectedTuneSetId()
        ? (selectedTuneSetTuneIds.latest ?? selectedTuneSetTuneIds() ?? [])
        : undefined,
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

  const {
    handleSubmitEvaluations,
    handleAddTunes,
    handleQueueReset: resetQueue,
  } = usePracticeSubmit({
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

  // Handle schedule override change from the in-grid date-time picker.
  const handleScheduledChange = async (
    tuneId: string,
    newValue: string | null
  ) => {
    const db = localDb();
    const repertoireId = currentRepertoireId();
    if (!db || !repertoireId) return;

    try {
      suppressNextViewRefresh("practice");
      await updateRepertoireTuneFields(db, repertoireId, tuneId, {
        scheduled: newValue,
      });
      incrementPracticeListStagedChanged();
    } catch (err) {
      console.error("[PracticePage] Failed to update schedule override:", err);
      toast.error(
        `Failed to update schedule override: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

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

  const handlePracticeDateRefresh = async () => {
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
      await generateOrGetPracticeQueue(
        db,
        userIdValue,
        repertoireId,
        practiceDate,
        null,
        "per_day",
        true
      );
    } catch (error) {
      console.warn(
        "[PracticePage] Failed to regenerate queue during refresh:",
        error
      );
    }

    console.log(
      `[PracticePage] Refreshing queue for ${practiceDate.toLocaleDateString()}`
    );
    await refreshQueueWindowState();
    incrementPracticeListStagedChanged();
  };

  const handleQueueReset = async () => {
    await resetQueue();
    await refreshQueueWindowState();
  };

  const { rolloverStatus } = useRolloverStateMachine({
    queueDate,
    isManual,
    queueReady,
    onClearManual: clearManualAndSetToday,
  });

  const handleTuneSelect = (tune: ITuneOverview) => {
    const fullPath = location.pathname + location.search;
    navigate(`/tunes/${tune.id}/edit`, { state: { from: fullPath } });
  };

  return (
    <div class="h-full flex flex-col">
      <PracticeControlBanner
        evaluationsCount={evaluationsCount()}
        isStaging={isStaging()}
        onSubmitEvaluations={handleSubmitEvaluations}
        onAddTunes={handleAddTunes}
        queueDate={queueDate()}
        latestQueueDate={latestQueueDate()}
        recentQueueDates={recentQueueDates()}
        hasMoreRecentQueues={hasMoreRecentQueueDates()}
        onQueueDateChange={handleQueueDateChange}
        onSelectLatestQueue={selectLatestQueueDate}
        onLoadMoreRecentQueues={loadMoreRecentQueueDates}
        onQueueReset={handleQueueReset}
        showSubmitted={showSubmitted()}
        onShowSubmittedChange={setShowSubmitted}
        flashcardMode={flashcardMode()}
        onFlashcardModeChange={setFlashcardMode}
        table={tableInstance()}
        selectedTuneSetId={selectedTuneSetId()}
        onSelectedTuneSetChange={setSelectedTuneSetId}
        flashcardFieldVisibility={flashcardFieldVisibility()}
        onFlashcardFieldVisibilityChange={setFlashcardFieldVisibility}
        rolloverPending={rolloverStatus().showBanner}
        rolloverDate={rolloverStatus().wallClockDate}
        onPracticeDateRefresh={handlePracticeDateRefresh}
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
              onScheduledChange={handleScheduledChange}
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
            // If the dialog was opened from the onboarding empty-state panel,
            // chain directly into the genre-selection step so the catalog sync
            // and population happen without requiring manual navigation.
            if (openedFromOnboarding()) {
              setOpenedFromOnboarding(false);
              beginOnboardingAtGenreStep(user()?.id);
            }
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
