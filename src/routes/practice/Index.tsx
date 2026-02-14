/**
 * Practice Page (Index)
 *
 * Protected route - main practice interface with grid view.
 * Clean layout with sticky control banner and practice queue grid.
 *
 * @module routes/practice/Index
 */

import { useLocation, useNavigate } from "@solidjs/router";
import { and, eq, gte, lt } from "drizzle-orm";
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
import { TunesGridScheduled } from "../../components/grids";
import { GridStatusMessage } from "../../components/grids/GridStatusMessage";
import { GRID_CONTENT_CONTAINER } from "../../components/grids/shared-toolbar-styles";
import type { ITuneOverview } from "../../components/grids/types";
import { RepertoireEditorDialog } from "../../components/repertoires/RepertoireEditorDialog";
import {
  DateRolloverBanner,
  type FlashcardFieldVisibilityByFace,
  FlashcardView,
  getDefaultFieldVisibility,
  PracticeControlBanner,
} from "../../components/practice";
import { RepertoireEmptyState } from "../../components/repertoire";
import { useAuth } from "../../lib/auth/AuthContext";
import { useCurrentRepertoire } from "../../lib/context/CurrentRepertoireContext";
import { getUserRepertoires } from "../../lib/db/queries/repertoires";
import { dailyPracticeQueue } from "../../lib/db/schema";
import type { RepertoireWithSummary } from "../../lib/db/types";
import { addTunesToQueue } from "../../lib/services/practice-queue";
import { commitStagedEvaluations } from "../../lib/services/practice-recording";
import {
  clearStagedEvaluation,
  stagePracticeEvaluation,
} from "../../lib/services/practice-staging";
import {
  formatAsWindowStart,
  getPracticeDate,
} from "../../lib/utils/practice-date";

/**
 * Practice Index Page Component
 *
 * Features:
 * - Sticky control banner with actions
 * - TunesGridScheduled with embedded evaluation controls
 * - Shows due tunes based on practice queue
 *
 * @example
 * ```tsx
 * <Route path="/practice" component={() => (
 *   <ProtectedRoute>
 *     <PracticeIndex />
 *   </ProtectedRoute>
 * )} />
 * ```
 */
