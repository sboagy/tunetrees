/**
 * Repertoire Editor Dialog Component
 *
 * Modal dialog for creating and editing repertoires.
 * Wraps RepertoireEditor in a modal overlay to avoid route navigation.
 *
 * Features:
 * - Modal overlay with backdrop
 * - Create or edit mode
 * - Save and Cancel buttons at top
 * - Close via X button, backdrop click, or Escape key
 * - Dark mode support
 *
 * @module components/repertoires/RepertoireEditorDialog
 */

import { CircleX, Save } from "lucide-solid";
import type { Component } from "solid-js";
import {
  createResource,
  createSignal,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";
import {
  createRepertoire,
  getRepertoireById,
  updateRepertoire,
} from "../../lib/db/queries/repertoires";
import type { Playlist } from "../../lib/db/types";
import { RepertoireEditor } from "./RepertoireEditor";

interface RepertoireEditorDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Repertoire ID to edit (undefined for new repertoire) */
  repertoireId?: string;
  /** Callback after successful save */
  onSaved?: () => void;
}

/**
 * Repertoire Editor Dialog Component
 *
 * @example
 * ```tsx
 * <RepertoireEditorDialog
 *   isOpen={showEditor()}
 *   onClose={() => setShowEditor(false)}
 *   repertoireId={selectedRepertoireId()}
 *   onSaved={() => refetchRepertoires()}
 * />
 * ```
 */
export const RepertoireEditorDialog: Component<RepertoireEditorDialogProps> = (
  props
) => {
  const { user, localDb } = useAuth();

  // Fetch repertoire data if editing
  const [repertoire] = createResource(
    () => {
      const userId = user()?.id;
      const db = localDb();
      const repertoireId = props.repertoireId;
      const isOpen = props.isOpen; // Track dialog open state
      return userId && db && repertoireId && isOpen
        ? { userId, db, playlistId: repertoireId }
        : null;
    },
    async (params) => {
      if (!params) return null;
      const result = await getRepertoireById(
        params.db,
        params.playlistId,
        params.userId
      );
      return result;
    }
  );

  // Refs to form data and validation functions
  let getFormData: (() => Partial<Playlist> | null) | undefined;
  let setError: ((error: string | null) => void) | undefined;

  const [isSaving, setIsSaving] = createSignal(false);

  // Handle Escape key to close dialog
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && props.isOpen && !isSaving()) {
        props.onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const handleSave = async () => {
    const userId = user()?.id;
    const db = localDb();

    if (!userId || !db) {
      console.error("Cannot save repertoire: missing user or database");
      setError?.("Error: User not authenticated or database not available");
      return;
    }

    // Get form data from RepertoireEditor
    const repertoireData = getFormData?.();
    if (!repertoireData) {
      // Validation failed, error already shown in form
      return;
    }

    setIsSaving(true);
    setError?.(null); // Clear any previous errors

    try {
      if (props.repertoireId) {
        // Update existing repertoire
        await updateRepertoire(db, props.repertoireId, userId, repertoireData);
      } else {
        // Create new repertoire
        await createRepertoire(db, userId, {
          name: repertoireData.name ?? "Untitled Repertoire",
          genreDefault: repertoireData.genreDefault ?? null,
          instrumentRef: repertoireData.instrumentRef ?? null,
          srAlgType: repertoireData.srAlgType ?? "fsrs",
        });
      }

      // Notify parent and close dialog
      props.onSaved?.();
      props.onClose();
    } catch (error) {
      console.error("Failed to save repertoire:", error);
      setError?.("Failed to save repertoire. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Show when={props.isOpen}>
      {/* Backdrop - higher z-index to appear over manager dialog */}
      <button
        type="button"
        class="fixed inset-0 z-[60] bg-black/50 dark:bg-black/70 cursor-default"
        onClick={props.onClose}
        aria-label="Close modal backdrop"
        data-testid="repertoire-editor-backdrop"
      />

      {/* Dialog - higher z-index to appear over manager dialog */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Dialog is modal and has backdrop for closing */}
      <div
        class="fixed left-1/2 top-1/2 z-[70] w-[95vw] max-w-2xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 transform rounded-lg bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="repertoire-editor-title"
        onClick={(e) => e.stopPropagation()}
        data-testid="repertoire-editor-dialog"
      >
        {/* Header */}
        <div class="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <h2
            id="repertoire-editor-title"
            class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white"
          >
            {props.repertoireId ? "Edit Repertoire" : "Create New Repertoire"}
          </h2>
          <div class="flex items-center gap-4">
            <button
              type="button"
              onClick={props.onClose}
              disabled={isSaving()}
              class="text-gray-700 dark:text-gray-300 hover:underline text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Cancel and close dialog"
              data-testid="cancel-repertoire-button"
            >
              <div class="flex items-center gap-2">
                <span>Cancel</span>
                <CircleX size={20} />
              </div>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving()}
              class="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              aria-label="Save repertoire"
              data-testid="save-repertoire-button"
            >
              <Show
                when={isSaving()}
                fallback={
                  <>
                    Save <Save size={24} />
                  </>
                }
              >
                <div class="animate-spin h-4 w-4 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full" />
                Saving...
              </Show>
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div class="flex-1 overflow-y-auto p-4 sm:p-6">
          <Show
            when={!props.repertoireId || !repertoire.loading}
            fallback={
              <div class="flex items-center justify-center py-12">
                <div class="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full" />
              </div>
            }
          >
            <RepertoireEditor
              repertoire={repertoire() ?? undefined}
              onGetFormData={(getter) => {
                getFormData = getter;
              }}
              onSetError={(setter) => {
                setError = setter;
              }}
            />
          </Show>
        </div>
      </div>
    </Show>
  );
};
