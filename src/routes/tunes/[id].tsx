/**
 * Tune Details Route
 *
 * Protected route for viewing tune details (read-only).
 * Shows tune information within MainLayout without tabs, matching EditTunePage layout.
 *
 * @module routes/tunes/[id]
 */

import { useLocation, useNavigate, useParams } from "@solidjs/router";
import { type Component, createMemo, createResource, Show } from "solid-js";
import type { TuneEditorData } from "../../components/tunes";
import { TuneEditor } from "../../components/tunes";
import { useAuth } from "../../lib/auth/AuthContext";
import { getTuneById } from "../../lib/db/queries/tunes";

/**
 * Tune Details Page Component
 *
 * Read-only view of tune using TuneEditor with readOnly flag.
 */
const TuneDetailsPage: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { localDb } = useAuth();

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

  const handleEdit = () => {
    const fullPath = location.pathname + location.search;
    navigate(`/tunes/${params.id}/edit`, {
      state: { from: fullPath },
    });
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
            readOnly={true}
            onEdit={handleEdit}
            onCancel={handleCancel}
          />
        )}
      </Show>
    </Show>
  );
};

export default TuneDetailsPage;
