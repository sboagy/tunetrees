import { GripVertical, Plus, Save, Trash2 } from "lucide-solid";
import type { Component } from "solid-js";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { toast } from "solid-sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCurrentTuneSet } from "@/lib/context/CurrentTuneSetContext";
import {
  addTuneSetToSetlist,
  addTuneToSetlist,
  createSetlist,
  getEligibleTuneSetsForSetlist,
  getSetlistAccessForUser,
  getSetlistById,
  getSetlistItems,
  removeSetlistItem,
  reorderSetlistItems,
  type SetlistItemKind,
  type SetlistItemWithSummary,
  updateSetlist,
} from "@/lib/db/queries/setlists";
import { getTunesForUser } from "@/lib/db/queries/tunes";
import type { Tune, TuneSet } from "@/lib/db/types";

interface SetlistBuilderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  setlistId?: string;
  groupRef?: string | null;
  onSaved?: () => void;
  forceViewMode?: boolean;
}

interface CandidateItem {
  kind: SetlistItemKind;
  id: string;
  title: string;
  subtitle: string;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function normalizeMetadataValue(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export const SetlistBuilderDialog: Component<SetlistBuilderDialogProps> = (
  props
) => {
  const { user, localDb } = useAuth();
  const { incrementTuneSetListChanged, tuneSetListChanged } =
    useCurrentTuneSet();
  let setlistNameInputRef: HTMLInputElement | undefined;
  const [activeSetlistId, setActiveSetlistId] = createSignal<
    string | undefined
  >(props.setlistId);
  const [name, setName] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [query, setQuery] = createSignal("");
  const [candidateFilter, setCandidateFilter] = createSignal<
    "all" | SetlistItemKind
  >("all");
  const [isSaving, setIsSaving] = createSignal(false);
  const [isMutatingItems, setIsMutatingItems] = createSignal(false);
  const [draggedItemId, setDraggedItemId] = createSignal<string | null>(null);

  const showDialogError = (message: string, descriptionText?: string) => {
    toast.error(message, {
      description: descriptionText,
      duration: Infinity,
    });
  };

  createEffect(() => {
    if (!props.isOpen) {
      setActiveSetlistId(props.setlistId);
      setName("");
      setDescription("");
      setQuery("");
      setCandidateFilter("all");
      setDraggedItemId(null);
      return;
    }

    setActiveSetlistId(props.setlistId);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving() && !isMutatingItems()) {
        props.onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const [setlistAccess] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const setlistId = activeSetlistId();
      return db && userId && setlistId && props.isOpen
        ? { db, userId, setlistId }
        : null;
    },
    async (params) => {
      if (!params) return null;
      return getSetlistAccessForUser(
        params.db,
        params.setlistId,
        params.userId
      );
    }
  );

  const [setlist] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const setlistId = activeSetlistId();
      return db && userId && setlistId && props.isOpen
        ? { db, userId, setlistId }
        : null;
    },
    async (params) => {
      if (!params) return null;
      return getSetlistById(params.db, params.setlistId, params.userId);
    }
  );

