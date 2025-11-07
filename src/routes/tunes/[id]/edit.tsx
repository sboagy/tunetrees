/**
 * Edit Tune Route
 *
 * Protected route for editing an existing tune.
 *
 * @module routes/tunes/[id]/edit
 */

import { useNavigate, useParams } from "@solidjs/router";
import type { Component } from "solid-js";
import { createResource, Show } from "solid-js";
import type { TuneEditorData } from "../../../components/tunes";
import { TuneEditor } from "../../../components/tunes";
import { useAuth } from "../../../lib/auth/AuthContext";
import { getTuneById, updateTune } from "../../../lib/db/queries/tunes";

/**
 * Edit Tune Page Component
 */
const EditTunePage: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const { localDb } = useAuth();

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
    if (!db) {
      console.error("Database not initialized");
      throw new Error("Database not available");
    }

    const tuneId = params.id;
    if (!tuneId) {
      console.error("Invalid tune ID");
      throw new Error("Invalid tune ID");
    }

    try {
      // Update tune in local SQLite (automatically queued for Supabase sync)
      await updateTune(db, tuneId, {
        title: tuneData.title ?? undefined,
        type: tuneData.type ?? undefined,
        mode: tuneData.mode ?? undefined,
        structure: tuneData.structure ?? undefined,
        incipit: tuneData.incipit ?? undefined,
        genre: tuneData.genre ?? undefined,
        privateFor: tuneData.privateFor ?? undefined,
      });

      // Navigate to tune details page
      navigate(`/tunes/${tuneId}`);
      return tuneId;
    } catch (error) {
      console.error("Error updating tune:", error);
      throw error; // Let TuneEditor handle the error display
    }
  };

  const handleCancel = () => {
    navigate(`/tunes/${params.id}`);
  };

  return (
    <div class="container mx-auto py-8 px-4">
      <Show
        when={!tune.loading}
        fallback={
          <div class="text-center py-12">
            <div class="animate-spin h-12 w-12 mx-auto border-4 border-blue-600 border-t-transparent rounded-full" />
            <p class="mt-4 text-gray-600 dark:text-gray-400">Loading tune...</p>
          </div>
        }
      >
        <Show
          when={tune()}
          fallback={
            <div class="text-center py-12">
              <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
                Tune Not Found
              </h2>
              <p class="mt-2 text-gray-600 dark:text-gray-400">
                The tune you're looking for doesn't exist or has been deleted.
              </p>
              <button
                type="button"
                onClick={() => navigate("/")}
                class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Back to Practice
              </button>
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
    </div>
  );
};

export default EditTunePage;
