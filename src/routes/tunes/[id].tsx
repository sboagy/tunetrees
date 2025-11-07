/**
 * Tune Details Route
 *
 * Shows full details for a single tune including:
 * - Metadata (type, mode, genre)
 * - ABC notation and structure
 * - References, notes, tags
 * - Practice history
 *
 * @module routes/tunes/[id]
 */

import { useNavigate, useParams } from "@solidjs/router";
import { type Component, createResource, Show } from "solid-js";
import { TuneDetail } from "../../components/tunes/TuneDetail";
import { useAuth } from "../../lib/auth/AuthContext";
import { deleteTune, getTuneById } from "../../lib/db/queries/tunes";

/**
 * Tune Details Page Component
 *
 * @example
 * Route: /tunes/:id
 */
const TuneDetailsPage: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const { localDb } = useAuth();

  // Fetch tune from local database
  const [tune] = createResource(
    () => {
      const db = localDb();
      const tuneId = params.id || null;
      return db && tuneId ? { db, tuneId } : null;
    },
    async (params) => {
      if (!params) return null;
      return await getTuneById(params.db, params.tuneId);
    },
  );

  const handleEdit = () => {
    navigate(`/tunes/${params.id}/edit`);
  };

  const handleDelete = async () => {
    const db = localDb();
    if (!db) {
      console.error("Database not initialized");
      return;
    }

    const tuneId = params.id || null;
    if (!tuneId) {
      console.error("Invalid tune ID");
      return;
    }

    try {
      // Soft delete the tune (automatically queued for Supabase sync)
      await deleteTune(db, tuneId);

      // Navigate back to practice page
      navigate("/practice");
    } catch (error) {
      console.error("Error deleting tune:", error);
      // TODO: Show error toast notification
    }
  };

  const handleClose = () => {
    navigate("/practice");
  };

  return (
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navigation Bar */}
      <nav class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center h-16">
            <div class="flex items-center gap-4">
              <button
                type="button"
                onClick={handleClose}
                class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                ← Back to Practice
              </button>
              <h1 class="text-xl font-bold text-gray-900 dark:text-white">
                Tune Details
              </h1>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Show
          when={!tune.loading}
          fallback={
            <div class="text-center py-12">
              <div class="animate-spin h-12 w-12 mx-auto border-4 border-blue-600 border-t-transparent rounded-full" />
              <p class="mt-4 text-gray-600 dark:text-gray-400">
                Loading tune...
              </p>
            </div>
          }
        >
          <Show
            when={tune()}
            fallback={
              <div class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  Tune Not Found
                </h2>
                <p class="text-gray-600 dark:text-gray-400 mb-6">
                  The tune you're looking for doesn't exist or has been deleted.
                </p>
                <button
                  type="button"
                  onClick={handleClose}
                  class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                >
                  Back to Practice
                </button>
              </div>
            }
          >
            {(t) => (
              <TuneDetail
                tune={t()}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onClose={handleClose}
                showEditButton={true}
                showDeleteButton={true}
              />
            )}
          </Show>
        </Show>
      </main>
    </div>
  );
};

export default TuneDetailsPage;
