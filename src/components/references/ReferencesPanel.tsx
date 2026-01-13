/**
 * ReferencesPanel Component
 *
 * Sidebar panel for managing tune references.
 * Displays references for the current tune, allows add/edit/delete operations.
 * Supports drag-and-drop reordering.
 *
 * @module components/references/ReferencesPanel
 */

import { Link, Plus } from "lucide-solid";
import { type Component, createResource, createSignal, Show } from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCurrentTune } from "@/lib/context/CurrentTuneContext";
import {
  getSidebarFontClasses,
  useUIPreferences,
} from "@/lib/context/UIPreferencesContext";
import { getDb } from "@/lib/db/client-sqlite";
import {
  type CreateReferenceData,
  createReference,
  deleteReference,
  getReferencesByTune,
  type Reference,
  updateReference,
  updateReferenceOrder,
} from "@/lib/db/queries/references";
import { ReferenceForm, type ReferenceFormData } from "./ReferenceForm";
import { ReferenceList } from "./ReferenceList";

export const ReferencesPanel: Component = () => {
  const { currentTuneId } = useCurrentTune();
  const { user } = useAuth();
  const { sidebarFontSize } = useUIPreferences();

  // Get dynamic font classes
  const fontClasses = () => getSidebarFontClasses(sidebarFontSize());

  const [isAdding, setIsAdding] = createSignal(false);
  const [editingReference, setEditingReference] =
    createSignal<Reference | null>(null);

  // Load references for current tune
  const [references, { refetch }] = createResource(
    () => ({ tuneId: currentTuneId(), userId: user()?.id }),
    async (params) => {
      if (!params.tuneId || !params.userId) return [];
      const db = getDb();
      return await getReferencesByTune(db, params.tuneId, params.userId);
    }
  );

  // Handle creating a new reference
  const handleCreateReference = async (data: ReferenceFormData) => {
    const tuneId = currentTuneId();
    const currentUser = user();

    if (!tuneId || !currentUser?.id) return;

    try {
      const db = getDb();
      const createData: CreateReferenceData = {
        url: data.url,
        tuneRef: tuneId,
        title: data.title || undefined,
        refType: data.refType,
        comment: data.comment || undefined,
        favorite: data.favorite,
        public: false, // Default to private
      };

      await createReference(db, createData, currentUser.id);

      // Reset form
      setIsAdding(false);

      // Reload references
      refetch();
    } catch (error) {
      console.error("Failed to create reference:", error);
      // TODO: Show error toast
    }
  };

  // Handle updating a reference
  const handleUpdateReference = async (data: ReferenceFormData) => {
    const refToEdit = editingReference();
    if (!refToEdit) return;

    try {
      const db = getDb();
      await updateReference(db, refToEdit.id, {
        url: data.url,
        title: data.title || undefined,
        refType: data.refType,
        comment: data.comment || undefined,
        favorite: data.favorite,
      });

      // Reset form
      setEditingReference(null);

      // Reload references
      refetch();
    } catch (error) {
      console.error("Failed to update reference:", error);
      // TODO: Show error toast
    }
  };

  // Handle deleting a reference
  const handleDeleteReference = async (referenceId: string) => {
    if (!confirm("Delete this reference?")) return;

    try {
      const db = getDb();
      await deleteReference(db, referenceId);

      // Reload references
      refetch();
    } catch (error) {
      console.error("Failed to delete reference:", error);
      // TODO: Show error toast
    }
  };

  // Handle reordering references
  const handleReorderReferences = async (referenceIds: string[]) => {
    try {
      const db = getDb();
      await updateReferenceOrder(db, referenceIds);

      // Reload references
      refetch();
    } catch (error) {
      console.error("Failed to reorder references:", error);
      // TODO: Show error toast
    }
  };

  // Handle edit button click
  const handleEditClick = (reference: Reference) => {
    setEditingReference(reference);
    setIsAdding(false); // Close add form if open
  };

  // Handle cancel
  const handleCancel = () => {
    setIsAdding(false);
    setEditingReference(null);
  };

  return (
    <div class="references-panel" data-testid="references-panel">
      {/* Header with icon and Add Reference button */}
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-1.5">
          <Link class={`${fontClasses().iconSmall} text-gray-600 dark:text-gray-400`} />
          <h4
            class={`${fontClasses().text} font-medium text-gray-700 dark:text-gray-300`}
            data-testid="references-count"
          >
            {references()?.length || 0}{" "}
            {references()?.length === 1 ? "reference" : "references"}
          </h4>
        </div>
        <Show when={currentTuneId() && !isAdding() && !editingReference()}>
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            class={`inline-flex items-center gap-1 ${fontClasses().textSmall} px-1.5 py-0.5 text-green-600 dark:text-green-400 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm transition-colors border border-gray-200/50 dark:border-gray-700/50`}
            title="Add new reference"
            data-testid="references-add-button"
          >
            Add
            <Plus class={fontClasses().iconSmall} />
          </button>
        </Show>
      </div>

      {/* Add reference form */}
      <Show when={isAdding()}>
        <div
          class="mb-3 p-2 bg-gray-50/50 dark:bg-gray-800/50 rounded border border-gray-200/30 dark:border-gray-700/30"
          data-testid="references-add-form"
        >
          <h5 class={`${fontClasses().text} font-semibold text-gray-700 dark:text-gray-300 mb-2`}>
            Add New Reference
          </h5>
          <ReferenceForm
            onSubmit={handleCreateReference}
            onCancel={handleCancel}
          />
        </div>
      </Show>

      {/* Edit reference form */}
      <Show when={editingReference()}>
        {(ref) => (
          <div
            class="mb-3 p-2 bg-gray-50/50 dark:bg-gray-800/50 rounded border border-gray-200/30 dark:border-gray-700/30"
            data-testid="references-edit-form"
          >
            <h5 class={`${fontClasses().text} font-semibold text-gray-700 dark:text-gray-300 mb-2`}>
              Edit Reference
            </h5>
            <ReferenceForm
              reference={ref()}
              onSubmit={handleUpdateReference}
              onCancel={handleCancel}
            />
          </div>
        )}
      </Show>

      {/* No tune selected */}
      <Show when={!currentTuneId()}>
        <p
          class={`${fontClasses().text} italic text-gray-500 dark:text-gray-400`}
          data-testid="references-no-tune-message"
        >
          Select a tune to view references
        </p>
      </Show>

      {/* Loading state */}
      <Show when={references.loading}>
        <p
          class={`${fontClasses().text} text-gray-500 dark:text-gray-400`}
          data-testid="references-loading"
        >
          Loading references...
        </p>
      </Show>

      {/* References list */}
      <Show when={!isAdding() && !editingReference()}>
        <ReferenceList
          references={references() || []}
          onEdit={handleEditClick}
          onDelete={handleDeleteReference}
          onReorder={handleReorderReferences}
          showActions={true}
          groupByType={false}
        />
      </Show>
    </div>
  );
};
