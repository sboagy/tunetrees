/**
 * Practice Page (Index)
 *
 * Protected route - main practice interface with grid view.
 * Clean layout with sticky control banner and practice queue grid.
 *
 * @module routes/practice/Index
 */

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
import {
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
  const { user, localDb, incrementSyncVersion, forceSyncUp, syncVersion } =
    useAuth();
  const { currentPlaylistId } = useCurrentPlaylist();

  // Get current user's local database ID from user_profile
  const [userId] = createResource(
    () => {
      const db = localDb();
      const currentUser = user();
      const version = syncVersion(); // Trigger refetch on sync
      return db && currentUser ? { db, userId: currentUser.id, version } : null;
    },
    async (params) => {
      if (!params) return null;
      const result = await params.db.all<{ id: number }>(
        sql`SELECT id FROM user_profile WHERE supabase_user_id = ${params.userId} LIMIT 1`
      );
      return result[0]?.id ?? null;
    }
  );

  // Helper to get current user ID (for non-reactive contexts)
  const getUserId = async (): Promise<number | null> => {
    // If userId resource is already loaded, use it
    const id = userId();
    if (id) return id;

    // Otherwise, fetch directly
    const db = localDb();
    if (!db || !user()) return null;

    const result = await db.all<{ id: number }>(
      sql`SELECT id FROM user_profile WHERE supabase_user_id = ${
        user()!.id
      } LIMIT 1`
    );
    return result[0]?.id ?? null;
  };

  // Track evaluations count and table instance for toolbar
  const [evaluationsCount, setEvaluationsCount] = createSignal(0);

  // Shared evaluation state between grid and flashcard views
  const [evaluations, setEvaluations] = createSignal<Record<number, string>>(
    {}
  );

  // Update count when evaluations change
  createEffect(() => {
    const count = Object.keys(evaluations()).length;
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

  // Queue Date state - persisted to localStorage
  const QUEUE_DATE_STORAGE_KEY = "TT_PRACTICE_QUEUE_DATE";
  const QUEUE_DATE_MANUAL_FLAG_KEY = "TT_PRACTICE_QUEUE_DATE_MANUAL";
  const [queueDate, setQueueDate] = createSignal(new Date());

  // Load queue date from localStorage on mount
  onMount(() => {
    const storedDate = localStorage.getItem(QUEUE_DATE_STORAGE_KEY);
    const isManual =
      localStorage.getItem(QUEUE_DATE_MANUAL_FLAG_KEY) === "true";

    if (storedDate) {
      const parsedDate = new Date(storedDate);
      if (!Number.isNaN(parsedDate.getTime())) {
        // Check if date is in the past and not manually set
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        parsedDate.setHours(0, 0, 0, 0);

        if (!isManual && parsedDate < today) {
          // Auto-advance to today (midnight rollover protection)
          const now = new Date();
          now.setHours(12, 0, 0, 0); // Set to noon
          setQueueDate(now);
          localStorage.setItem(QUEUE_DATE_STORAGE_KEY, now.toISOString());
          console.log("Auto-advanced queue date to today");
        } else {
          setQueueDate(parsedDate);
        }
      }
    }
  });

  // Persist queue date to localStorage on change
  createEffect(() => {
    localStorage.setItem(QUEUE_DATE_STORAGE_KEY, queueDate().toISOString());
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

  // Store tunes for flashcard view
  const [tunesForFlashcard, setTunesForFlashcard] = createSignal<any[]>([]);

  // Filtered tunes for flashcard - applies showSubmitted filter
  const filteredTunesForFlashcard = createMemo(() => {
    const tunes = tunesForFlashcard();
    if (showSubmitted()) {
      return tunes; // Show all tunes including submitted
    }
    return tunes.filter((tune) => !tune.completed_at); // Filter out submitted tunes
  });

  // Callback from grid to clear evaluations after submit
  let clearEvaluationsCallback: (() => void) | undefined;
  const setClearEvaluationsCallback = (callback: () => void) => {
    clearEvaluationsCallback = callback;
  };

  // Handle recall evaluation changes
  const handleRecallEvalChange = (tuneId: number, evaluation: string) => {
    console.log(`Recall evaluation for tune ${tuneId}: ${evaluation}`);

    // Update shared evaluation state
    setEvaluations((prev) => {
      if (evaluation === "") {
        // Remove evaluation if empty
        const { [tuneId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [tuneId]: evaluation };
    });
  };

  // Handle goal changes
  const handleGoalChange = (tuneId: number, goal: string | null) => {
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
      // Call new commit service
      const result = await commitStagedEvaluations(db, userId, playlistId);

      if (result.success) {
        // Success toast (auto-dismiss after 3 seconds)
        toast.success(
          `Successfully submitted ${result.count} evaluation${
            result.count !== 1 ? "s" : ""
          }`,
          {
            duration: 3000,
          }
        );

        // Force sync up to Supabase BEFORE triggering UI refresh
        console.log("🔄 [CommitEvaluations] Syncing changes to Supabase...");
        await forceSyncUp();

        // Clear evaluations in grid
        if (clearEvaluationsCallback) {
          clearEvaluationsCallback();
        }

        // Reset count
        setEvaluationsCount(0);

        // Trigger grid refresh
        incrementSyncVersion();

        console.log(
          `✅ Submit complete: ${result.count} evaluations committed`
        );
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

        // Force sync up to Supabase BEFORE triggering UI refresh
        console.log("🔄 [AddTunesToQueue] Syncing changes to Supabase...");
        await forceSyncUp();

        // Trigger grid refresh
        incrementSyncVersion();

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

    // Trigger grid refresh
    incrementSyncVersion();

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

      // Force sync up to Supabase BEFORE triggering UI refresh
      console.log("🔄 [QueueReset] Syncing changes to Supabase...");
      await forceSyncUp();

      // Trigger grid refresh to regenerate queue
      incrementSyncVersion();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast.error(`Error resetting queue: ${errorMessage}`, {
        duration: Number.POSITIVE_INFINITY,
      });

      console.error("Error resetting queue:", error);
    }
  };

  return (
    <div class="h-full flex flex-col">
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
          when={user() && localDb() && currentPlaylistId()}
          fallback={
            <div class="flex items-center justify-center h-full">
              <p class="text-gray-500 dark:text-gray-400">
                Loading practice queue...
              </p>
            </div>
          }
        >
          {/* Use a derivation to get the stable number value */}
          <Show when={currentPlaylistId() && userId()}>
            {(playlistId) => (
              <Show
                when={!flashcardMode()}
                fallback={
                  <FlashcardView
                    tunes={filteredTunesForFlashcard()}
                    fieldVisibility={flashcardFieldVisibility()}
                    onEvaluationChange={handleRecallEvalChange}
                    onExitFlashcardMode={() => setFlashcardMode(false)}
                  />
                }
              >
                <TunesGridScheduled
                  userId={userId()!}
                  playlistId={playlistId()}
                  tablePurpose="scheduled"
                  onRecallEvalChange={handleRecallEvalChange}
                  onGoalChange={handleGoalChange}
                  evaluations={evaluations()}
                  onEvaluationsChange={setEvaluations}
                  onTableInstanceChange={setTableInstance}
                  onClearEvaluationsReady={setClearEvaluationsCallback}
                  showSubmitted={showSubmitted()}
                  onTunesChange={setTunesForFlashcard}
                />
              </Show>
            )}
          </Show>
        </Show>
      </div>
    </div>
  );
};

export default PracticeIndex;
