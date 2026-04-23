/**
 * Tune Info Header Component
 *
 * Displays current tune information at the top of the sidebar.
 * Shows tune title, type, mode, and basic metadata.
 *
 * @module components/sidebar/TuneInfoHeader
 */

import { useLocation, useNavigate } from "@solidjs/router";
import { History, Music, Pencil } from "lucide-solid";
import { type Component, createResource, Show } from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCurrentTune } from "@/lib/context/CurrentTuneContext";
import {
  getSidebarFontClasses,
  useUIPreferences,
} from "@/lib/context/UIPreferencesContext";
import { getTuneForUserById } from "@/lib/db/queries/tunes";

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
  const { localDb, userIdInt } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarFontSize } = useUIPreferences();

  // Get dynamic font classes
  const fontClasses = () => getSidebarFontClasses(sidebarFontSize());

  // Load current tune data
  const [tune] = createResource(
    () => ({ tuneId: currentTuneId(), db: localDb(), uid: userIdInt() }),
    async (params) => {
      if (!params.tuneId || !params.db) return null;
      // Prefer merged override view when user available; fall back to base tune
      if (params.uid) {
        return await getTuneForUserById(params.db, params.tuneId, params.uid);
      }
      const { getTuneById } = await import("@/lib/db/queries/tunes");
      return await getTuneById(params.db, params.tuneId);
    }
  );

  const handleEdit = () => {
    const tuneId = currentTuneId();
    if (tuneId) {
      const fullPath = location.pathname + location.search;
      navigate(`/tunes/${tuneId}/edit`, { state: { from: fullPath } });
    }
  };

  return (
    <div class="tune-info-header border-b border-gray-200/30 dark:border-gray-700/30 pb-2 mb-2">
      {/* No tune selected */}
      <Show when={!currentTuneId()}>
        <div class="text-center py-4 text-gray-500 dark:text-gray-400">
          <Music class="w-6 h-6 mx-auto mb-2 opacity-40" />
          <p class={`${fontClasses().text} italic`}>No tune selected</p>
          <p class={`${fontClasses().textSmall} mt-0.5`}>
            Click a tune to view details
          </p>
        </div>
      </Show>

      {/* Loading state */}
      <Show when={currentTuneId() && tune.loading}>
        <div class="text-center py-3">
          <div class="animate-spin h-5 w-5 mx-auto border-2 border-blue-600 border-t-transparent rounded-full" />
          <p
            class={`${fontClasses().textSmall} text-gray-500 dark:text-gray-400 mt-1.5`}
          >
            Loading...
          </p>
        </div>
      </Show>

      {/* Tune information */}
      <Show when={tune() && !tune.loading}>
        <div class="space-y-1.5">
          {/* Title with Edit Button */}
          <div class="flex items-start gap-1.5">
            <Music
              class={`${fontClasses().icon} text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5`}
            />
            <h3
              class={`${fontClasses().text} font-semibold text-gray-900 dark:text-white leading-tight break-words flex-1`}
            >
              {tune()!.title}
            </h3>
            <button
              type="button"
              onClick={handleEdit}
              class={`flex-shrink-0 flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors ${fontClasses().text} font-medium`}
              title="Edit tune"
              aria-label="Edit tune"
              data-testid="sidebar-edit-tune-button"
            >
              <span class="hidden sm:inline">Edit</span>
              <Pencil class={fontClasses().iconSmall} />
            </button>
          </div>

          {/* Inline ID directly under the title */}
          <div class="pl-5">
            <p
              class={`${fontClasses().textSmall} italic text-gray-500 dark:text-gray-400 select-text`}
              data-testid="tune-id-inline"
            >
              ID: {tune()!.id}
            </p>
          </div>

          {/* Practice History Button */}
          <div class="pl-5">
            <button
              type="button"
              onClick={() => {
                const fullPath = location.pathname + location.search;
                navigate(`/tunes/${tune()!.id}/practice-history`, {
                  state: { from: fullPath },
                });
              }}
              class={`inline-flex items-center gap-2 rounded-md border border-blue-300 px-3 py-1.5 ${fontClasses().textSmall} font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:border-blue-600 dark:text-blue-400 dark:hover:bg-blue-900/20 dark:hover:text-blue-300`}
              data-testid="sidebar-practice-history-link"
            >
              <History class={fontClasses().iconSmall} />
              Practice History
            </button>
          </div>

          {/* Type and Mode */}
          <div class="pl-5 space-y-1">
            <Show when={tune()!.type}>
              <p
                class={`${fontClasses().textSmall} text-gray-600 dark:text-gray-400`}
              >
                <span class="font-medium">Type:</span> {tune()!.type}
              </p>
            </Show>

            <Show when={tune()!.mode}>
              <p
                class={`${fontClasses().textSmall} text-gray-600 dark:text-gray-400`}
              >
                <span class="font-medium">Mode:</span> {tune()!.mode}
              </p>
            </Show>
          </div>

          {/* Structure */}
          <Show when={tune()!.structure}>
            <div class="pl-5">
              <p
                class={`${fontClasses().textSmall} text-gray-600 dark:text-gray-400`}
              >
                <span class="font-medium">Structure:</span> {tune()!.structure}
              </p>
            </div>
          </Show>

          {/* Genre */}
          <Show when={tune()!.genre}>
            <div class="pl-5">
              <p
                class={`${fontClasses().textSmall} text-gray-600 dark:text-gray-400`}
              >
                <span class="font-medium">Genre:</span> {tune()!.genre}
              </p>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};
