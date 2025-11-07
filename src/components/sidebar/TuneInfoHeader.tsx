/**
 * Tune Info Header Component
 *
 * Displays current tune information at the top of the sidebar.
 * Shows tune title, type, mode, and basic metadata.
 *
 * @module components/sidebar/TuneInfoHeader
 */

import { Music, Settings2, Tag } from "lucide-solid";
import { type Component, createResource, Show } from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCurrentTune } from "@/lib/context/CurrentTuneContext";
import { getTuneById } from "@/lib/db/queries/tunes";

/**
 * TuneInfoHeader - Display current tune information
 *
 * Features:
 * - Tune title with icon
 * - Type and Mode badges
 * - Structure information
 * - Loading and empty states
 */
export const TuneInfoHeader: Component = () => {
  const { currentTuneId } = useCurrentTune();
  const { localDb } = useAuth();

  // Load current tune data
  const [tune] = createResource(
    () => ({ tuneId: currentTuneId(), db: localDb() }),
    async (params) => {
      if (!params.tuneId || !params.db) return null;
      return await getTuneById(params.db, params.tuneId);
    },
  );

  return (
    <div class="tune-info-header border-b border-gray-200/30 dark:border-gray-700/30 pb-2 mb-2">
      {/* No tune selected */}
      <Show when={!currentTuneId()}>
        <div class="text-center py-4 text-gray-500 dark:text-gray-400">
          <Music class="w-6 h-6 mx-auto mb-2 opacity-40" />
          <p class="text-xs italic">No tune selected</p>
          <p class="text-[10px] mt-0.5">Click a tune to view details</p>
        </div>
      </Show>

      {/* Loading state */}
      <Show when={currentTuneId() && tune.loading}>
        <div class="text-center py-3">
          <div class="animate-spin h-5 w-5 mx-auto border-2 border-blue-600 border-t-transparent rounded-full" />
          <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">
            Loading...
          </p>
        </div>
      </Show>

      {/* Tune information */}
      <Show when={tune() && !tune.loading}>
        <div class="space-y-1.5">
          {/* Title */}
          <div class="flex items-start gap-1.5">
            <Music class="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white leading-tight break-words">
              {tune()!.title}
            </h3>
          </div>

          {/* Type and Mode */}
          <div class="flex flex-wrap gap-1.5 pl-5">
            <Show when={tune()!.type}>
              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100/60 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border border-blue-200/30 dark:border-blue-700/30">
                <Tag class="w-2.5 h-2.5" />
                {tune()!.type}
              </span>
            </Show>

            <Show when={tune()!.mode}>
              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100/60 dark:bg-green-900/40 text-green-800 dark:text-green-200 border border-green-200/30 dark:border-green-700/30">
                <Settings2 class="w-2.5 h-2.5" />
                {tune()!.mode}
              </span>
            </Show>
          </div>

          {/* Structure */}
          <Show when={tune()!.structure}>
            <div class="pl-5">
              <p class="text-[10px] text-gray-600 dark:text-gray-400">
                <span class="font-medium">Structure:</span> {tune()!.structure}
              </p>
            </div>
          </Show>

          {/* Genre */}
          <Show when={tune()!.genre}>
            <div class="pl-5">
              <p class="text-[10px] text-gray-600 dark:text-gray-400">
                <span class="font-medium">Genre:</span> {tune()!.genre}
              </p>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};
