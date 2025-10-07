/**
 * ReferencesPanel Component
 *
 * Sidebar panel for managing tune references.
 * Displays references for the current tune, allows add/edit/delete operations.
 *
 * @module components/references/ReferencesPanel
 */

import { type Component, createResource, createSignal, Show } from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCurrentTune } from "@/lib/context/CurrentTuneContext";
import { getDb } from "@/lib/db/client-sqlite";
import {
  type CreateReferenceData,
  createReference,
  deleteReference,
  getReferencesByTune,
  type Reference,
  updateReference,
} from "@/lib/db/queries/references";
import { ReferenceForm, type ReferenceFormData } from "./ReferenceForm";
import { ReferenceList } from "./ReferenceList";

export const ReferencesPanel: Component = () => {
  const { currentTuneId } = useCurrentTune();
  const { user } = useAuth();

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
  const handleDeleteReference = async (referenceId: number) => {
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
    <div class="references-panel">
      {/* Header with Add Reference button */}
      <div class="flex items-center justify-between mb-3">
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
          {references()?.length || 0}{" "}
          {references()?.length === 1 ? "reference" : "references"}
        </h4>
        <Show when={currentTuneId() && !isAdding() && !editingReference()}>
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            class="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            + Add Reference
          </button>
        </Show>
      </div>

      {/* Add reference form */}
      <Show when={isAdding()}>
        <div class="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h5 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
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
          <div class="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h5 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
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
        <p class="text-sm italic text-gray-500 dark:text-gray-400">
          Select a tune to view references
        </p>
      </Show>

      {/* Loading state */}
      <Show when={references.loading}>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Loading references...
        </p>
      </Show>

      {/* References list */}
      <Show when={!isAdding() && !editingReference()}>
        <ReferenceList
          references={references() || []}
          onEdit={handleEditClick}
          onDelete={handleDeleteReference}
          showActions={true}
          groupByType={false}
        />
      </Show>
    </div>
  );
};
