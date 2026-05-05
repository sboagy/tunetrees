/**
 * Programs Page
 *
 * First-class Programs tab with group-scoped program management.
 *
 * Layout follows the grid-tab pattern (toolbar + content area):
 * - Toolbar: Group dropdown, Program dropdown, Edit toggle, New Program button
 * - View mode: Program metadata + items list (read-only)
 * - Edit mode: Two-panel (Library | Program Build) for owners/admins
 *
 * @module routes/programs
 */

import { GripVertical, Plus, Search, SquarePen, Trash2 } from "lucide-solid";
import {
  type Component,
  createMemo,
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";
import { toast } from "solid-sonner";
import { Button } from "@/components/ui/button";
import { useGroupsDialog } from "@/contexts/GroupsDialogContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCurrentTuneSet } from "@/lib/context/CurrentTuneSetContext";
import { getVisibleGroups } from "@/lib/db/queries/groups";
import {
  addTuneSetToProgram,
  addTuneToProgram,
  createProgram,
  deleteProgram,
  getEligibleTuneSetsForProgram,
  getProgramAccessForUser,
  getProgramItems,
  getVisiblePrograms,
  type ProgramItemKind,
  type ProgramItemWithSummary,
  removeProgramItem,
  reorderProgramItems,
  updateProgram,
} from "@/lib/db/queries/programs";
import { getTunesForUser } from "@/lib/db/queries/tunes";
import type { Tune, TuneSet } from "@/lib/db/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function normalizeMetadataValue(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

interface CandidateItem {
  kind: ProgramItemKind;
  id: string;
  title: string;
  subtitle: string;
}

// ── Empty State ──────────────────────────────────────────────────────────────

const EmptyState: Component<{ message: string; detail?: string }> = (props) => (
  <div class="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background p-10 text-center">
    <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <span aria-hidden="true">+</span>
    </div>
    <h3 class="mt-4 text-lg font-semibold text-foreground">{props.message}</h3>
    <Show when={props.detail}>
      <p class="mt-2 text-sm text-muted-foreground">{props.detail}</p>
    </Show>
  </div>
);

// ── Page Component ───────────────────────────────────────────────────────────

const ProgramsPage: Component = () => {
  const { user, localDb } = useAuth();
  const { incrementTuneSetListChanged, tuneSetListChanged } =
    useCurrentTuneSet();
  const { openGroupsDialog } = useGroupsDialog();
  const userId = () => user()?.id;

  // ── Toolbar state ────────────────────────────────────────────────────────

  const [selectedGroupId, setSelectedGroupId] = createSignal<string | null>(
    null
  );
  const [selectedProgramId, setSelectedProgramId] = createSignal<string | null>(
    null
  );
  const [isEditing, setIsEditing] = createSignal(false);
  const [isCreating, setIsCreating] = createSignal(false);

  // ── Program editor state ─────────────────────────────────────────────────

  const [editorName, setEditorName] = createSignal("");
  const [editorDescription, setEditorDescription] = createSignal("");
  const [libraryQuery, setLibraryQuery] = createSignal("");
  const [libraryFilter, setLibraryFilter] = createSignal<
    "all" | ProgramItemKind
  >("all");
  const [draggedItemId, setDraggedItemId] = createSignal<string | null>(null);
  const [isSaving, setIsSaving] = createSignal(false);
  const [isMutatingItems, setIsMutatingItems] = createSignal(false);
  const [deletingProgramId, setDeletingProgramId] = createSignal<string | null>(
    null
  );
  const [libraryPanelOpen, setLibraryPanelOpen] = createSignal(true);

  // ── Data: user's groups ──────────────────────────────────────────────────

  const [groups] = createResource(
    () => {
      const db = localDb();
      const uid = userId();
      return db && uid ? { db, userId: uid } : null;
    },
    async (params) => {
      if (!params) return [];
      return getVisibleGroups(params.db, params.userId);
    }
  );

  // Auto-select first group
  createResource(groups, (visibleGroups) => {
    if (!visibleGroups || visibleGroups.length === 0) {
      setSelectedGroupId(null);
      return;
    }
    const current = selectedGroupId();
    if (!current || !visibleGroups.some((g) => g.id === current)) {
      setSelectedGroupId(visibleGroups[0].id);
    }
  });

  // ── Data: programs for selected group ────────────────────────────────────

  const [groupPrograms, { refetch: refetchPrograms }] = createResource(
    () => {
      const db = localDb();
      const uid = userId();
      const groupId = selectedGroupId();
      const version = tuneSetListChanged();
      return db && uid && groupId
        ? { db, userId: uid, groupId, version }
        : null;
    },
    async (params) => {
      if (!params) return [];
      return getVisiblePrograms(params.db, params.userId, {
        groupId: params.groupId,
      });
    }
  );

  const selectedGroup = createMemo(
    () => (groups() ?? []).find((g) => g.id === selectedGroupId()) ?? null
  );

  const selectedProgram = createMemo(
    () =>
      (groupPrograms() ?? []).find((p) => p.id === selectedProgramId()) ?? null
  );

  // Auto-select first program when group changes
  createResource(groupPrograms, (programs) => {
    if (!programs || programs.length === 0) {
      setSelectedProgramId(null);
      return;
    }
    const current = selectedProgramId();
    if (!current || !programs.some((p) => p.id === current)) {
      setSelectedProgramId(programs[0].id);
    }
  });

  // ── Data: program access check ───────────────────────────────────────────

  const [programAccess] = createResource(
    () => {
      const db = localDb();
      const uid = userId();
      const progId = selectedProgramId();
      return db && uid && progId
        ? { db, userId: uid, programId: progId }
        : null;
    },
    async (params) => {
      if (!params) return null;
      return getProgramAccessForUser(
        params.db,
        params.programId,
        params.userId
      );
    }
  );

  const canManage = createMemo(() => {
    // For creating a new program in a group, check group-level permissions
    if (isCreating()) {
      const group = selectedGroup();
      return group?.canManageSets ?? false;
    }
    return programAccess()?.canManage ?? false;
  });

  // ── Data: program items (for view mode display) ──────────────────────────

  const [programItems] = createResource(
    () => {
      const db = localDb();
      const uid = userId();
      const progId = selectedProgramId();
      const version = tuneSetListChanged();
      return db && uid && progId
        ? { db, userId: uid, programId: progId, version }
        : null;
    },
    async (params) => {
      if (!params) return [];
      return getProgramItems(params.db, params.programId, params.userId);
    }
  );

  // ── Data: library (available tunes & tune sets for edit mode) ────────────

  const [availableTunes] = createResource(
    () => {
      const db = localDb();
      const uid = userId();
      return db && uid && isEditing() ? { db, userId: uid } : null;
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
      const uid = userId();
      const version = tuneSetListChanged();
      return db && uid && isEditing() ? { db, userId: uid, version } : null;
    },
    async (params): Promise<TuneSet[]> => {
      if (!params) return [];
      return getEligibleTuneSetsForProgram(params.db, params.userId);
    }
  );

  // ── Derived: candidate items for library panel ───────────────────────────

  const candidateItems = createMemo<CandidateItem[]>(() => {
    const normalizedQuery = libraryQuery().trim().toLowerCase();
    const filter = libraryFilter();

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

  // ── Actions ──────────────────────────────────────────────────────────────

  const showError = (message: string, descriptionText?: string) => {
    toast.error(message, {
      description: descriptionText,
      duration: Infinity,
    });
  };

  const groupRef = () => selectedGroupId();

  const persistProgramMetadata = async (options?: {
    showSuccessToast?: boolean;
  }) => {
    const db = localDb();
    const uid = userId();
    const grpRef = groupRef();
    if (!db || !uid || !grpRef) {
      showError("Database is not ready yet.");
      return null;
    }

    try {
      setIsSaving(true);
      const showSuccessToast = options?.showSuccessToast ?? true;

      if (isCreating()) {
        const created = await createProgram(db, uid, {
          groupRef: grpRef,
          name: editorName(),
          description: editorDescription(),
        });
        setSelectedProgramId(created.id);
        setIsCreating(false);
        incrementTuneSetListChanged();
        void refetchPrograms();
        if (showSuccessToast) {
          toast.success(`Created program "${created.name}".`, {
            duration: 2500,
          });
        }
        return created;
      }

      // Updating existing program
      const progId = selectedProgramId();
      if (!progId) return null;

      const updated = await updateProgram(db, progId, uid, {
        name: editorName(),
        description: editorDescription(),
      });
      incrementTuneSetListChanged();
      void refetchPrograms();
      if (showSuccessToast) {
        toast.success(`Saved program "${updated?.name ?? editorName()}".`, {
          duration: 2500,
        });
      }
      return updated ?? null;
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Failed to save Program"
      );
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartCreate = () => {
    setIsCreating(true);
    setIsEditing(true);
    setEditorName("");
    setEditorDescription("");
    setLibraryQuery("");
    setLibraryFilter("all");
    setLibraryPanelOpen(true);
  };

  const handleStartEdit = () => {
    const prog = selectedProgram();
    if (!prog) return;
    setEditorName(prog.name);
    setEditorDescription(prog.description ?? "");
    setIsCreating(false);
    setIsEditing(true);
    setLibraryQuery("");
    setLibraryFilter("all");
    setLibraryPanelOpen(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setIsCreating(false);
    setEditorName("");
    setEditorDescription("");
    setLibraryQuery("");
    setLibraryFilter("all");
    setDraggedItemId(null);
  };

  const handleSaveAndClose = async () => {
    if (isCreating() && !normalizeMetadataValue(editorName())) {
      handleCancelEdit();
      return;
    }
    await persistProgramMetadata({ showSuccessToast: false });
    handleCancelEdit();
  };

  const ensureProgramId = async (): Promise<string | null> => {
    if (!isCreating()) return selectedProgramId();
    if (!normalizeMetadataValue(editorName())) return null;
    const created = await persistProgramMetadata();
    return created?.id ?? null;
  };

  const handleAddCandidate = async (candidate: CandidateItem) => {
    const db = localDb();
    const uid = userId();
    if (!db || !uid) {
      showError("Database is not ready yet.");
      return;
    }

    const progId = await ensureProgramId();
    if (!progId) return;

    try {
      setIsMutatingItems(true);
      if (candidate.kind === "tune") {
        await addTuneToProgram(db, progId, candidate.id, uid);
      } else {
        await addTuneSetToProgram(db, progId, candidate.id, uid);
      }
      incrementTuneSetListChanged();
      void refetchPrograms();
      toast.success(`Added "${candidate.title}" to this Program.`, {
        duration: 2500,
      });
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Failed to add item to Program"
      );
    } finally {
      setIsMutatingItems(false);
    }
  };

  const handleRemoveItem = async (item: ProgramItemWithSummary) => {
    const db = localDb();
    const uid = userId();
    const progId = selectedProgramId();
    if (!db || !uid || !progId) {
      showError("Database is not ready yet.");
      return;
    }

    try {
      setIsMutatingItems(true);
      await removeProgramItem(db, progId, item.id, uid);
      incrementTuneSetListChanged();
      void refetchPrograms();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Failed to remove Program item"
      );
    } finally {
      setIsMutatingItems(false);
    }
  };

  const handleDropOnItem = async (targetItemId: string) => {
    const draggedId = draggedItemId();
    const db = localDb();
    const uid = userId();
    const progId = selectedProgramId();
    const items = programItems() ?? [];
    if (!draggedId || !db || !uid || !progId || draggedId === targetItemId) {
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
      await reorderProgramItems(db, progId, reordered, uid);
      incrementTuneSetListChanged();
      void refetchPrograms();
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Failed to reorder Program items"
      );
    } finally {
      setDraggedItemId(null);
      setIsMutatingItems(false);
    }
  };

  const handleDeleteProgram = async () => {
    const prog = selectedProgram();
    if (!prog) return;
    const db = localDb();
    const uid = userId();
    if (!db || !uid) {
      toast.error("Database is not ready yet.");
      return;
    }

    const confirmed = window.confirm(`Delete the program "${prog.name}"?`);
    if (!confirmed) return;

    try {
      setDeletingProgramId(prog.id);
      await deleteProgram(db, prog.id, uid);
      setSelectedProgramId(null);
      incrementTuneSetListChanged();
      void refetchPrograms();
      toast.success(`Deleted program "${prog.name}".`, { duration: 2500 });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete program"
      );
    } finally {
      setDeletingProgramId(null);
    }
  };

  // ── Render helpers ───────────────────────────────────────────────────────

  const hasValidProgramName = () => normalizeMetadataValue(editorName()) !== "";

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div class="flex h-full flex-col bg-gray-50 dark:bg-gray-900">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div class="shrink-0 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
        <div class="flex flex-wrap items-center gap-3">
          {/* Group selector */}
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
              onClick={() => openGroupsDialog()}
              data-testid="programs-group-label-link"
            >
              Group
            </button>
            <select
              id="programs-group-select"
              value={selectedGroupId() ?? ""}
              onChange={(e) => {
                setSelectedGroupId(e.currentTarget.value || null);
                setSelectedProgramId(null);
              }}
              class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              data-testid="programs-group-select"
            >
              <Show when={(groups() ?? []).length === 0}>
                <option value="">No groups</option>
              </Show>
              <For each={groups() ?? []}>
                {(group) => <option value={group.id}>{group.name}</option>}
              </For>
            </select>
          </div>

          {/* Program selector */}
          <div class="flex items-center gap-2">
            <label
              for="programs-program-select"
              class="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Program
            </label>
            <select
              id="programs-program-select"
              value={selectedProgramId() ?? ""}
              onChange={(e) => {
                setSelectedProgramId(e.currentTarget.value || null);
                if (isEditing()) handleCancelEdit();
              }}
              class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              data-testid="programs-program-select"
            >
              <Show when={(groupPrograms() ?? []).length === 0}>
                <option value="">No programs</option>
              </Show>
              <For each={groupPrograms() ?? []}>
                {(prog) => <option value={prog.id}>{prog.name}</option>}
              </For>
            </select>
          </div>

          <div class="h-6 w-px bg-gray-200 dark:bg-gray-700" />

          {/* Edit toggle + actions */}
          <Show
            when={!isEditing()}
            fallback={
              /* Editing toolbar actions */
              <div class="flex items-center gap-2">
                <Button
                  type="button"
                  variant={isCreating() ? "default" : "outline"}
                  size="sm"
                  onClick={() => void handleSaveAndClose()}
                  disabled={
                    isSaving() ||
                    isMutatingItems() ||
                    (isCreating() && !hasValidProgramName())
                  }
                  data-testid="programs-done-editing-button"
                >
                  <Show
                    when={isSaving()}
                    fallback={isCreating() ? "Create Program" : "Done Editing"}
                  >
                    Saving...
                  </Show>
                </Button>
              </div>
            }
          >
            <Show when={canManage()}>
              <div class="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  class="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-900/70 dark:text-blue-200 dark:hover:bg-blue-950/20"
                  onClick={handleStartEdit}
                  disabled={!selectedProgramId()}
                  data-testid="programs-edit-button"
                >
                  <SquarePen size={14} class="mr-1.5" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  class="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/70 dark:text-emerald-200 dark:hover:bg-emerald-950/20"
                  onClick={handleStartCreate}
                  disabled={!selectedGroupId()}
                  data-testid="programs-new-button"
                >
                  <Plus size={14} class="mr-1.5" />
                  New Program
                </Button>
              </div>
            </Show>
            <Show
              when={
                selectedProgram() &&
                selectedProgram()!.canManage &&
                !isEditing()
              }
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/70 dark:text-red-300 dark:hover:bg-red-950/20"
                onClick={() => void handleDeleteProgram()}
                disabled={deletingProgramId() === selectedProgramId()}
                data-testid="programs-delete-button"
              >
                <Show
                  when={deletingProgramId() === selectedProgramId()}
                  fallback={<Trash2 size={14} class="mr-1.5" />}
                >
                  Deleting...
                </Show>
                Delete
              </Button>
            </Show>
          </Show>
        </div>
      </div>

      {/* ── Content Area ────────────────────────────────────────────────── */}
      <div class="min-h-0 flex-1 overflow-hidden p-4 sm:p-6">
        {/* No group selected */}
        <Show when={!selectedGroupId()}>
          <EmptyState
            message="No group selected"
            detail="Select a group above to view and manage its programs."
          />
        </Show>

        <Show when={selectedGroupId()}>
          {/* ── View Mode ──────────────────────────────────────────────── */}
          <Show when={!isEditing()}>
            <Show
              when={selectedProgram()}
              fallback={
                <EmptyState
                  message="No programs yet"
                  detail="Create a program to get started, or select a different group."
                />
              }
            >
              {(prog) => (
                <div class="mx-auto max-w-3xl space-y-6">
                  {/* Program header */}
                  <div class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                    <div class="flex items-start justify-between gap-4">
                      <div class="min-w-0">
                        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
                          {prog().name}
                        </h2>
                        <Show when={prog().description}>
                          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            {prog().description}
                          </p>
                        </Show>
                      </div>
                      <span class="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {prog().itemCount} item
                        {prog().itemCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <Show when={prog().groupName}>
                      <div class="mt-3 text-xs text-gray-500 dark:text-gray-400">
                        Group: {prog().groupName}
                      </div>
                    </Show>
                  </div>

                  {/* Program items list */}
                  <div class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                    <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                      <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Program Items
                      </h3>
                    </div>
                    <Show
                      when={(programItems() ?? []).length > 0}
                      fallback={
                        <div class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                          This program is empty. Add tunes or tune sets by
                          editing.
                        </div>
                      }
                    >
                      <div class="divide-y divide-gray-200 dark:divide-gray-700">
                        <For each={programItems() ?? []}>
                          {(item, index) => (
                            <div
                              class="flex items-center gap-3 px-4 py-3"
                              data-testid="program-item-row"
                            >
                              <span class="text-xs font-medium text-gray-500 dark:text-gray-400 w-5 text-right">
                                {index() + 1}
                              </span>
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
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </div>
              )}
            </Show>
          </Show>

          {/* ── Edit Mode ──────────────────────────────────────────────── */}
          <Show when={isEditing()}>
            <div class="grid h-full min-h-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              {/* Left Panel: Library */}
              <Show when={libraryPanelOpen()}>
                <section class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                  <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                    <div>
                      <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Library
                      </h3>
                      <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        Search tunes and tune sets to add to this program.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLibraryPanelOpen(false)}
                      data-testid="programs-collapse-library-button"
                    >
                      Hide
                    </Button>
                  </div>

                  <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3">
                    {/* Search + filter */}
                    <div class="flex flex-col gap-2 sm:flex-row">
                      <div class="relative flex-1">
                        <Search
                          size={14}
                          class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                          type="text"
                          value={libraryQuery()}
                          onInput={(e) =>
                            setLibraryQuery(e.currentTarget.value)
                          }
                          placeholder="Search tunes and tune sets"
                          class="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                          data-testid="programs-library-search"
                        />
                      </div>
                      <div class="flex items-center gap-1">
                        {(["all", "tune", "tune_set"] as const).map(
                          (filter) => (
                            <button
                              type="button"
                              class={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
                                libraryFilter() === filter
                                  ? "bg-blue-600 text-white"
                                  : "border border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-200"
                              }`}
                              onClick={() => setLibraryFilter(filter)}
                              data-testid={`programs-library-filter-${filter}`}
                            >
                              {filter === "all"
                                ? "All"
                                : filter === "tune"
                                  ? "Tunes"
                                  : "Sets"}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Candidate list */}
                    <div class="min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                      <Show
                        when={candidateItems().length > 0}
                        fallback={
                          <div class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                            No matching tunes or tune sets.
                          </div>
                        }
                      >
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
                                  !hasValidProgramName() ||
                                  isMutatingItems() ||
                                  isSaving()
                                }
                                class="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-200"
                                data-testid="programs-add-candidate-button"
                              >
                                <Plus size={14} />
                                Add
                              </button>
                            </div>
                          )}
                        </For>
                      </Show>
                    </div>
                  </div>
                </section>
              </Show>

              {/* Collapsed library toggle */}
              <Show when={!libraryPanelOpen()}>
                <div class="flex items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLibraryPanelOpen(true)}
                    data-testid="programs-expand-library-button"
                  >
                    Show Library
                  </Button>
                </div>
              </Show>

              {/* Right Panel: Program Build */}
              <section class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                  <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Program Build
                  </h3>
                </div>

                <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
                  {/* Metadata */}
                  <div class="space-y-3">
                    <div>
                      <label
                        for="program-editor-name"
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Program Name
                      </label>
                      <input
                        id="program-editor-name"
                        type="text"
                        value={editorName()}
                        onInput={(e) => setEditorName(e.currentTarget.value)}
                        class={`mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm text-gray-900 dark:bg-gray-800 dark:text-white ${
                          !hasValidProgramName() && isCreating()
                            ? "border-red-400 ring-1 ring-red-400/40"
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                        placeholder="Festival opener"
                        data-testid="program-editor-name-input"
                      />
                    </div>
                    <div>
                      <label
                        for="program-editor-description"
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Notes
                      </label>
                      <textarea
                        id="program-editor-description"
                        value={editorDescription()}
                        onInput={(e) =>
                          setEditorDescription(e.currentTarget.value)
                        }
                        rows={2}
                        class="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        placeholder="Optional program notes"
                        data-testid="program-editor-description-input"
                      />
                    </div>
                  </div>

                  {/* Items list */}
                  <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                    <div class="flex items-center justify-between border-b border-gray-200 px-4 py-2 dark:border-gray-700">
                      <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Program Items
                      </span>
                      <span class="text-xs text-gray-500 dark:text-gray-400">
                        {(programItems() ?? []).length} item
                        {(programItems() ?? []).length === 1 ? "" : "s"}
                      </span>
                    </div>

                    <Show
                      when={(programItems() ?? []).length > 0}
                      fallback={
                        <div class="flex flex-1 items-center justify-center px-4 py-8 text-sm text-gray-500 dark:text-gray-400">
                          Add tunes or tune sets from the library panel.
                        </div>
                      }
                    >
                      <div class="min-h-0 flex-1 overflow-y-auto">
                        <For each={programItems() ?? []}>
                          {(item, index) => (
                            <div
                              class="flex items-start gap-3 border-b border-gray-200 px-4 py-3 last:border-b-0 dark:border-gray-700"
                              data-testid="program-editor-item-row"
                            >
                              <button
                                type="button"
                                class="flex min-w-0 flex-1 items-start gap-3 rounded-md text-left"
                                draggable
                                onDragStart={() => setDraggedItemId(item.id)}
                                onDragEnd={() => setDraggedItemId(null)}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={() => void handleDropOnItem(item.id)}
                              >
                                <div class="flex items-center gap-2 pt-1 text-gray-400">
                                  <span class="text-xs font-medium text-gray-500 dark:text-gray-400 w-5 text-right">
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
                              <button
                                type="button"
                                class="rounded-md border border-red-200 p-1.5 text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900/70 dark:text-red-300 dark:hover:bg-red-950/40"
                                onClick={() => void handleRemoveItem(item)}
                                disabled={isMutatingItems() || isSaving()}
                                data-testid="program-editor-remove-item-button"
                              >
                                <Trash2 size={14} />
                                <span class="sr-only">
                                  Remove item from Program
                                </span>
                              </button>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </div>
              </section>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
};

export default ProgramsPage;
