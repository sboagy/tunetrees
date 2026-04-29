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
import { useCurrentRepertoire } from "../../../lib/context/CurrentRepertoireContext";
import { useCurrentTune } from "../../../lib/context/CurrentTuneContext";
import type { SqliteDatabase } from "../../../lib/db/client-sqlite";
import {
  getOrCreateTuneOverride,
  updateTuneOverride,
} from "../../../lib/db/queries/tune-overrides";
import {
  getTuneEditorData,
  updateRepertoireTuneFields,
} from "../../../lib/db/queries/tune-user-data";
import {
  getTuneForUserById,
  updateTuneIfOwned,
} from "../../../lib/db/queries/tunes";
import {
  buildBaseTuneUpdateInput,
  buildChangedTuneOverrideInput,
  buildRepertoireTuneUpdate,
  hasRepertoireTuneChanges,
} from "../edit-tune-save";

async function saveBaseTuneChanges(
  tuneData: Partial<TuneEditorData>,
  currentTune: TuneEditorData,
  db: SqliteDatabase,
  tuneId: string,
  userId: string
): Promise<void> {
  const isUserOwnedPrivateTune =
    !!currentTune.privateFor && currentTune.privateFor === userId;

  if (
    isUserOwnedPrivateTune &&
    (await updateTuneIfOwned(
      db,
      tuneId,
      userId,
      buildBaseTuneUpdateInput(tuneData)
    ))
  ) {
    return;
  }

  const overrideInput = buildChangedTuneOverrideInput(tuneData, currentTune);
  if (Object.keys(overrideInput).length === 0) {
    return;
  }

  const override = await getOrCreateTuneOverride(
    db,
    tuneId,
    userId,
    overrideInput
  );

  if (!override.isNew) {
    await updateTuneOverride(db, override.id, overrideInput);
  }
}

async function saveRepertoireTuneChanges(
  tuneData: Partial<TuneEditorData>,
  db: SqliteDatabase,
  repertoireId: string,
  tuneId: string
): Promise<void> {
  if (!hasRepertoireTuneChanges(tuneData)) {
    return;
  }

  await updateRepertoireTuneFields(
    db,
    repertoireId,
    tuneId,
    buildRepertoireTuneUpdate(tuneData)
  );
}

/**
 * Edit Tune Page Component
 *
 * Editor with sidebar visible, matching legacy app layout.
 */
const EditTunePage: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    localDb,
    userIdInt,
    incrementPracticeListStagedChanged,
    incrementRepertoireListChanged,
  } = useAuth();
  const { currentTuneId, setCurrentTuneId } = useCurrentTune();
  const { currentRepertoireId } = useCurrentRepertoire();

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
      const repertoireId = currentRepertoireId();
      return db && tuneId && uid && repertoireId
        ? { db, tuneId, uid, repertoireId }
        : db && tuneId && uid
          ? { db, tuneId, uid }
          : null;
    },
    async (params) => {
      if (!params) return null;

      // If we have a repertoire context, fetch complete editor data
      if ("repertoireId" in params && params.repertoireId) {
        return await getTuneEditorData(
          params.db,
          params.tuneId,
          params.uid,
          params.repertoireId
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
    const repertoireId = currentRepertoireId();

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
      await saveBaseTuneChanges(tuneData, currentTune, db, tuneId, userId);

      if (repertoireId) {
        await saveRepertoireTuneChanges(tuneData, db, repertoireId, tuneId);
      }

      // Signal grids to refresh with updated data
      incrementPracticeListStagedChanged();
      incrementRepertoireListChanged();

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
