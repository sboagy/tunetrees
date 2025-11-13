/**
 * Edit Tune Route
 *
 * Protected route for editing an existing tune.
 * Full-screen editor that replaces the tabs area.
 *
 * @module routes/tunes/[id]/edit
 */

import { useNavigate, useParams } from "@solidjs/router";
import { Save, XCircle } from "lucide-solid";
import type { Component } from "solid-js";
import { createResource, Show } from "solid-js";
import { TopNav } from "../../../components/layout/TopNav";
import type { TuneEditorData } from "../../../components/tunes";
import { TuneEditor } from "../../../components/tunes";
import { useAuth } from "../../../lib/auth/AuthContext";
import { getTuneById, updateTune } from "../../../lib/db/queries/tunes";

/**
 * Edit Tune Page Component
 * 
 * Full-screen editor without tabs, matching legacy app layout.
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

      // Navigate back to home (practice tab)
      navigate("/");
      return tuneId;
    } catch (error) {
      console.error("Error updating tune:", error);
      throw error; // Let TuneEditor handle the error display
    }
  };

  const handleCancel = () => {
    // Navigate back to home (practice tab)
    navigate("/");
  };

  return (
    <div class="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation */}
      <TopNav />

      {/* Editor Header with Submit/Cancel */}
      <div class="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          <Show when={tune()} fallback="Edit Tune">
            Tune #{tune()?.id}
          </Show>
        </h1>

        <div class="flex items-center gap-4">
          <button
            type="button"
            onClick={handleCancel}
            class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="tune-editor-cancel-button"
          >
            Cancel
            <XCircle class="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              // Trigger form submit in TuneEditor
              const form = document.querySelector('[data-testid="tune-editor-form"]') as HTMLFormElement;
              if (form) {
                form.requestSubmit();
              }
            }}
            class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="tune-editor-submit-button"
          >
            Submit
            <Save class="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Editor Content */}
      <div class="flex-1 overflow-y-auto">
        <Show
          when={!tune.loading}
          fallback={
            <div class="flex items-center justify-center h-full">
              <div class="text-center">
                <div class="animate-spin h-12 w-12 mx-auto border-4 border-blue-600 border-t-transparent rounded-full" />
                <p class="mt-4 text-gray-600 dark:text-gray-400">
                  Loading tune...
                </p>
              </div>
            </div>
          }
        >
          <Show
            when={tune()}
            fallback={
              <div class="flex items-center justify-center h-full">
                <div class="text-center">
                  <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
                    Tune Not Found
                  </h2>
                  <p class="mt-2 text-gray-600 dark:text-gray-400">
                    The tune you're looking for doesn't exist or has been
                    deleted.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/")}
                    class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Back to Practice
                  </button>
                </div>
              </div>
            }
          >
            {(tuneData) => (
              <div class="container mx-auto py-8 px-4 max-w-5xl">
                <TuneEditor
                  tune={tuneData() as TuneEditorData}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  hideButtons={true}
                />
              </div>
            )}
          </Show>
        </Show>
      </div>
    </div>
  );
};

export default EditTunePage;
