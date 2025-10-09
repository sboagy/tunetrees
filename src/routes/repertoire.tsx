/**
 * Repertoire Page
 *
 * Displays the user's repertoire (tunes they're actively practicing).
 * Shows tune table with practice status and "Add To Review" functionality.
 *
 * Port from: legacy/frontend/app/(main)/pages/practice/components/TunesGridRepertoire.tsx
 *
 * @module routes/repertoire
 */

import { useNavigate } from "@solidjs/router";
import { type Component, Show } from "solid-js";
import { TuneList } from "../components/tunes/TuneList";
import { useAuth } from "../lib/auth/AuthContext";
import type { Tune } from "../lib/db/types";

/**
 * Repertoire Page Component
 *
 * Features:
 * - Tune table (sortable, filterable)
 * - Shows practice status (due dates, stability, etc.)
 * - "Add To Review" button for bulk operations
 * - Multi-select for batch actions
 *
 * @example
 * ```tsx
 * <Route path="/repertoire" component={RepertoirePage} />
 * ```
 */
const RepertoirePage: Component = () => {
  const navigate = useNavigate();
  const { localDb } = useAuth();

  const handleTuneSelect = (tune: Tune) => {
    navigate(`/tunes/${tune.id}`);
  };

  const handleAddToReview = () => {
    // TODO: Implement "Add To Review" functionality
    // This should add selected tunes to the practice queue
    console.log("Add To Review clicked");
  };

  return (
    <div class="h-full flex flex-col">
      {/* Page Header */}
      <div class="mb-6">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
              📚 Repertoire
            </h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Tunes you're actively practicing with FSRS scheduling
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddToReview}
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm hover:shadow-md flex items-center gap-2"
          >
            <span>➕</span>
            <span>Add To Review</span>
          </button>
        </div>
      </div>

      {/* Tune Table */}
      <div class="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <Show
          when={localDb()}
          fallback={
            <div class="flex items-center justify-center h-64">
              <p class="text-gray-600 dark:text-gray-400">
                Initializing database...
              </p>
            </div>
          }
        >
          <TuneList onTuneSelect={handleTuneSelect} filterByPlaylist={true} />
        </Show>
      </div>
    </div>
  );
};

export default RepertoirePage;
