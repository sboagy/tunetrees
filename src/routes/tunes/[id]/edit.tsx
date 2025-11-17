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
import { createMemo, createResource, Show } from "solid-js";
import type { TuneEditorData } from "../../../components/tunes";
import { TuneEditor } from "../../../components/tunes";
import { useAuth } from "../../../lib/auth/AuthContext";
import {
  getOrCreateTuneOverride,
  updateTuneOverride,
} from "../../../lib/db/queries/tune-overrides";
import { getTuneById, updateTune } from "../../../lib/db/queries/tunes";

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

  // Store the location we came from (referrer) for proper back navigation
  const returnPath = createMemo(() => {
    const state = location.state as any;
    return state?.from || "/";
  });

  // Fetch tune data
  const [tune] = createResource(
    () => {
      const db = localDb();
      const tuneId = params.id;
      return db && tuneId ? { db, tuneId } : null;
    },
    async (params) => {
      if (!params) return null;
      return await getTuneById(params.db, params.tuneId);
    }
  );

  const handleSave = async (
    tuneData: Partial<TuneEditorData>
  ): Promise<string | undefined> => {
    const db = localDb();
    const userId = userIdInt();

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
      // Check if this is the user's private tune
      const isPrivateTune = currentTune.privateFor === userId;

      if (isPrivateTune) {
        // User owns this tune - update the tune table directly
        await updateTune(db, tuneId, {
          title: tuneData.title ?? undefined,
          type: tuneData.type ?? undefined,
          mode: tuneData.mode ?? undefined,
          structure: tuneData.structure ?? undefined,
          incipit: tuneData.incipit ?? undefined,
          genre: tuneData.genre ?? undefined,
          privateFor: tuneData.privateFor ?? undefined,
        });
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