  const [setlistItems] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const setlistId = activeSetlistId();
      const version = tuneSetListChanged();
      return db && userId && setlistId && props.isOpen
        ? { db, userId, setlistId, version }
        : null;
    },
    async (params) => {
      if (!params) return [];
      return getSetlistItems(params.db, params.setlistId, params.userId);
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
      const tunes = await getTunesForUser(params.db, params.userId);
      return tunes.filter((tune) => !tune.privateFor);
    }
  );

  const [availableTuneSets] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const version = tuneSetListChanged();
      return db && userId && props.isOpen ? { db, userId, version } : null;
    },
    async (params): Promise<TuneSet[]> => {
      if (!params) return [];
      return getEligibleTuneSetsForSetlist(params.db, params.userId);
    }
  );

  createEffect(() => {
    if (!props.isOpen) {
      return;
    }

    const currentSetlist = setlist();
    if (activeSetlistId()) {
      setName(currentSetlist?.name ?? "");
      setDescription(currentSetlist?.description ?? "");
      return;
    }

    setName("");
    setDescription("");
  });

  const canManage = createMemo(() => {
    if (props.forceViewMode && activeSetlistId()) {
      return false;
    }

    if (!activeSetlistId()) {
      return true;
    }
    return setlistAccess()?.canManage ?? false;
  });

  const dialogTitle = createMemo(() => {
    if (!activeSetlistId()) {
      return "Create Setlist";
    }

    if (props.forceViewMode) {
      return "Setlist Details";
    }

    return canManage() ? "Edit Setlist" : "View Setlist";
  });

  const hasValidSetlistName = createMemo(
    () => normalizeMetadataValue(name()) !== ""
  );

  const isCreatingSetlist = createMemo(() => !activeSetlistId());

  createEffect(() => {
    if (
      !props.isOpen ||
      props.forceViewMode ||
      !isCreatingSetlist() ||
      !canManage()
    ) {
      return;
    }

    const focusInput = () => {
      if (setlistNameInputRef) {
        setlistNameInputRef.focus();
        setlistNameInputRef.select();
      }
    };

    const animationFrameId = requestAnimationFrame(focusInput);
    const timeoutId = window.setTimeout(focusInput, 120);

    onCleanup(() => {
      cancelAnimationFrame(animationFrameId);
      window.clearTimeout(timeoutId);
    });
  });

  const hasPendingMetadataChanges = createMemo(() => {
    const currentSetlist = setlist();
    if (!activeSetlistId()) {
      return (
        normalizeMetadataValue(name()) !== "" || description().trim() !== ""
      );
    }

    if (!currentSetlist) {
      return false;
    }

    return (
      normalizeMetadataValue(name()) !==
        normalizeMetadataValue(currentSetlist.name) ||
      normalizeMetadataValue(description()) !==
        normalizeMetadataValue(currentSetlist.description)
    );
  });

  const candidateItems = createMemo<CandidateItem[]>(() => {
    const normalizedQuery = query().trim().toLowerCase();
    const filter = candidateFilter();

    const tuneCandidates = (availableTunes() ?? []).map((tune) => ({
      kind: "tune" as const,
      id: tune.id,
      title: tune.title ?? "Untitled Tune",
      subtitle:
        [tune.type, tune.mode, tune.incipit].filter(Boolean).join(" | ") ||
        "Tune",
    }));
    const tuneSetCandidates = (availableTuneSets() ?? []).map((tuneSet) => ({
      kind: "tune_set" as const,
      id: tuneSet.id,
      title: tuneSet.name,
      subtitle: tuneSet.description || "Tune Set",
    }));

    return [...tuneCandidates, ...tuneSetCandidates]
      .filter((item) => filter === "all" || item.kind === filter)
      .filter((item) => {
        if (!normalizedQuery) return true;
        return [item.title, item.subtitle].some((value) =>
          value.toLowerCase().includes(normalizedQuery)
        );
      })
      .sort((left, right) => left.title.localeCompare(right.title));
  });

  const persistSetlistMetadata = async (options?: {
    showSuccessToast?: boolean;
  }) => {
    const db = localDb();
    const userId = user()?.id;
    const groupRef = props.groupRef ?? setlist()?.groupRef ?? null;
    if (!db || !userId || !groupRef) {
      showDialogError("Database is not ready yet.");
      return null;
    }

    try {
      setIsSaving(true);
      const showSuccessToast = options?.showSuccessToast ?? true;

      if (activeSetlistId()) {
        const updated = await updateSetlist(db, activeSetlistId()!, userId, {
          name: name(),
          description: description(),
        });
        incrementTuneSetListChanged();
        props.onSaved?.();
        if (showSuccessToast) {
          toast.success(`Saved setlist "${updated?.name ?? name()}".`, {
            duration: 2500,
          });
        }
        return updated ?? null;
      }

      const created = await createSetlist(db, userId, {
        groupRef,
        name: name(),
        description: description(),
      });
      setActiveSetlistId(created.id);
      incrementTuneSetListChanged();
      props.onSaved?.();
      if (showSuccessToast) {
        toast.success(`Created setlist "${created.name}".`, {
          duration: 2500,
        });
      }
      return created;
    } catch (error) {
      showDialogError(
        error instanceof Error ? error.message : "Failed to save Setlist"
      );
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const ensureSetlistId = async (): Promise<string | null> => {
    if (activeSetlistId()) {
      return activeSetlistId()!;
    }

    if (!hasValidSetlistName()) {
      return null;
    }

    const created = await persistSetlistMetadata();
    return created?.id ?? null;
  };

  const handleDone = async () => {
    if (!canManage()) {
      props.onClose();
      return;
    }

    if (activeSetlistId() && hasPendingMetadataChanges()) {
      const saved = await persistSetlistMetadata({ showSuccessToast: false });
      if (!saved) {
        return;
      }
    }

    props.onClose();
  };

  const handleAddCandidate = async (candidate: CandidateItem) => {
    const db = localDb();
    const userId = user()?.id;
    if (!db || !userId) {
      showDialogError("Database is not ready yet.");
      return;
    }

    const setlistId = await ensureSetlistId();
    if (!setlistId) {
      return;
    }

    try {
      setIsMutatingItems(true);
      if (candidate.kind === "tune") {
        await addTuneToSetlist(db, setlistId, candidate.id, userId);
      } else {
        await addTuneSetToSetlist(db, setlistId, candidate.id, userId);
      }

      incrementTuneSetListChanged();
      props.onSaved?.();
      toast.success(`Added "${candidate.title}" to this Setlist.`, {
        duration: 2500,
      });
    } catch (error) {
      showDialogError(
        error instanceof Error ? error.message : "Failed to add item to Setlist"
      );
    } finally {
      setIsMutatingItems(false);
    }
  };

  const handleRemoveItem = async (item: SetlistItemWithSummary) => {
    const db = localDb();
    const userId = user()?.id;
    const setlistId = activeSetlistId();
    if (!db || !userId || !setlistId) {
      showDialogError("Database is not ready yet.");
      return;
    }

    try {
      setIsMutatingItems(true);
      await removeSetlistItem(db, setlistId, item.id, userId);
      incrementTuneSetListChanged();
      props.onSaved?.();
    } catch (error) {
      showDialogError(
        error instanceof Error ? error.message : "Failed to remove Setlist item"
      );
    } finally {
      setIsMutatingItems(false);
    }
  };

  const handleDropOnItem = async (targetItemId: string) => {
    const draggedId = draggedItemId();
    const db = localDb();
    const userId = user()?.id;
    const setlistId = activeSetlistId();
    const items = setlistItems() ?? [];
    if (
      !draggedId ||
      !db ||
      !userId ||
      !setlistId ||
      draggedId === targetItemId
    ) {
      setDraggedItemId(null);
      return;
    }

    const fromIndex = items.findIndex((item) => item.id === draggedId);
    const toIndex = items.findIndex((item) => item.id === targetItemId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      setDraggedItemId(null);
      return;
    }

    try {
      setIsMutatingItems(true);
      const reordered = moveItem(items, fromIndex, toIndex).map(
        (item) => item.id
      );
      await reorderSetlistItems(db, setlistId, reordered, userId);
      incrementTuneSetListChanged();
      props.onSaved?.();
    } catch (error) {
      showDialogError(
        error instanceof Error
          ? error.message
          : "Failed to reorder Setlist items"
      );
    } finally {
      setDraggedItemId(null);
      setIsMutatingItems(false);
    }
  };

  return (
    <Show when={props.isOpen}>
      <button
        type="button"
        class="fixed inset-0 z-[60] cursor-default bg-black/50 dark:bg-black/70"
        onClick={props.onClose}
        aria-label="Close setlist builder backdrop"
        data-testid="setlist-builder-backdrop"
      />

      <div
        class="fixed left-1/2 top-1/2 z-[70] flex h-[92vh] w-[96vw] max-w-7xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="setlist-builder-title"
        data-testid="setlist-builder-dialog"
      >
        <div class="border-b border-gray-200 p-4 dark:border-gray-700 sm:p-6">
          <header class="flex justify-between items-center w-full mb-4">
            <div class="flex flex-1 justify-start">
              <Button
                type="button"
                onClick={() => void handleDone()}
                disabled={isSaving() || isMutatingItems()}
                variant={canManage() ? "outline" : "ghost"}
                size="sm"
                data-testid="close-setlist-builder-button"
              >
                {canManage() ? "Cancel" : "Back"}
              </Button>
            </div>
            <div class="flex min-w-0 flex-1 justify-center px-3">
              <h2
                id="setlist-builder-title"
                class="text-center text-xl font-semibold text-gray-900 dark:text-white"
              >
                {dialogTitle()}
              </h2>
            </div>
            <div class="flex flex-1 justify-end">
              <Show when={canManage()}>
                <Button
                  type="button"
                  onClick={() =>
                    void (activeSetlistId()
                      ? handleDone()
                      : persistSetlistMetadata())
                  }
                  disabled={
                    isSaving() || isMutatingItems() || !hasValidSetlistName()
                  }
                  variant="default"
                  size="sm"
                  data-testid="save-setlist-button"
                >
                  <Show
                    when={isSaving()}
                    fallback={
                      activeSetlistId() ? (
                        <>
                          <Save size={16} />
                          Save
                        </>
                      ) : (
                        <>
                          <Plus size={16} />
                          Create
                        </>
                      )
                    }
                  >
                    Saving...
                  </Show>
                </Button>
              </Show>
            </div>
          </header>

          <div class="flex items-start gap-4">
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Build a musical Setlist from individual Tunes and eligible Tune
              Sets.
            </p>
          </div>
        </div>

        <div
          class={`grid min-h-0 flex-1 gap-0 ${props.forceViewMode ? "lg:grid-cols-1" : "lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]"}`}
        >
          <section class="min-h-0 border-b border-gray-200 p-4 dark:border-gray-700 lg:border-b-0 lg:border-r sm:p-6">
            <div class="space-y-4">
              <div class="space-y-4">
                <div
                  class={`space-y-2 rounded-lg p-3 ${canManage() && !hasValidSetlistName() ? "border border-red-200/70 bg-red-50/40 dark:border-red-900/60 dark:bg-red-950/10" : "border border-transparent bg-transparent"}`}
                >
                  <div class="flex items-center gap-2">
                    <label
                      for="setlist-name"
                      class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Setlist Name
                    </label>
                    <Show when={canManage() && !hasValidSetlistName()}>
                      <span class="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-700 dark:bg-red-950/60 dark:text-red-300">
                        Required
                      </span>
                    </Show>
                  </div>
                  <input
                    id="setlist-name"
                    ref={setlistNameInputRef}
                    autofocus={
                      props.isOpen && isCreatingSetlist() && canManage()
                    }
                    type="text"
                    value={name()}
                    onInput={(event) => setName(event.currentTarget.value)}
                    disabled={!canManage()}
                    required
                    aria-required="true"
                    aria-invalid={canManage() && !hasValidSetlistName()}
                    aria-describedby="setlist-name-help"
                    class={`w-full rounded-md border bg-white px-3 py-2 text-sm text-gray-900 transition-colors placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400 dark:focus:ring-blue-400/60 dark:focus:border-blue-400 ${canManage() && !hasValidSetlistName() ? "border-red-400 ring-1 ring-red-400/40 dark:border-red-500 dark:ring-red-500/30" : "border-gray-300 dark:border-gray-700"}`}
                    placeholder="Festival opener"
                    data-testid="setlist-name-input"
                  />
                  <p
                    id="setlist-name-help"
                    class={`text-xs ${canManage() && !hasValidSetlistName() ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}
                  >
                    Enter a setlist name to enable Create and add tunes or tune
                    sets.
                  </p>
                </div>

                <div class="space-y-2">
                  <label
                    for="setlist-description"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Notes
                  </label>
                  <textarea
                    id="setlist-description"
                    value={description()}
                    onInput={(event) =>
                      setDescription(event.currentTarget.value)
                    }
                    disabled={!canManage()}
                    rows={3}
                    class="min-h-24 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    placeholder="Optional set notes"
                    data-testid="setlist-description-input"
                  />
                </div>
              </div>

              <Show when={!props.forceViewMode}>
                <div class="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
                  <div>
                    <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Library
                    </h3>
                    <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      Search the existing Tune and Tune Set grid, then add items
                      to the Setlist.
                    </p>
                  </div>

                  <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <input
                      type="text"
                      value={query()}
                      onInput={(event) => setQuery(event.currentTarget.value)}
                      placeholder="Search tunes and tune sets"
                      class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      data-testid="setlist-candidate-search-input"
                    />
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class={`rounded-md px-3 py-2 text-xs font-medium ${candidateFilter() === "all" ? "bg-blue-600 text-white" : "border border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-200"}`}
                        onClick={() => setCandidateFilter("all")}
                        data-testid="setlist-candidate-filter-all"
                      >
                        All
                      </button>
                      <button
                        type="button"
                        class={`rounded-md px-3 py-2 text-xs font-medium ${candidateFilter() === "tune" ? "bg-blue-600 text-white" : "border border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-200"}`}
                        onClick={() => setCandidateFilter("tune")}
                        data-testid="setlist-candidate-filter-tunes"
                      >
                        Tunes
                      </button>
                      <button
                        type="button"
                        class={`rounded-md px-3 py-2 text-xs font-medium ${candidateFilter() === "tune_set" ? "bg-blue-600 text-white" : "border border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-200"}`}
                        onClick={() => setCandidateFilter("tune_set")}
                        data-testid="setlist-candidate-filter-tune-sets"
                      >
                        Tune Sets
                      </button>
                    </div>
                  </div>

                  <div
                    class="min-h-0 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                    data-testid="setlist-candidate-list"
                  >
                    <Show
                      when={candidateItems().length > 0}
                      fallback={
                        <div class="px-4 py-10 text-sm text-gray-500 dark:text-gray-400">
                          No matching Tunes or Tune Sets.
                        </div>
                      }
                    >
                      <div class="max-h-[48vh] overflow-y-auto">
                        <For each={candidateItems()}>
                          {(candidate) => (
                            <div class="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3 last:border-b-0 dark:border-gray-700">
                              <div class="min-w-0">
                                <div class="flex items-center gap-2">
                                  <span class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                    {candidate.kind === "tune"
                                      ? "Tune"
                                      : "Tune Set"}
                                  </span>
                                  <span class="truncate text-sm font-medium text-gray-900 dark:text-white">
                                    {candidate.title}
                                  </span>
                                </div>
                                <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  {candidate.subtitle}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  void handleAddCandidate(candidate)
                                }
                                disabled={
                                  !hasValidSetlistName() ||
                                  !canManage() ||
                                  isMutatingItems() ||
                                  isSaving()
                                }
                                class="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-200"
                                data-testid="setlist-add-candidate-button"
                              >
                                <Plus size={14} />
                                Add
                              </button>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </div>
              </Show>
            </div>
          </section>

          <section
            class={`flex min-h-0 h-full flex-col p-4 sm:p-6 ${props.forceViewMode ? "lg:border-l border-gray-200 dark:border-gray-700" : ""}`}
          >
            <div class="flex h-full min-h-0 flex-1 flex-col rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
              <div class="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Setlist Build
                  </h3>
                  <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Drag to reorder. Each row can be a single Tune or a full
                    Tune Set.
                  </p>
                </div>
                <div class="rounded-md bg-white px-3 py-2 text-xs text-gray-500 shadow-sm dark:bg-gray-900 dark:text-gray-400">
                  {setlistItems()?.length ?? 0} item
                  {(setlistItems()?.length ?? 0) === 1 ? "" : "s"}
                </div>
              </div>

              <div
                class="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                data-testid="setlist-items-list"
              >
                <Show
                  when={activeSetlistId()}
                  fallback={
                    <div class="flex min-h-0 flex-1 px-4 py-10 text-sm text-gray-500 dark:text-gray-400">
                      Save the Setlist name first, then add Tunes or Tune Sets
                      on the left.
                    </div>
                  }
                >
                  <Show
                    when={(setlistItems() ?? []).length > 0}
                    fallback={
                      <div class="flex min-h-0 flex-1 px-4 py-10 text-sm text-gray-500 dark:text-gray-400">
                        <Show
                          when={props.forceViewMode}
                          fallback={
                            <>
                              This Setlist is empty. Add Tunes or Tune Sets from
                              the left pane.
                            </>
                          }
                        >
                          This Setlist is empty.
                        </Show>
                      </div>
                    }
                  >
                    <div class="max-h-[58vh] overflow-y-auto">
                      <For each={setlistItems() ?? []}>
                        {(item, index) => (
                          <div
                            class="flex items-start gap-3 border-b border-gray-200 px-4 py-3 last:border-b-0 dark:border-gray-700"
                            data-testid="setlist-item-row"
                          >
                            <button
                              type="button"
                              class="flex min-w-0 flex-1 items-start gap-3 rounded-md text-left"
                              draggable={canManage()}
                              disabled={!canManage()}
                              onDragStart={() => setDraggedItemId(item.id)}
                              onDragEnd={() => setDraggedItemId(null)}
                              onDragOver={(event) => {
                                if (canManage()) {
                                  event.preventDefault();
                                }
                              }}
                              onDrop={() => void handleDropOnItem(item.id)}
                            >
                              <div class="flex items-center gap-2 pt-1 text-gray-400">
                                <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
                                  {index() + 1}
                                </span>
                                <GripVertical size={16} />
                              </div>

                              <div class="min-w-0 flex-1">
                                <div class="flex items-center gap-2">
                                  <span class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                    {item.itemKind === "tune"
                                      ? "Tune"
                                      : "Tune Set"}
                                  </span>
                                  <span class="truncate text-sm font-medium text-gray-900 dark:text-white">
                                    {item.itemKind === "tune"
                                      ? item.tune?.title
                                      : item.tuneSet?.name}
                                  </span>
                                </div>
                                <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  <Show
                                    when={item.itemKind === "tune"}
                                    fallback={`${item.tuneSetTuneCount} tune${item.tuneSetTuneCount === 1 ? "" : "s"}`}
                                  >
                                    {[
                                      item.tune?.type,
                                      item.tune?.mode,
                                      item.tune?.incipit,
                                    ]
                                      .filter(Boolean)
                                      .join(" | ") || "Tune"}
                                  </Show>
                                </div>
                              </div>
                            </button>

                            <Show when={canManage()}>
                              <button
                                type="button"
                                class="rounded-md border border-red-200 px-2 py-2 text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900/70 dark:text-red-300 dark:hover:bg-red-950/40"
                                onClick={() => void handleRemoveItem(item)}
                                disabled={isMutatingItems() || isSaving()}
                                data-testid="remove-setlist-item-button"
                              >
                                <Trash2 size={14} />
                                <span class="sr-only">
                                  Remove item from Setlist
                                </span>
                              </button>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </Show>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Show>
  );
};
