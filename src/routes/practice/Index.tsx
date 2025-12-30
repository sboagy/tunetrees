/**
 * Practice Page (Index)
 *
 * Protected route - main practice interface with grid view.
 * Clean layout with sticky control banner and practice queue grid.
 *
 * @module routes/practice/Index
 */

import { useLocation, useNavigate } from "@solidjs/router";
import { and, eq, gte, lt, sql } from "drizzle-orm";
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
import { GRID_CONTENT_CONTAINER } from "../../components/grids/shared-toolbar-styles";
import type { ITuneOverview } from "../../components/grids/types";
import {
  DateRolloverBanner,
  type FlashcardFieldVisibilityByFace,
  FlashcardView,
  getDefaultFieldVisibility,
  PracticeControlBanner,
} from "../../components/practice";
import { useAuth } from "../../lib/auth/AuthContext";
import { useCurrentPlaylist } from "../../lib/context/CurrentPlaylistContext";
import { dailyPracticeQueue } from "../../lib/db/schema";
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
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    localDb,
    incrementPracticeListStagedChanged,
    practiceListStagedChanged,
    remoteSyncDownCompletionVersion,
    initialSyncComplete,
    syncPracticeScope,
  } = useAuth();
  const { currentPlaylistId } = useCurrentPlaylist();

  // Get current user's local database ID from user_profile
  const [userId] = createResource(
    () => {
      const db = localDb();
      const currentUser = user();
      const syncReady = initialSyncComplete();
      const isOnline =
        typeof navigator !== "undefined" ? navigator.onLine : true;
      const remoteSyncReady =
        remoteSyncDownCompletionVersion() > 0 ||
        !isOnline ||
        import.meta.env.VITE_DISABLE_SYNC === "true";

      if (!syncReady || !remoteSyncReady) {
        console.log(
          "[PracticeIndex] Waiting for initial sync/syncDown before resolving userId..."
        );
        return null;
      }

      return db && currentUser ? { db, userId: currentUser.id } : null;
    },
    async (params) => {
      if (!params) return null;
      const result = await params.db.all<{ supabase_user_id: string }>(
        sql`SELECT supabase_user_id FROM user_profile WHERE supabase_user_id = ${params.userId} LIMIT 1`
      );
      return result[0]?.supabase_user_id ?? null;
    }
  );

  // Helper to get current user ID (for non-reactive contexts)
  const getUserId = async (): Promise<string | null> => {
    // If userId resource is already loaded, use it
    const id = userId();
    if (id) return id;

    // Otherwise, fetch directly
    const db = localDb();
    if (!db || !user()) return null;

    const result = await db.all<{ supabase_user_id: string }>(
      sql`SELECT supabase_user_id FROM user_profile WHERE supabase_user_id = ${user()!.id} LIMIT 1`
    );
    return result[0]?.supabase_user_id ?? null;
  };

  // Track evaluations count and table instance for toolbar
  const [evaluationsCount, setEvaluationsCount] = createSignal(0);

  // Shared evaluation state between grid and flashcard views
  const [evaluations, setEvaluations] = createSignal<Record<number, string>>(
    {}
  );

  // Update count when evaluations change
  createEffect(() => {
    // Count only non-empty evaluations; empty string represents "(Not Set)"
    const count = Object.values(evaluations()).filter((v) => v !== "").length;
    setEvaluationsCount(count);
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

  // Store initial practice date for rollover detection
  const [initialPracticeDate, setInitialPracticeDate] = createSignal<Date>(
    getPracticeDate()
  );

  // Load queue date from localStorage on mount, or use practice date
  onMount(() => {
    const practiceDate = getPracticeDate();
    setInitialPracticeDate(practiceDate);

    const storedDate = localStorage.getItem(QUEUE_DATE_STORAGE_KEY);
    const isManual =
      localStorage.getItem(QUEUE_DATE_MANUAL_FLAG_KEY) === "true";

    if (storedDate && isManual) {
      const parsedDate = new Date(storedDate);
      if (!Number.isNaN(parsedDate.getTime())) {
        // Use manually selected date
        setQueueDate(parsedDate);
        console.log(
          `[PracticeIndex] Using manual queue date: ${parsedDate.toLocaleDateString()}`
        );
        return;
      }
    }

    // Use practice date (respects URL override for testing)
    setQueueDate(practiceDate);
    localStorage.setItem(QUEUE_DATE_STORAGE_KEY, practiceDate.toISOString());
    localStorage.setItem(QUEUE_DATE_MANUAL_FLAG_KEY, "false");
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
      const playlistId = currentPlaylistId();
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

      return db && userId() && playlistId
        ? { db, userId: userId()!, playlistId, date }
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
          params.playlistId,
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
  const [practiceListData] = createResource(
    () => {
      const db = localDb();
      const playlistId = currentPlaylistId();
      const version = practiceListStagedChanged(); // Refetch when practice list changes
      const initialized = queueInitialized(); // Wait for queue to be ready

      console.log(
        `[PracticeIndex] practiceListData deps: db=${!!db}, userId=${userId()}, playlist=${playlistId}, version=${version}, queueInit=${initialized}`
      );

      // Only proceed if ALL dependencies are ready (including queue)
      return db && userId() && playlistId && initialized
        ? {
            db,
            userId: userId()!,
            playlistId,
            version,
            queueReady: initialized,
          }
        : null;
    },
    async (params) => {
      if (!params) return [];
      const { getPracticeList } = await import("../../lib/db/queries/practice");
      const delinquencyWindowDays = 7;
      console.log(
        `[PracticeIndex] Fetching practice list for playlist ${params.playlistId} (queueReady=${params.queueReady})`
      );
      // Returns PracticeListStagedWithQueue[] which is compatible with ITuneOverview
      return await getPracticeList(
        params.db,
        params.userId,
        params.playlistId,
        delinquencyWindowDays
      );
    }
  );

  // Filtered practice list - applies showSubmitted filter
  // This is the single source of truth for both grid and flashcard views
  const filteredPracticeList = createMemo(() => {
    const data = practiceListData() || [];
    const shouldShow = showSubmitted();

    console.log(
      `[PracticeIndex] Filtering practice list: ${data.length} total, showSubmitted=${shouldShow}`
    );

    // When showSubmitted is true, show all tunes including completed ones
    // When showSubmitted is false, hide completed tunes (where completed_at is not null)
    const filtered = shouldShow
      ? data
      : data.filter((tune: any) => !tune.completed_at);

    console.log(`[PracticeIndex] After filtering: ${filtered.length} tunes`);
    return filtered;
  });

  // Grid no longer provides a clear-evaluations callback; parent clears evaluations directly

  // Handle recall evaluation changes (single source of truth)
  // Children (grid/flashcard) call into this; we optimistically update shared
  // state, then stage or clear in the local DB, and notify the grid via
  // incrementPracticeListStagedChanged so the joined view refreshes.
  const handleRecallEvalChange = async (tuneId: string, evaluation: string) => {
    console.log(`Recall evaluation for tune ${tuneId}: ${evaluation}`);

    // 1) Optimistic shared-state update (drives both grid and flashcard)
    setEvaluations((prev) => ({ ...prev, [tuneId]: evaluation }));

    // 2) Stage/clear in local DB
    const db = localDb();
    const playlistId = currentPlaylistId();
    const userIdVal = await getUserId();

    if (!db || !playlistId || !userIdVal) {
      console.warn(
        "[PracticeIndex] Skipping staging: missing db/playlist/userId",
        {
          hasDb: !!db,
          playlistId,
          userIdVal,
        }
      );
      return; // Still keep optimistic state
    }

    try {
      if (evaluation === "") {
        // Clear staged data when "(Not Set)" selected
        await clearStagedEvaluation(db, userIdVal, tuneId, playlistId);
        console.log(
          `🗑️  [PracticeIndex] Cleared staged evaluation for tune ${tuneId}`
        );
      } else {
        // Stage FSRS preview for actual evaluations
        await stagePracticeEvaluation(
          db,
          userIdVal,
          playlistId,
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
    const playlistId = currentPlaylistId();

    if (!db || !playlistId) {
      console.error("Missing required data for submit");
      toast.error("Cannot submit: Missing database or playlist data");
      return;
    }

    const userId = await getUserId();
    if (!userId) {
      console.error("Could not determine user ID");
      toast.error("Cannot submit: User not found");
      return;
    }

    const count = evaluationsCount();
    if (count === 0) {
      toast.warning("No evaluations to submit");
      return;
    }

    console.log(
      `Submitting ${count} staged evaluations for playlist ${playlistId}`
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
        playlistId,
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

        // Reset count
        setEvaluationsCount(0);

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
    const playlistId = currentPlaylistId();

    if (!db || !playlistId) {
      console.error("Missing required data for add tunes");
      toast.error("Cannot add tunes: Missing database or playlist data");
      return;
    }

    const userId = await getUserId();
    if (!userId) {
      console.error("Could not determine user ID");
      toast.error("Cannot add tunes: User not found");
      return;
    }

    console.log(
      `Adding ${count} tunes to practice queue for playlist ${playlistId}`
    );

    try {
      const added = await addTunesToQueue(db, userId, playlistId, count);

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

  // Handle queue reset
  const handleQueueReset = async () => {
    const db = localDb();
    const playlistId = currentPlaylistId();

    if (!db || !playlistId) {
      console.error("Missing required data for queue reset");
      toast.error("Cannot reset queue: Missing database or playlist data");
      return;
    }

    const userId = await getUserId();
    if (!userId) {
      console.error("Could not determine user ID");
      toast.error("Cannot reset queue: User not found");
      return;
    }

    console.log(`Resetting active queue for playlist ${playlistId}`);

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
            eq(dailyPracticeQueue.playlistRef, playlistId),
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

  return (
    <div class="h-full flex flex-col">
      {/* Date Rollover Banner - appears when practice date changes */}
      <DateRolloverBanner initialDate={initialPracticeDate()} />

      {/* Sticky Control Banner */}
      <PracticeControlBanner
        evaluationsCount={evaluationsCount()}
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
        <Show
          when={
            user() &&
            localDb() &&
            currentPlaylistId() &&
            initialSyncComplete() &&
            !userId.loading &&
            userId()
          }
          fallback={
            <div class="flex items-center justify-center h-full">
              <p class="text-gray-500 dark:text-gray-400">
                Loading practice queue... (top)
              </p>
            </div>
          }
        >
          <Show
            when={!flashcardMode()}
            fallback={
              <FlashcardView
                tunes={filteredPracticeList() as any}
                fieldVisibility={flashcardFieldVisibility()}
                evaluations={evaluations()}
                onRecallEvalChange={handleRecallEvalChange}
                localDb={localDb}
                userId={userId()!}
                playlistId={currentPlaylistId()!}
              />
            }
          >
            <TunesGridScheduled
              userId={userId()!}
              playlistId={currentPlaylistId()!}
              tablePurpose="scheduled"
              onRecallEvalChange={handleRecallEvalChange}
              onGoalChange={handleGoalChange}
              onTuneSelect={handleTuneSelect}
              evaluations={evaluations()}
              onTableInstanceChange={setTableInstance}
              practiceListData={filteredPracticeList()}
            />
          </Show>
        </Show>
      </div>
    </div>
  );
};

export default PracticeIndex;
