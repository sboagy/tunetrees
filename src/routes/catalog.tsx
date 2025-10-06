/**
 * Catalog Page
 *
 * Complete database of all tunes (not just repertoire).
 * Provides full CRUD operations and search/filter functionality.
 *
 * Port from: legacy/frontend/app/(main)/pages/practice/components/TunesGridAll.tsx
 *
 * @module routes/catalog
 */

import { useNavigate } from "@solidjs/router";
import { type Component, Show } from "solid-js";
import { TuneList } from "../components/tunes/TuneList";
import { useAuth } from "../lib/auth/AuthContext";
import type { Tune } from "../lib/db/types";

/**
 * Catalog Page Component
 *
 * Features:
 * - Complete tune database view
 * - Add/edit/delete tunes
 * - Search and filtering
 * - Bulk operations
 * - Import/export functionality
 *
 * @example
 * ```tsx
 * <Route path="/catalog" component={CatalogPage} />
 * ```
 */
const CatalogPage: Component = () => {
  const navigate = useNavigate();
  const { localDb } = useAuth();

  const handleTuneSelect = (tune: Tune) => {
    navigate(`/tunes/${tune.id}`);
  };

  const handleAddTune = () => {
    navigate("/tunes/new");
  };

  return (
    <div class="h-full flex flex-col">
      {/* Page Header */}
      <div class="mb-6">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
              📖 Catalog
            </h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Complete database of all tunes (not filtered by practice status)
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddTune}
            class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shadow-sm hover:shadow-md flex items-center gap-2"
          >
            <span>➕</span>
            <span>Add Tune</span>
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
          <TuneList onTuneSelect={handleTuneSelect} />
        </Show>
      </div>
    </div>
  );
};

export default CatalogPage;