const PracticeIndex: Component = () => {
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
  } = useAuth();
  const { currentRepertoireId } = useCurrentRepertoire();
  const [showRepertoireDialog, setShowRepertoireDialog] = createSignal(false);
  const repertoiresVersion = createMemo(
    () => `${repertoireListChanged()}:${remoteSyncDownCompletionVersion()}`
  );
  const [repertoiresLoadedVersion, setRepertoiresLoadedVersion] = createSignal<
    string | null
  >(null);

  // Canonical user identifier after eliminating user_profile.id.
  // Prefer AuthContext's resolved ID; fall back to Supabase auth user id.
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
        `[PracticeIndexGate] blocked=${practiceGateBlockingReasons().join(",") || "none"} state=${signature}`
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

  // Helper to get current user ID (for non-reactive contexts)
  const getUserId = async (): Promise<string | null> => {
    // If userId resource is already loaded, use it
    const id = userId();
    if (id) return id;

    // After eliminating user_profile.id, just return the Supabase Auth UUID
    return user()?.id ?? null;
  };

  // Track in-flight staging to prevent submit before previews are persisted.
  const [stagingTuneIds, setStagingTuneIds] = createSignal<string[]>([]);
  const isStaging = () => stagingTuneIds().length > 0;

  // Shared evaluation state between grid and flashcard views.
  // Keys are tune IDs (UUID strings).
  const [evaluations, setEvaluations] = createSignal<Record<string, string>>(
    {}
  );

  // Hydrate once from DB-staged values (table_transient_data via practice list VIEW).
  // This ensures the submit badge and selected values survive tab switches/unmounts.
  const [didHydrateEvaluations, setDidHydrateEvaluations] = createSignal(false);
  createEffect(() => {
    const repertoireId = currentRepertoireId();
    if (!repertoireId) return;
    // Reset hydration when repertoire changes.
    setDidHydrateEvaluations(false);
    setEvaluations({});
  });

  createEffect(() => {
    if (didHydrateEvaluations()) return;
    const list = filteredPracticeList();
    if (!list || list.length === 0) return;

    const hydrated: Record<string, string> = {};
    for (const tune of list) {
      const id = String(tune.id);
      const recallEval = tune.recall_eval;
      if (typeof recallEval === "string" && recallEval.length > 0) {
        hydrated[id] = recallEval;
      }
    }

    if (Object.keys(hydrated).length > 0) {
      setEvaluations(hydrated);
    }
    setDidHydrateEvaluations(true);
  });

  // Display Submitted state - persisted to localStorage
  const STORAGE_KEY = "TT_PRACTICE_SHOW_SUBMITTED";
  const [showSubmitted, setShowSubmitted] = createSignal(false);

  // Load showSubmitted from localStorage on mount
  onMount(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setShowSubmitted(stored === "true");
    }
  });

  // Persist showSubmitted to localStorage on change
  createEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(showSubmitted()));
  });

  // Queue Date state - derived from practice date service
  // In production: uses current date
  // In test mode: uses ?practiceDate=YYYY-MM-DD from URL
  const QUEUE_DATE_STORAGE_KEY = "TT_PRACTICE_QUEUE_DATE";
  const QUEUE_DATE_MANUAL_FLAG_KEY = "TT_PRACTICE_QUEUE_DATE_MANUAL";
  const [queueDate, setQueueDate] = createSignal<Date>(getPracticeDate());
  const [isManualQueueDate, setIsManualQueueDate] = createSignal(false);

  // Store initial practice date for rollover detection
  const [initialPracticeDate, setInitialPracticeDate] = createSignal<Date>(
    getPracticeDate()
  );

  const normalizeToLocalDay = (date: Date): Date => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };

  // Load queue date from localStorage on mount, or use practice date
  onMount(() => {
    const practiceDate = getPracticeDate();
    const storedDateValue = localStorage.getItem(QUEUE_DATE_STORAGE_KEY);
    const persistedManualFlag =
      localStorage.getItem(QUEUE_DATE_MANUAL_FLAG_KEY) === "true";
    setIsManualQueueDate(persistedManualFlag);

    const applyQueueDate = (date: Date) => {
      setQueueDate(date);
      setInitialPracticeDate(date);
    };

    const markAsAutoDate = () => {
      setIsManualQueueDate(false);
      localStorage.setItem(QUEUE_DATE_MANUAL_FLAG_KEY, "false");
    };

    if (storedDateValue) {
      const parsedDate = new Date(storedDateValue);
      if (!Number.isNaN(parsedDate.getTime())) {
        if (persistedManualFlag) {
          applyQueueDate(parsedDate);
          setIsManualQueueDate(true);
          console.log(
            `[PracticeIndex] Using manual queue date: ${parsedDate.toLocaleDateString()}`
          );
          return;
        }

        const storedDay = normalizeToLocalDay(parsedDate);
        const practiceDay = normalizeToLocalDay(practiceDate);

        if (storedDay.getTime() !== practiceDay.getTime()) {
          applyQueueDate(practiceDate);
          markAsAutoDate();
          localStorage.setItem(
            QUEUE_DATE_STORAGE_KEY,
            practiceDate.toISOString()
          );
          console.log(
            `[PracticeIndex] Auto queue date reset to practice date: ${practiceDate.toLocaleDateString()}`
          );
          return;
        }

        applyQueueDate(parsedDate);
        markAsAutoDate();
        console.log(
          `[PracticeIndex] Using persisted queue date: ${parsedDate.toLocaleDateString()} (auto)`
        );
        return;
      }
    }

    applyQueueDate(practiceDate);
    markAsAutoDate();
    localStorage.setItem(QUEUE_DATE_STORAGE_KEY, practiceDate.toISOString());
    console.log(
      `[PracticeIndex] Using practice date: ${practiceDate.toLocaleDateString()}`
    );
  });

  // Persist queue date to localStorage on change
  createEffect(() => {
    const date = queueDate();
    localStorage.setItem(QUEUE_DATE_STORAGE_KEY, date.toISOString());
  });

  // Flashcard Mode state - persisted to localStorage
  const FLASHCARD_MODE_STORAGE_KEY = "TT_PRACTICE_FLASHCARD_MODE";
  const [flashcardMode, setFlashcardMode] = createSignal(false);

  // Flashcard Field Visibility - persisted to localStorage
  const FLASHCARD_FIELDS_STORAGE_KEY = "TT_FLASHCARD_FIELD_VISIBILITY";
  const [flashcardFieldVisibility, setFlashcardFieldVisibility] =
    createSignal<FlashcardFieldVisibilityByFace>(getDefaultFieldVisibility());

  // Load flashcard mode from localStorage on mount
  onMount(() => {
    const stored = localStorage.getItem(FLASHCARD_MODE_STORAGE_KEY);
    if (stored !== null) {
      setFlashcardMode(stored === "true");
    }

    // Load flashcard field visibility from localStorage
    const storedFields = localStorage.getItem(FLASHCARD_FIELDS_STORAGE_KEY);
    if (storedFields) {
      try {
        const parsed = JSON.parse(storedFields);

        // Check if old format (flat object with 'type' directly) or new format (has 'front'/'back')
        if (parsed.type !== undefined && !parsed.front) {
          // Old format - migrate to new per-face structure
          console.info(
            "Migrating old flashcard field visibility format to new front/back structure"
          );
          setFlashcardFieldVisibility({
            front: { ...parsed },
            back: { ...parsed },
          });
        } else if (parsed.front && parsed.back) {
          // New format - use as is
          setFlashcardFieldVisibility(parsed);
        } else {
          // Unrecognized format - use defaults
          console.warn(
            "Unrecognized flashcard field visibility format, using defaults"
          );
        }
      } catch (e) {
        console.error("Failed to parse flashcard field visibility:", e);
      }
    }
  });

  // Persist flashcard mode to localStorage on change
  createEffect(() => {
    localStorage.setItem(FLASHCARD_MODE_STORAGE_KEY, String(flashcardMode()));
  });

  // Persist flashcard field visibility to localStorage on change
  createEffect(() => {
    localStorage.setItem(
      FLASHCARD_FIELDS_STORAGE_KEY,
      JSON.stringify(flashcardFieldVisibility())
    );
  });

  const [tableInstance, setTableInstance] = createSignal<any>(null);

  // Initialize daily practice queue (must run BEFORE fetching practice list)
  // getPracticeList does INNER JOIN with daily_practice_queue, so queue must exist first
  // IMPORTANT: Only re-runs when queueDate changes, NOT on every practice list change
  const [queueInitialized] = createResource(
    () => {
      const db = localDb();
      const repertoireId = currentRepertoireId();
      const date = queueDate(); // Use user-controlled queue date, not getPracticeDate()
      const syncReady = initialSyncComplete();
      const isOnline =
        typeof navigator !== "undefined" ? navigator.onLine : true;
      const remoteSyncReady =
        remoteSyncDownCompletionVersion() > 0 ||
        !isOnline ||
        import.meta.env.VITE_DISABLE_SYNC === "true";

      if (!syncReady || !remoteSyncReady) {
        console.log(
          "[PracticeIndex] Waiting for initial sync/syncDown before initializing queue..."
        );
        return null;
      }

      return db && userId() && repertoireId
        ? { db, userId: userId()!, repertoireId, date }
        : null;
    },
    async (params) => {
      if (!params) return false;

      const { ensureDailyQueue } = await import(
        "../../lib/services/practice-queue"
      );

      try {
        // ensureDailyQueue checks if queue exists and only creates if missing
        const created = await ensureDailyQueue(
          params.db,
          params.userId,
          params.repertoireId,
          params.date
        );

        if (created) {
          console.log(
            `[PracticeIndex] ✅ Created new daily queue for ${params.date.toLocaleDateString()}`
          );
        } else {
          console.log(
            `[PracticeIndex] ✓ Queue already exists for ${params.date.toLocaleDateString()}`
          );
        }

        return true;
      } catch (error) {
        console.error("[PracticeIndex] Queue initialization failed:", error);
        return false;
      }
    }
  );

  // Fetch practice list (shared between grid and flashcard views)
  // CRITICAL: Must wait for queueInitialized() to complete before fetching
  // Also check queueInitialized.loading to prevent race condition where
  // practiceListData fetches while queue is being re-initialized
  const [practiceListData] = createResource(
    () => {
      const db = localDb();
      const repertoireId = currentRepertoireId();
      const version = practiceListStagedChanged(); // Refetch when practice list changes
      const initialized = queueInitialized(); // Wait for queue to be ready
      const isQueueLoading = queueInitialized.loading; // Check if queue is currently loading/re-loading
      const windowStartUtc = formatAsWindowStart(queueDate());

      console.log(
        `[PracticeIndex] practiceListData deps: db=${!!db}, userId=${userId()}, repertoire=${repertoireId}, version=${version}, queueInit=${initialized}, queueLoading=${isQueueLoading}, window=${windowStartUtc}`
      );

      // Only proceed if ALL dependencies are ready (including queue)
      // CRITICAL: Also check that queue is not currently loading to prevent race condition
      // where we fetch practice list while ensureDailyQueue is still running
      return db && userId() && repertoireId && initialized && !isQueueLoading
        ? {
            db,
            userId: userId()!,
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
      const delinquencyWindowDays = 7;
      console.log(
        `[PracticeIndex] Fetching practice list for repertoire ${params.repertoireId} (queueReady=${params.queueReady})`
      );
      // Returns PracticeListStagedWithQueue[] which is compatible with ITuneOverview
      return await getPracticeList(
        params.db,
        params.userId,
        params.repertoireId,
        delinquencyWindowDays,
        params.windowStartUtc
      );
    }
  );

  const [isQueueCompleted, setIsQueueCompleted] = createSignal(false);

  createEffect(() => {
    const data = practiceListData();

    if (!data || data.length === 0) {
      setIsQueueCompleted(false);
      return;
    }

    const allCompleted = data.every((tune) => !!tune.completed_at);
    setIsQueueCompleted(allCompleted);
  });

  // Count staged evaluations from the practice list view (authoritative source).
  const evaluationsCount = createMemo(() => {
    const data = practiceListData() || [];
    return data.reduce((count, tune) => {
      return count + (Number(tune.has_staged) === 1 ? 1 : 0);
    }, 0);
  });

  // Filtered practice list - applies showSubmitted filter
  // This is the single source of truth for both grid and flashcard views
  const filteredPracticeList = createMemo<ITuneOverview[]>(() => {
    const data: ITuneOverview[] = practiceListData() || [];
    const shouldShow = showSubmitted();

    console.log(
      `[PracticeIndex] Filtering practice list: ${data.length} total, showSubmitted=${shouldShow}`
    );

    // When showSubmitted is true, show all tunes including completed ones
    // When showSubmitted is false, hide completed tunes (where completed_at is not null)
    const filtered = shouldShow
      ? data
      : data.filter((tune) => !tune.completed_at);

    console.log(`[PracticeIndex] After filtering: ${filtered.length} tunes`);
    return filtered;
  });

  const practiceListLoading = () =>
    practiceListData.loading || queueInitialized.loading;
  const practiceListError = () =>
    practiceListData.error ||
    (queueInitialized() === false
      ? "Practice queue failed to initialize."
      : undefined);

  // Grid no longer provides a clear-evaluations callback; parent clears evaluations directly

  // Handle recall evaluation changes (single source of truth)
  // Children (grid/flashcard) call into this; we optimistically update shared
  // state, then stage or clear in the local DB, and notify the grid via
  // incrementPracticeListStagedChanged so the joined view refreshes.
  const handleRecallEvalChange = async (tuneId: string, evaluation: string) => {
    console.log(`Recall evaluation for tune ${tuneId}: ${evaluation}`);

    // 1) Optimistic shared-state update (drives both grid and flashcard)
    const previousEvaluation = evaluations()[tuneId];
    const nextEvaluations = { ...evaluations(), [tuneId]: evaluation };
    setEvaluations(nextEvaluations);

    // 2) Stage/clear in local DB
    const db = localDb();
    const repertoireId = currentRepertoireId();
    const userIdVal = await getUserId();

    if (!db || !repertoireId || !userIdVal) {
      console.warn(
        "[PracticeIndex] Skipping staging: missing db/repertoire/userId",
        {
          hasDb: !!db,
          repertoireId,
          userIdVal,
        }
      );
      return; // Still keep optimistic state
    }

    setStagingTuneIds((prev) =>
      prev.includes(tuneId) ? prev : [...prev, tuneId]
    );

    try {
      if (evaluation === "") {
        // Clear staged data when "(Not Set)" selected
        await clearStagedEvaluation(db, userIdVal, tuneId, repertoireId);
        console.log(
          `🗑️  [PracticeIndex] Cleared staged evaluation for tune ${tuneId}`
        );
      } else {
        // Stage FSRS preview for actual evaluations
        await stagePracticeEvaluation(
          db,
          userIdVal,
          repertoireId,
          tuneId,
          evaluation,
          "recall",
          "fsrs"
        );
        console.log(
          `✅ [PracticeIndex] Staged FSRS preview for tune ${tuneId}`
        );
      }

      // 3) Let grid re-query its VIEW join without forcing dropdown close in child
      incrementPracticeListStagedChanged();
    } catch (error) {
      console.error(
        `❌ [PracticeIndex] Failed to ${evaluation === "" ? "clear" : "stage"} evaluation for ${tuneId}:`,
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

  // Handle goal changes
  const handleGoalChange = (tuneId: string, goal: string | null) => {
    console.log(`Goal for tune ${tuneId}: ${goal}`);
    // TODO: Update goal in local DB immediately
    // TODO: Queue sync to Supabase
  };

  // Handle submit of staged evaluations
  const handleSubmitEvaluations = async () => {
    const db = localDb();
    const repertoireId = currentRepertoireId();

    if (!db || !repertoireId) {
      console.error("Missing required data for submit");
      toast.error("Cannot submit: Missing database or repertoire data");
      return;
    }

    const userId = await getUserId();
    if (!userId) {
      console.error("Could not determine user ID");
      toast.error("Cannot submit: User not found");
      return;
    }

    if (isStaging()) {
      toast.warning("Please wait for evaluations to finish staging.");
      return;
    }

    const count = evaluationsCount();
    if (count === 0) {
      toast.warning("No evaluations to submit");
      return;
    }

    console.log(
      `Submitting ${count} staged evaluations for repertoire ${repertoireId}`
    );

    try {
      // Use queue date (which is set from practice date on load)
      const date = queueDate();

      // Convert to window_start_utc format (YYYY-MM-DD 00:00:00)
      const windowStartUtc = formatAsWindowStart(date);

      console.log(`Using queue window: ${windowStartUtc}`);

      // Call new commit service with specific queue window
      const result = await commitStagedEvaluations(
        db,
        userId,
        repertoireId,
        windowStartUtc
      );

      if (result.success) {
        // Success toast (auto-dismiss after 3 seconds)
        toast.success(
          `Successfully submitted ${result.count} evaluation${result.count !== 1 ? "s" : ""}`,
          {
            duration: 3000,
          }
        );

        // Clear shared evaluations state (used by both grid and flashcard)
        setEvaluations({});

        // Grid reacts via shared evaluations signal; no per-grid callback needed

        // Trigger grid refresh using view-specific signal
        incrementPracticeListStagedChanged();

        console.log(
          `✅ Submit complete: ${result.count} evaluations committed`
        );

        // Fire a scoped practice sync to pull remote updates for just practice tables
        // (avoids full-table sweep & reduces perceived latency)
        void syncPracticeScope();
      } else {
        // Error toast (requires manual dismiss)
        toast.error(
          `Failed to submit evaluations: ${result.error || "Unknown error"}`,
          {
            duration: Number.POSITIVE_INFINITY, // Requires manual dismiss
          }
        );

        console.error("Submit failed:", result.error);
      }
    } catch (error) {
      // Unexpected error toast
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast.error(`Error during submit: ${errorMessage}`, {
        duration: Number.POSITIVE_INFINITY,
      });

      console.error("Error submitting evaluations:", error);
    }
  };

  // Handle add tunes to queue
  const handleAddTunes = async (count: number) => {
    const db = localDb();
    const repertoireId = currentRepertoireId();

    if (!db || !repertoireId) {
      console.error("Missing required data for add tunes");
      toast.error("Cannot add tunes: Missing database or repertoire data");
      return;
    }

    const userId = await getUserId();
    if (!userId) {
      console.error("Could not determine user ID");
      toast.error("Cannot add tunes: User not found");
      return;
    }

    console.log(
      `Adding ${count} tunes to practice queue for repertoire ${repertoireId}`
    );

    try {
      const added = await addTunesToQueue(db, userId, repertoireId, count);

      if (added.length > 0) {
        toast.success(
          `Added ${added.length} tune${added.length !== 1 ? "s" : ""} to queue`,
          {
            duration: 3000,
          }
        );

        // Trigger grid refresh using view-specific signal
        incrementPracticeListStagedChanged();

        console.log(`✅ Added ${added.length} tunes to queue`);
      } else {
        toast.warning("No additional tunes available to add");
        console.log("⚠️ No tunes added - backlog may be empty");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast.error(`Error adding tunes: ${errorMessage}`, {
        duration: Number.POSITIVE_INFINITY,
      });

      console.error("Error adding tunes to queue:", error);
    }
  };

  // Handle queue date change
  const handleQueueDateChange = (date: Date, isPreview: boolean) => {
    console.log(
      `Queue date changed to: ${date.toISOString()}, preview: ${isPreview}`
    );

    // Set to noon to avoid timezone issues
    const dateAtNoon = new Date(date);
    dateAtNoon.setHours(12, 0, 0, 0);

    setQueueDate(dateAtNoon);
    setInitialPracticeDate(dateAtNoon);

    // Set manual flag if not today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDay = new Date(dateAtNoon);
    selectedDay.setHours(0, 0, 0, 0);

    const isToday = selectedDay.getTime() === today.getTime();
    localStorage.setItem(
      QUEUE_DATE_MANUAL_FLAG_KEY,
      isToday ? "false" : "true"
    );
    setIsManualQueueDate(!isToday);

    // Trigger grid refresh using view-specific signal
    incrementPracticeListStagedChanged();

    // Show appropriate message
    const dateStr = dateAtNoon.toLocaleDateString();
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

    if (db && repertoireId) {
      const userId = await getUserId();
      if (userId) {
        const dayStart = new Date(practiceDate);
        dayStart.setHours(0, 0, 0, 0);
        const nextDay = new Date(dayStart);
        nextDay.setDate(nextDay.getDate() + 1);

        try {
          await db
            .delete(dailyPracticeQueue)
            .where(
              and(
                eq(dailyPracticeQueue.userRef, userId),
                eq(dailyPracticeQueue.repertoireRef, repertoireId),
                gte(dailyPracticeQueue.windowStartUtc, dayStart.toISOString()),
                lt(dailyPracticeQueue.windowStartUtc, nextDay.toISOString())
              )
            )
            .run();
        } catch (error) {
          console.warn(
            "[PracticeIndex] Failed to clear queue before refresh:",
            error
          );
        }
      }
    }

    setQueueDate(practiceDate);
    setInitialPracticeDate(practiceDate);
    localStorage.setItem(QUEUE_DATE_STORAGE_KEY, practiceDate.toISOString());
    localStorage.setItem(QUEUE_DATE_MANUAL_FLAG_KEY, "false");
    setIsManualQueueDate(false);
    console.log(
      `[PracticeIndex] Refreshing queue for ${practiceDate.toLocaleDateString()}`
    );
    incrementPracticeListStagedChanged();
  };

  const handleDateRolloverDetection = () => {
    if (isManualQueueDate()) {
      return true;
    }

    if (isQueueCompleted()) {
      void handlePracticeDateRefresh();
      return false;
    }

    return true;
  };

  // Handle queue reset
  const handleQueueReset = async () => {
    const db = localDb();
    const repertoireId = currentRepertoireId();

    if (!db || !repertoireId) {
      console.error("Missing required data for queue reset");
      toast.error("Cannot reset queue: Missing database or repertoire data");
      return;
    }

    const userId = await getUserId();
    if (!userId) {
      console.error("Could not determine user ID");
      toast.error("Cannot reset queue: User not found");
      return;
    }

    console.log(`Resetting active queue for repertoire ${repertoireId}`);

    try {
      // Delete all active queue entries for today
      // This will force regeneration on next access
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      await db
        .delete(dailyPracticeQueue)
        .where(
          and(
            eq(dailyPracticeQueue.userRef, userId),
            eq(dailyPracticeQueue.repertoireRef, repertoireId),
            gte(dailyPracticeQueue.windowStartUtc, today.toISOString()),
            lt(dailyPracticeQueue.windowStartUtc, tomorrow.toISOString())
          )
        )
        .run();

      toast.success("Queue reset successfully. It will be regenerated.");
      console.log(`✅ Queue reset complete`);

      // Trigger grid refresh to regenerate queue
      incrementPracticeListStagedChanged();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast.error(`Error resetting queue: ${errorMessage}`, {
        duration: Number.POSITIVE_INFINITY,
      });

      console.error("Error resetting queue:", error);
    }
  };

  // Handle tune selection (double-click opens editor)
  const handleTuneSelect = (tune: ITuneOverview) => {
    const fullPath = location.pathname + location.search;
    navigate(`/tunes/${tune.id}/edit`, { state: { from: fullPath } });
  };

  const renderPracticeFallback = () => {
    const gateBlocked = !isPracticeGateOpen();
    const blockingReasons = practiceGateBlockingReasons();
    const repertoiresReady = repertoiresLoadedVersion() === repertoiresVersion();
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
      {/* Date Rollover Banner - appears when practice date changes */}
      <DateRolloverBanner
        initialDate={initialPracticeDate()}
        onRefresh={handlePracticeDateRefresh}
        onDateChange={handleDateRolloverDetection}
      />

      {/* Sticky Control Banner */}
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

      {/* Main Content Area - Grid or Flashcard fills remaining space */}
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
    </div>
  );
};

export default PracticeIndex;
