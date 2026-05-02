import { CircleX, Save } from "lucide-solid";
import type { Component } from "solid-js";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
  Show,
} from "solid-js";
import { toast } from "solid-sonner";
import { TunePickerDialog } from "@/components/tune-sets/TunePickerDialog";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCurrentTuneSet } from "@/lib/context/CurrentTuneSetContext";
import {
  addTunesToTuneSet,
  createTuneSet,
  getTuneSetAccessForUser,
  getTuneSetById,
  getTuneSetItems,
  removeTuneFromTuneSet,
  type TuneSetItemWithTune,
  type TuneSetKind,
  updateTuneSet,
} from "@/lib/db/queries/tune-sets";
import { getTunesForUser } from "@/lib/db/queries/tunes";
import type { Tune } from "@/lib/db/types";

interface TuneSetEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tuneSetId?: string;
  onSaved?: () => void;
  setKind?: TuneSetKind;
  groupRef?: string | null;
  label?: string;
}

export const TuneSetEditorDialog: Component<TuneSetEditorDialogProps> = (
  props
) => {
  const { user, localDb } = useAuth();
  const { incrementTuneSetListChanged, tuneSetListChanged } =
    useCurrentTuneSet();
  const entityLabel = () => props.label ?? "Tune Set";
  const [name, setName] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [isSaving, setIsSaving] = createSignal(false);
  const [removingTuneId, setRemovingTuneId] = createSignal<string | null>(null);
  const [showTunePicker, setShowTunePicker] = createSignal(false);
  const [isAddingTunes, setIsAddingTunes] = createSignal(false);
  const [addTunesError, setAddTunesError] = createSignal<string | null>(null);

  const showDialogError = (message: string, description?: string) => {
    toast.error(message, {
      description,
      duration: Infinity,
    });
  };

  const [tuneSetAccess] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      return db && userId && props.tuneSetId && props.isOpen
        ? { db, userId, tuneSetId: props.tuneSetId }
        : null;
    },
    async (params) => {
      if (!params) return null;
      return getTuneSetAccessForUser(
        params.db,
        params.tuneSetId,
        params.userId
      );
    }
  );

  const [tuneSet] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      return db && userId && props.tuneSetId && props.isOpen
        ? { db, userId, tuneSetId: props.tuneSetId }
        : null;
    },
    async (params) => {
      if (!params) return null;
      return getTuneSetById(params.db, params.tuneSetId, params.userId);
    }
  );

  const [tuneSetItems] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const version = tuneSetListChanged();
      return db && userId && props.tuneSetId && props.isOpen
        ? {
            db,
            userId,
            tuneSetId: props.tuneSetId,
            version,
          }
        : null;
    },
    async (params) => {
      if (!params) return [];
      return getTuneSetItems(params.db, params.tuneSetId, params.userId);
    }
  );

  const [availableTunes] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      return db && userId && props.isOpen ? { db, userId } : null;
    },
    async (params): Promise<Tune[]> => {
      if (!params) return [];
      return getTunesForUser(params.db, params.userId);
    }
  );

  createEffect(() => {
    if (!props.isOpen) {
      setName("");
      setDescription("");
      setShowTunePicker(false);
      setAddTunesError(null);
      return;
    }

    const current = tuneSet();
    if (props.tuneSetId) {
      setName(current?.name ?? "");
      setDescription(current?.description ?? "");
      return;
    }

    setName("");
    setDescription("");
  });

  const canManage = createMemo(() => {
    if (!props.tuneSetId) {
      return true;
    }

    return tuneSetAccess()?.canManage ?? false;
  });

  const dialogTitle = createMemo(() => {
    if (!props.tuneSetId) {
      return `Create ${entityLabel()}`;
    }

    return canManage() ? `Edit ${entityLabel()}` : `View ${entityLabel()}`;
  });

  const existingTuneIds = createMemo(() =>
    (tuneSetItems() ?? []).map((item) => item.tuneRef)
  );

  const canOnlyUsePublicTunes = createMemo(() => {
    return tuneSet()?.groupRef != null;
  });

  const addableTunes = createMemo(() => {
    const tunes = availableTunes() ?? [];
    if (!canOnlyUsePublicTunes()) {
      return tunes;
    }

    return tunes.filter((tune) => !tune.privateFor);
  });

  createEffect(() => {
    if (!props.isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving()) {
        props.onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const handleSave = async () => {
    const db = localDb();
    const userId = user()?.id;
    if (!db || !userId) {
      showDialogError("Database is not ready yet.");
      return;
    }

    setIsSaving(true);
    try {
      if (props.tuneSetId) {
        await updateTuneSet(db, props.tuneSetId, userId, {
          name: name(),
          description: description(),
        });
      } else {
        await createTuneSet(db, userId, {
          name: name(),
          description: description(),
          setKind: props.setKind ?? "practice_set",
          groupRef: props.groupRef ?? null,
        });
      }

      incrementTuneSetListChanged();
      props.onSaved?.();
      props.onClose();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : `Failed to save ${entityLabel().toLowerCase()}`;

      showDialogError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveTune = async (item: TuneSetItemWithTune) => {
    const db = localDb();
    const userId = user()?.id;
    if (!db || !userId || !props.tuneSetId) {
      showDialogError("Database is not ready yet.");
      return;
    }

    try {
      setRemovingTuneId(item.tuneRef);
      await removeTuneFromTuneSet(db, props.tuneSetId, item.tuneRef, userId);
      incrementTuneSetListChanged();
      toast.success(`Removed "${item.tune.title}" from this set.`, {
        duration: 2500,
      });
    } catch (removeError) {
      showDialogError(
        removeError instanceof Error
          ? removeError.message
          : "Failed to remove tune from set"
      );
    } finally {
      setRemovingTuneId(null);
    }
  };

  const handleAddSelectedTunes = async (tuneIds: string[]) => {
    const db = localDb();
    const userId = user()?.id;
    if (!db || !userId || !props.tuneSetId) {
      setAddTunesError("Database is not ready yet.");
      return;
    }

    try {
      setIsAddingTunes(true);
      setAddTunesError(null);

      const result = await addTunesToTuneSet(
        db,
        props.tuneSetId,
        tuneIds,
        userId
      );

      incrementTuneSetListChanged();
      props.onSaved?.();

      if (result.added > 0) {
        toast.success(
          `Added ${result.added} tune${result.added === 1 ? "" : "s"} to this ${entityLabel().toLowerCase()}.`,
          { duration: 2500 }
        );
      } else {
        toast("Those tunes are already in this selection.", { duration: 2500 });
      }

      if (result.skipped > 0 && result.added === 0) {
        setAddTunesError(
          `No new tunes were added. ${result.skipped} selection${result.skipped === 1 ? " was" : "s were"} already present or unavailable.`
        );
        return;
      }

      if (result.skipped > 0) {
        toast(
          `${result.skipped} tune${result.skipped === 1 ? " was" : "s were"} skipped because they were already present or unavailable.`,
          { duration: 3000 }
        );
      }

      setShowTunePicker(false);
    } catch (error) {
      setAddTunesError(
        error instanceof Error ? error.message : "Failed to add tunes"
      );
    } finally {
      setIsAddingTunes(false);
    }
  };

  return (
    <Show when={props.isOpen}>
      <button
        type="button"
        class="fixed inset-0 z-[60] bg-black/50 dark:bg-black/70 cursor-default"
        onClick={props.onClose}
        aria-label="Close tune-set editor backdrop"
        data-testid="tune-set-editor-backdrop"
      />

      <div
        class="fixed left-1/2 top-1/2 z-[70] w-[95vw] max-w-2xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 transform rounded-lg bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tune-set-editor-title"
        data-testid="tune-set-editor-dialog"
      >
        <div class="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <h2
            id="tune-set-editor-title"
            class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white"
          >
            {dialogTitle()}
          </h2>
          <div class="flex items-center gap-4">
            <button
              type="button"
              onClick={props.onClose}
              disabled={isSaving()}
              class="text-gray-700 dark:text-gray-300 hover:underline text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="cancel-tune-set-button"
            >
              <div class="flex items-center gap-2">
                <span>{canManage() ? "Cancel" : "Close"}</span>
                <CircleX size={20} />
              </div>
            </button>
            <Show when={canManage()}>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving()}
                class="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                data-testid="save-tune-set-button"
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
            </Show>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <Show
            when={!props.tuneSetId || !tuneSet.loading}
            fallback={
              <div class="flex items-center justify-center py-12">
                <div class="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full" />
              </div>
            }
          >
            <div class="space-y-2">
              <label
                for="tune-set-name"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Name
              </label>
              <input
                id="tune-set-name"
                type="text"
                value={name()}
                onInput={(event) => setName(event.currentTarget.value)}
                disabled={!canManage()}
                class="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                placeholder={
                  entityLabel() === "Program"
                    ? "Festival opener"
                    : "Warm-up set"
                }
                data-testid="tune-set-name-input"
              />
            </div>

            <div class="space-y-2">
              <label
                for="tune-set-description"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Description
              </label>
              <textarea
                id="tune-set-description"
                value={description()}
                onInput={(event) => setDescription(event.currentTarget.value)}
                disabled={!canManage()}
                class="w-full min-h-28 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                placeholder={
                  entityLabel() === "Program"
                    ? "Optional notes about when to use this program"
                    : "Optional notes about when to use this set"
                }
                data-testid="tune-set-description-input"
              />
            </div>

            <Show when={props.tuneSetId}>
              <div class="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                <div>
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {entityLabel() === "Program"
                          ? "Current Program Entries"
                          : `Tunes in This ${entityLabel()}`}
                      </h3>
                      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <Show
                          when={canManage()}
                          fallback={`You can view the current tune order here.`}
                        >
                          {canOnlyUsePublicTunes()
                            ? "Add public tunes here directly and remove entries as needed."
                            : "Add tunes here directly and remove entries as needed."}
                        </Show>
                      </p>
                    </div>
                    <Show when={canManage()}>
                      <button
                        type="button"
                        class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-200"
                        onClick={() => {
                          setAddTunesError(null);
                          setShowTunePicker(true);
                        }}
                        data-testid="open-add-tunes-to-set-button"
                      >
                        Add Tunes
                      </button>
                    </Show>
                  </div>
                </div>

                <Show
                  when={!tuneSetItems.loading}
                  fallback={
                    <div class="py-4 text-sm text-gray-500 dark:text-gray-400">
                      {entityLabel() === "Program"
                        ? "Loading entries..."
                        : "Loading tunes..."}
                    </div>
                  }
                >
                  <Show
                    when={(tuneSetItems() ?? []).length > 0}
                    fallback={
                      <div class="rounded-md border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                        {entityLabel() === "Program"
                          ? "This program is empty. Use Add Tunes to build it."
                          : "This set is empty. Use Add Tunes or Add to Set from Repertoire to populate it."}
                      </div>
                    }
                  >
                    <div
                      class="space-y-2"
                      data-testid="tune-set-membership-list"
                    >
                      {(tuneSetItems() ?? []).map((item) => (
                        <div class="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700">
                          <div class="min-w-0">
                            <div class="truncate text-sm font-medium text-gray-900 dark:text-white">
                              {item.tune.title}
                            </div>
                            <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Position {item.position + 1}
                            </div>
                          </div>
                          <Show when={canManage()}>
                            <button
                              type="button"
                              class="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/70 dark:text-red-300 dark:hover:bg-red-950/40"
                              disabled={removingTuneId() !== null}
                              onClick={() => void handleRemoveTune(item)}
                              data-testid="remove-tune-from-set-button"
                            >
                              <Show
                                when={removingTuneId() === item.tuneRef}
                                fallback="Remove"
                              >
                                Removing...
                              </Show>
                            </button>
                          </Show>
                        </div>
                      ))}
                    </div>
                  </Show>
                </Show>
              </div>
            </Show>

            <Show when={props.tuneSetId && !canManage()}>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                You can view this {entityLabel().toLowerCase()}, but only group
                owners and admins can change it.
              </p>
            </Show>
          </Show>
        </div>
      </div>

      <TunePickerDialog
        isOpen={showTunePicker()}
        label={entityLabel()}
        tunes={addableTunes()}
        existingTuneIds={existingTuneIds()}
        isSaving={isAddingTunes()}
        error={addTunesError()}
        emptyMessage={
          canOnlyUsePublicTunes()
            ? "No public tunes are available to add right now."
            : "No tunes match your search."
        }
        onClose={() => {
          if (!isAddingTunes()) {
            setShowTunePicker(false);
            setAddTunesError(null);
          }
        }}
        onAddSelected={(tuneIds) => void handleAddSelectedTunes(tuneIds)}
      />
    </Show>
  );
};
