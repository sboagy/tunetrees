/**
 * Edit Tune Route
 *
 * Protected route for editing an existing tune.
 * Covers the entire viewport including tabs, with sidebar visible.
 *
 * @module routes/tunes/[id]/edit
 */

import { useLocation, useNavigate, useParams } from "@solidjs/router";
import type { Component } from "solid-js";
import {
  createEffect,
  createMemo,
  createResource,
  onCleanup,
  Show,
} from "solid-js";
import type { TuneEditorData } from "../../../components/tunes";
import { TuneEditor } from "../../../components/tunes";
import { useAuth } from "../../../lib/auth/AuthContext";
import { useCurrentPlaylist } from "../../../lib/context/CurrentPlaylistContext";
import { useCurrentTune } from "../../../lib/context/CurrentTuneContext";
import {
  getOrCreateTuneOverride,
  updateTuneOverride,
} from "../../../lib/db/queries/tune-overrides";
import {
  getOrCreatePrivateNote,
  getTuneEditorData,
  updateNoteText,
  updatePlaylistTuneLearned,
  upsertPracticeRecord,
} from "../../../lib/db/queries/tune-user-data";
import {
  getTuneForUserById,
  updateTuneIfOwned,
} from "../../../lib/db/queries/tunes";

/**
 * Edit Tune Page Component
 *
 * Editor with sidebar visible, matching legacy app layout.
 */
