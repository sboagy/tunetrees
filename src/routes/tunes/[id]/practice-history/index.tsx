/**
 * Practice History Route
 *
 * Displays and allows editing of practice records for a tune.
 * Uses an editable TanStack Solid Table grid.
 *
 * @module routes/tunes/[id]/practice-history
 */

import { useLocation, useNavigate, useParams } from "@solidjs/router";
import { CircleX, Plus, Save, Trash2, X } from "lucide-solid";
import {
  type Component,
  createMemo,
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCurrentPlaylist } from "@/lib/context/CurrentPlaylistContext";
import {
  createPracticeRecord,
  deletePracticeRecord,
  getPracticeRecordsForTune,
  updatePracticeRecord,
} from "@/lib/db/queries/practice-records";
import { getTuneForUserById } from "@/lib/db/queries/tunes";
import type { PracticeRecord } from "@/lib/db/types";

/**
 * Practice History Page Component
 *
 * Shows all practice records for a tune with inline editing.
 */
const PracticeHistoryPage: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { localDb, userIdInt } = useAuth();
  const { currentPlaylistId } = useCurrentPlaylist();

  // Track edits
  const [editedRecords, setEditedRecords] = createSignal<
    Map<string, Partial<PracticeRecord>>
  >(new Map());
  const [deletedIds, setDeletedIds] = createSignal<Set<string>>(new Set());
  const [isSaving, setIsSaving] = createSignal(false);

  // Return path for navigation
  const returnPath = createMemo(() => {
    const state = location.state as any;
    return state?.from || `/tunes/${params.id}/edit`;
  });

  // Fetch tune data
  const [tune] = createResource(
    () => {
      const db = localDb();
      const tuneId = params.id;
      const uid = userIdInt();
      return db && tuneId && uid ? { db, tuneId, uid } : null;
    },
    async (params) => {
      if (!params) return null;
      return await getTuneForUserById(params.db, params.tuneId, params.uid);
    }
  );

  // Fetch practice records
  const [practiceRecords, { refetch }] = createResource(
    () => {
      const db = localDb();
      const tuneId = params.id;
      const playlistId = currentPlaylistId();
      return db && tuneId && playlistId ? { db, tuneId, playlistId } : null;
    },
    async (params) => {
      if (!params) return [];
      return await getPracticeRecordsForTune(
        params.db,
        params.tuneId,
        params.playlistId
      );
    }
  );

  // Check if there are unsaved changes
  const hasChanges = createMemo(
    () => editedRecords().size > 0 || deletedIds().size > 0
  );

  // Get display value for a field (edited or original)
  const getFieldValue = (
    record: PracticeRecord,
    field: keyof PracticeRecord
  ) => {
    const edited = editedRecords().get(record.id);
    if (edited && field in edited) {
      return edited[field];
    }
    return record[field];
  };

  // Update a field value
  const updateField = (
    recordId: string,
    field: keyof PracticeRecord,
    value: unknown
  ) => {
    setEditedRecords((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(recordId) || {};
      newMap.set(recordId, { ...existing, [field]: value });
      return newMap;
    });
  };

  // Mark a record for deletion
  const markForDeletion = (recordId: string) => {
    setDeletedIds((prev) => {
      const newSet = new Set(prev);
      newSet.add(recordId);
      return newSet;
    });
  };

  // Restore a deleted record
  const restoreRecord = (recordId: string) => {
    setDeletedIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(recordId);
      return newSet;
    });
  };

  // Save all changes
  const handleSave = async () => {
    const db = localDb();
    const playlistId = currentPlaylistId();
    if (!db || !playlistId) return;

    setIsSaving(true);
    try {
      // Delete marked records
      for (const id of deletedIds()) {
        await deletePracticeRecord(db, id);
      }

      // Update edited records
      for (const [id, changes] of editedRecords()) {
        if (!deletedIds().has(id)) {
          await updatePracticeRecord(db, id, changes);
        }
      }

      // Clear state and refetch
      setEditedRecords(new Map());
      setDeletedIds(new Set<string>());
      await refetch();
    } catch (error) {
      console.error("Error saving practice records:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Discard all changes
  const handleDiscard = () => {
    setEditedRecords(new Map());
    setDeletedIds(new Set<string>());
  };

  // Add new practice record
  const handleAddRecord = async () => {
    const db = localDb();
    const playlistId = currentPlaylistId();
    const tuneId = params.id;
    if (!db || !playlistId || !tuneId) return;

    try {
      await createPracticeRecord(db, playlistId, tuneId, {
        practiced: new Date().toISOString(),
        quality: 3,
      });
      await refetch();
    } catch (error) {
      console.error("Error creating practice record:", error);
    }
  };

  // Navigate back
  const handleBack = () => {
    navigate(returnPath());
  };

  // Format date for input
  const formatDateForInput = (dateStr: string | null | undefined) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return date.toISOString().slice(0, 16);
    } catch {
      return "";
    }
  };

  return (
    <div
      class="h-full flex flex-col bg-gray-50 dark:bg-gray-900 overflow-y-auto"
      data-testid="practice-history-container"
    >
      <div class="max-w-6xl py-4 px-4 w-full">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          {/* Header */}
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              Practice History
              <Show when={tune()}>
                <span class="text-gray-500 dark:text-gray-400 font-normal">
                  {" "}
                  — {tune()!.title}
                </span>
              </Show>
            </h2>

            <div class="flex items-center gap-3">
              <Show when={hasChanges()}>
                <button
                  type="button"
                  onClick={handleDiscard}
                  disabled={isSaving()}
                  class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:underline disabled:opacity-50"
                  data-testid="practice-history-discard-button"
                >
                  <span>Discard</span>
                  <X class="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving()}
                  class="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                  data-testid="practice-history-save-button"
                >
                  <span>Save</span>
                  <Save class="w-4 h-4" />
                </button>
              </Show>
              <button
                type="button"
                onClick={handleBack}
                class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:underline"
                aria-label="Cancel"
                data-testid="practice-history-cancel-button"
              >
                <span>Cancel</span>
                <CircleX class="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleAddRecord}
                class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:underline"
                aria-label="Add practice record"
                data-testid="practice-history-add-button"
              >
                <span>Add</span>
                <Plus class="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div class="p-6">
            <Show
              when={!practiceRecords.loading}
              fallback={
                <div class="text-center py-8">
                  <div class="animate-spin h-8 w-8 mx-auto border-4 border-blue-600 border-t-transparent rounded-full" />
                  <p class="mt-4 text-gray-600 dark:text-gray-400">
                    Loading practice history...
                  </p>
                </div>
              }
            >
              <Show
                when={practiceRecords() && practiceRecords()!.length > 0}
                fallback={
                  <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                    <p>No practice records found for this tune.</p>
                    <p class="text-sm mt-2">
                      Click "Add Record" to create your first practice entry.
                    </p>
                  </div>
                }
              >
                {/* Practice Records Table */}
                <div class="overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="border-b border-gray-200 dark:border-gray-700">
                        <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                          Date Practiced
                        </th>
                        <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                          Quality (0-5)
                        </th>
                        <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                          Due Date
                        </th>
                        <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                          Stability
                        </th>
                        <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                          Difficulty
                        </th>
                        <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                          Reps
                        </th>
                        <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                          Lapses
                        </th>
                        <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                          State
                        </th>
                        <th class="px-3 py-2 text-center font-medium text-gray-700 dark:text-gray-300">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={practiceRecords()}>
                        {(record) => (
                          <tr
                            class={`border-b border-gray-100 dark:border-gray-700/50 ${
                              deletedIds().has(record.id)
                                ? "opacity-50 bg-red-50 dark:bg-red-900/20 line-through"
                                : editedRecords().has(record.id)
                                  ? "bg-yellow-50 dark:bg-yellow-900/20"
                                  : ""
                            }`}
                          >
                            {/* Date Practiced - Editable */}
                            <td class="px-3 py-2">
                              <input
                                type="datetime-local"
                                value={formatDateForInput(
                                  getFieldValue(record, "practiced") as string
                                )}
                                onInput={(e) =>
                                  updateField(
                                    record.id,
                                    "practiced",
                                    e.currentTarget.value
                                      ? new Date(
                                          e.currentTarget.value
                                        ).toISOString()
                                      : null
                                  )
                                }
                                disabled={deletedIds().has(record.id)}
                                class="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs dark:bg-gray-700 dark:text-white disabled:opacity-50"
                              />
                            </td>

                            {/* Quality - Editable */}
                            <td class="px-3 py-2">
                              <select
                                value={
                                  (getFieldValue(
                                    record,
                                    "quality"
                                  ) as number) ?? ""
                                }
                                onChange={(e) =>
                                  updateField(
                                    record.id,
                                    "quality",
                                    e.currentTarget.value
                                      ? Number(e.currentTarget.value)
                                      : null
                                  )
                                }
                                disabled={deletedIds().has(record.id)}
                                class="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs dark:bg-gray-700 dark:text-white disabled:opacity-50"
                              >
                                <option value="">—</option>
                                <option value="0">0 - Complete blackout</option>
                                <option value="1">
                                  1 - Incorrect, remembered
                                </option>
                                <option value="2">
                                  2 - Incorrect, easy recall
                                </option>
                                <option value="3">
                                  3 - Correct, difficult
                                </option>
                                <option value="4">
                                  4 - Correct, hesitation
                                </option>
                                <option value="5">5 - Perfect response</option>
                              </select>
                            </td>

                            {/* Due Date - Editable */}
                            <td class="px-3 py-2">
                              <input
                                type="datetime-local"
                                value={formatDateForInput(
                                  getFieldValue(record, "due") as string
                                )}
                                onInput={(e) =>
                                  updateField(
                                    record.id,
                                    "due",
                                    e.currentTarget.value
                                      ? new Date(
                                          e.currentTarget.value
                                        ).toISOString()
                                      : null
                                  )
                                }
                                disabled={deletedIds().has(record.id)}
                                class="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs dark:bg-gray-700 dark:text-white disabled:opacity-50"
                              />
                            </td>

                            {/* Stability - Read-only */}
                            <td class="px-3 py-2 text-gray-600 dark:text-gray-400">
                              {record.stability?.toFixed(2) ?? "—"}
                            </td>

                            {/* Difficulty - Read-only */}
                            <td class="px-3 py-2 text-gray-600 dark:text-gray-400">
                              {record.difficulty?.toFixed(2) ?? "—"}
                            </td>

                            {/* Reps - Read-only */}
                            <td class="px-3 py-2 text-gray-600 dark:text-gray-400">
                              {record.repetitions ?? "—"}
                            </td>

                            {/* Lapses - Read-only */}
                            <td class="px-3 py-2 text-gray-600 dark:text-gray-400">
                              {record.lapses ?? "—"}
                            </td>

                            {/* State - Read-only */}
                            <td class="px-3 py-2 text-gray-600 dark:text-gray-400">
                              {record.state === 0
                                ? "New"
                                : record.state === 1
                                  ? "Learning"
                                  : record.state === 2
                                    ? "Review"
                                    : record.state === 3
                                      ? "Relearning"
                                      : "—"}
                            </td>

                            {/* Actions */}
                            <td class="px-3 py-2 text-center">
                              <Show
                                when={!deletedIds().has(record.id)}
                                fallback={
                                  <button
                                    type="button"
                                    onClick={() => restoreRecord(record.id)}
                                    class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 text-xs"
                                  >
                                    Restore
                                  </button>
                                }
                              >
                                <button
                                  type="button"
                                  onClick={() => markForDeletion(record.id)}
                                  class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                                  title="Delete record"
                                >
                                  <Trash2 class="w-4 h-4" />
                                </button>
                              </Show>
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Show>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticeHistoryPage;