const EditTunePage: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { localDb, userIdInt } = useAuth();
  const { currentTuneId, setCurrentTuneId } = useCurrentTune();
  const { currentPlaylistId } = useCurrentPlaylist();

  // Store the location we came from (referrer) for proper back navigation
  const returnPath = createMemo(() => {
    const state = location.state as any;
    return state?.from || "/";
  });

  // Fetch tune data with user-specific fields
  const [tune] = createResource(
    () => {
      const db = localDb();
      const tuneId = params.id;
      const uid = userIdInt();
      const playlistId = currentPlaylistId();
      return db && tuneId && uid && playlistId
        ? { db, tuneId, uid, playlistId }
        : db && tuneId && uid
          ? { db, tuneId, uid }
          : null;
    },
    async (params) => {
      if (!params) return null;

      // If we have a playlist context, fetch complete editor data
      if ("playlistId" in params && params.playlistId) {
        return await getTuneEditorData(
          params.db,
          params.tuneId,
          params.uid,
          params.playlistId
        );
      }

      // Otherwise just fetch base tune data (no user-specific fields)
      return await getTuneForUserById(params.db, params.tuneId, params.uid);
    }
  );

  // Ensure the sidebar reflects this tune while editor is active
  // Set on mount and restore previous value on unmount
  const prevTuneId = currentTuneId();
  createEffect(() => {
    const id = params.id;
    if (id) setCurrentTuneId(id);
  });
  onCleanup(() => {
    setCurrentTuneId(prevTuneId ?? null);
  });

  const handleSave = async (
    tuneData: Partial<TuneEditorData>
  ): Promise<string | undefined> => {
    const db = localDb();
    const userId = userIdInt();
    const playlistId = currentPlaylistId();

    if (!db) {
      console.error("Database not initialized");
      throw new Error("Database not available");
    }

    if (!userId) {
      console.error("User not authenticated");
      throw new Error("User must be authenticated to edit tunes");
    }

    const tuneId = params.id;
    if (!tuneId) {
      console.error("Invalid tune ID");
      throw new Error("Invalid tune ID");
    }

    const currentTune = tune();
    if (!currentTune) {
      throw new Error("Tune not loaded");
    }

    try {
      // PART 1: Save base tune fields (title, type, mode, structure, incipit, genre)
      // Guard: only allow direct tune updates if tune is explicitly owned by user (privateFor matches userId)
      // Public tunes (privateFor null) or tunes owned by another user MUST go through tune_override path.
      const isUserOwnedPrivateTune =
        !!currentTune.privateFor && currentTune.privateFor === userId;

      if (
        isUserOwnedPrivateTune &&
        (await updateTuneIfOwned(db, tuneId, userId, {
          title: tuneData.title ?? undefined,
          type: tuneData.type ?? undefined,
          mode: tuneData.mode ?? undefined,
          structure: tuneData.structure ?? undefined,
          incipit: tuneData.incipit ?? undefined,
          genre: tuneData.genre ?? undefined,
        }))
      ) {
        // Updated base tune (owned by user)
      } else {
        // Public tune or another user's tune - use tune_override
        // Build override input with only changed fields
        const overrideInput: any = {};
        if (tuneData.title !== currentTune.title)
          overrideInput.title = tuneData.title;
        if (tuneData.type !== currentTune.type)
          overrideInput.type = tuneData.type;
        if (tuneData.mode !== currentTune.mode)
          overrideInput.mode = tuneData.mode;
        if (tuneData.structure !== currentTune.structure)
          overrideInput.structure = tuneData.structure;
        if (tuneData.incipit !== currentTune.incipit)
          overrideInput.incipit = tuneData.incipit;
        if (tuneData.genre !== currentTune.genre)
          overrideInput.genre = tuneData.genre;

        // Only proceed if there are actual changes
        if (Object.keys(overrideInput).length > 0) {
          const override = await getOrCreateTuneOverride(
            db,
            tuneId,
            userId,
            overrideInput
          );

          // If override already existed, update it with the changes
          if (!override.isNew) {
            await updateTuneOverride(db, override.id, overrideInput);
          }
        }
      }

      // PART 2: Save user-specific fields if we have a playlist context
      if (playlistId) {
        // Update learned date in playlist_tune
        if (tuneData.learned !== undefined) {
          await updatePlaylistTuneLearned(
            db,
            playlistId,
            tuneId,
            tuneData.learned || null
          );
        }

        // Update practice record fields (practiced, quality, FSRS/SM2 fields)
        const practiceFields: {
          practiced?: string | null;
          quality?: number | null;
          difficulty?: number | null;
          stability?: number | null;
          step?: number | null;
          state?: number | null;
          repetitions?: number | null;
          due?: string | null;
          easiness?: number | null;
          interval?: number | null;
        } = {};
        let hasPracticeFields = false;

        if (tuneData.practiced !== undefined) {
          practiceFields.practiced = tuneData.practiced || null;
          hasPracticeFields = true;
        }
        if (tuneData.quality !== undefined) {
          practiceFields.quality = tuneData.quality;
          hasPracticeFields = true;
        }
        if (tuneData.difficulty !== undefined) {
          practiceFields.difficulty = tuneData.difficulty;
          hasPracticeFields = true;
        }
        if (tuneData.stability !== undefined) {
          practiceFields.stability = tuneData.stability;
          hasPracticeFields = true;
        }
        if (tuneData.step !== undefined) {
          practiceFields.step = tuneData.step;
          hasPracticeFields = true;
        }
        if (tuneData.state !== undefined) {
          practiceFields.state = tuneData.state;
          hasPracticeFields = true;
        }
        if (tuneData.repetitions !== undefined) {
          practiceFields.repetitions = tuneData.repetitions;
          hasPracticeFields = true;
        }
        if (tuneData.due !== undefined) {
          practiceFields.due = tuneData.due || null;
          hasPracticeFields = true;
        }
        if (tuneData.easiness !== undefined) {
          practiceFields.easiness = tuneData.easiness;
          hasPracticeFields = true;
        }
        if (tuneData.interval !== undefined) {
          practiceFields.interval = tuneData.interval;
          hasPracticeFields = true;
        }

        if (hasPracticeFields) {
          await upsertPracticeRecord(db, playlistId, tuneId, practiceFields);
        }

        // Update private notes
        if (tuneData.notes_private !== undefined) {
          const noteId = await getOrCreatePrivateNote(
            db,
            tuneId,
            userId,
            playlistId
          );
          await updateNoteText(db, noteId, tuneData.notes_private);
        }
      }

      // Navigate back to where we came from
      navigate(returnPath());
      return tuneId;
    } catch (error) {
      console.error("Error updating tune:", error);
      throw error; // Let TuneEditor handle the error display
    }
  };

  const handleCancel = () => {
    // Navigate back to where we came from
    navigate(returnPath());
  };

  return (
    <Show
      when={!tune.loading}
      fallback={
        <div class="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div class="text-center">
            <div class="animate-spin h-12 w-12 mx-auto border-4 border-blue-600 border-t-transparent rounded-full" />
            <p class="mt-4 text-gray-600 dark:text-gray-400">Loading tune...</p>
          </div>
        </div>
      }
    >
      <Show
        when={tune()}
        fallback={
          <div class="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
            <div class="text-center">
              <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
                Tune Not Found
              </h2>
              <p class="mt-2 text-gray-600 dark:text-gray-400">
                The tune you're looking for doesn't exist or has been deleted.
              </p>
              <button
                type="button"
                onClick={() => navigate(returnPath())}
                class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Go Back
              </button>
            </div>
          </div>
        }
      >
        {(tuneData) => (
          <TuneEditor
            tune={tuneData() as TuneEditorData}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        )}
      </Show>
    </Show>
  );
};

export default EditTunePage;
