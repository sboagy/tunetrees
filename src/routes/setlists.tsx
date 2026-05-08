/**
 * Setlists Page
 *
 * First-class Setlists tab with group-scoped setlist management.
 *
 * Layout follows the grid-tab pattern (toolbar + content area):
 * - Toolbar: Group dropdown, Setlist dropdown, Edit toggle, New Setlist button
 * - View mode: Setlist metadata + items list (read-only)
 * - Edit mode: Two-panel (Library | Setlist Build) for owners/admins
 *
 * @module routes/setlists
 */

import type { ColumnDef } from "@tanstack/solid-table";
import { Plus, Search, SquarePen, Trash2 } from "lucide-solid";
import {
  type Component,
  createMemo,
  createResource,
  createSignal,
  For,
  type JSX,
  Show,
} from "solid-js";
import { toast } from "solid-sonner";
import {
  buildSetlistGridRows,
  buildSetlistLibraryGridRows,
  getSetlistGridRowId,
  getSetlistGridSubRows,
  type ISetlistGridRow,
} from "@/components/grids/setlist-grid-rows";
import { TunesGrid } from "@/components/grids/TunesGrid";
import { Button } from "@/components/ui/button";
import { useGroupsDialog } from "@/contexts/GroupsDialogContext";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCurrentTune } from "@/lib/context/CurrentTuneContext";
import { useCurrentTuneSet } from "@/lib/context/CurrentTuneSetContext";
import { getVisibleGroups } from "@/lib/db/queries/groups";
import {
  addTuneSetToSetlist,
  addTuneToSetlist,
  createSetlist,
  deleteSetlist,
  getEligibleTuneSetsForSetlist,
  getSetlistAccessForUser,
  getSetlistItems,
  getVisibleSetlists,
  removeSetlistItem,
  reorderSetlistItems,
  type SetlistItemKind,
  type SetlistItemWithSummary,
  updateSetlist,
} from "@/lib/db/queries/setlists";
import { getTuneSetItems } from "@/lib/db/queries/tune-sets";
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
  kind: SetlistItemKind;
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

const SetlistsPage: Component = () => {
  const { user, localDb } = useAuth();
  const { currentTuneId, setCurrentTuneId } = useCurrentTune();
  const { incrementTuneSetListChanged, tuneSetListChanged } =
    useCurrentTuneSet();
  const { openGroupsDialog, groupListVersion } = useGroupsDialog();
  const userId = () => user()?.id;

  // ── Toolbar state ────────────────────────────────────────────────────────

  const [selectedGroupId, setSelectedGroupId] = createSignal<string | null>(
    null
  );
  const [selectedSetlistId, setSelectedSetlistId] = createSignal<string | null>(
    null
  );
  const [isEditing, setIsEditing] = createSignal(false);
  const [isCreating, setIsCreating] = createSignal(false);

  // ── Setlist editor state ─────────────────────────────────────────────────

  const [editorName, setEditorName] = createSignal("");
  const [editorDescription, setEditorDescription] = createSignal("");
  const [libraryQuery, setLibraryQuery] = createSignal("");
  const [libraryFilter, setLibraryFilter] = createSignal<
    "all" | SetlistItemKind
  >("all");
  const [draggedItemId, setDraggedItemId] = createSignal<string | null>(null);
  const [isSaving, setIsSaving] = createSignal(false);
  const [isMutatingItems, setIsMutatingItems] = createSignal(false);
  const [deletingSetlistId, setDeletingSetlistId] = createSignal<string | null>(
    null
  );
  const [libraryPanelOpen, setLibraryPanelOpen] = createSignal(true);

  // ── Data: user's groups ──────────────────────────────────────────────────

  const [groups] = createResource(
    () => {
      const db = localDb();
      const uid = userId();
      const version = groupListVersion();
      return db && uid ? { db, userId: uid, version } : null;
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

  // ── Data: setlists for selected group ────────────────────────────────────

  const [groupSetlists, { refetch: refetchSetlists }] = createResource(
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
      return getVisibleSetlists(params.db, params.userId, {
        groupId: params.groupId,
      });
    }
  );

  const selectedGroup = createMemo(
    () => (groups() ?? []).find((g) => g.id === selectedGroupId()) ?? null
  );

  const selectedSetlist = createMemo(
    () =>
      (groupSetlists() ?? []).find((p) => p.id === selectedSetlistId()) ?? null
  );

  // Auto-select first setlist when group changes
  createResource(groupSetlists, (setlists) => {
    if (!setlists || setlists.length === 0) {
      setSelectedSetlistId(null);
      return;
    }
    const current = selectedSetlistId();
    if (!current || !setlists.some((p) => p.id === current)) {
      setSelectedSetlistId(setlists[0].id);
    }
  });

  // ── Data: setlist access check ───────────────────────────────────────────

  const [setlistAccess] = createResource(
    () => {
      const db = localDb();
      const uid = userId();
      const progId = selectedSetlistId();
      return db && uid && progId
        ? { db, userId: uid, setlistId: progId }
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

  const canManage = createMemo(() => {
    if (isCreating()) {
      const group = selectedGroup();
      return group?.canManageSets ?? false;
    }
    const access = setlistAccess();
    if (access) return access.canManage;
    // No setlist selected yet — fall back to group-level permission so the
    // "New Setlist" button is visible even when the group has no setlists.
    const group = selectedGroup();
    return group?.canManageSets ?? false;
  });

  // ── Data: setlist items (for view mode display) ──────────────────────────

  const [setlistItems] = createResource(
    () => {
      const db = localDb();
      const uid = userId();
      const progId = selectedSetlistId();
      const version = tuneSetListChanged();
      return db && uid && progId
        ? { db, userId: uid, setlistId: progId, version }
        : null;
    },
    async (params) => {
      if (!params) return [];
      return getSetlistItems(params.db, params.setlistId, params.userId);
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
      return getEligibleTuneSetsForSetlist(params.db, params.userId);
    }
  );

  const [setlistTuneSetMembers] = createResource(
    () => {
      const db = localDb();
      const uid = userId();
      const items = setlistItems();
      const version = tuneSetListChanged();
      return db && uid && items ? { db, userId: uid, items, version } : null;
    },
    async (params) => {
      if (!params) return {};

      const tuneSetIds = params.items.flatMap((item) =>
        item.itemKind === "tune_set" && item.tuneSet?.id
          ? [item.tuneSet.id]
          : []
      );

      const entries = await Promise.all(
        [...new Set(tuneSetIds)].map(async (tuneSetId) => [
          tuneSetId,
          await getTuneSetItems(params.db, tuneSetId, params.userId),
        ])
      );

      return Object.fromEntries(entries);
    }
  );

  const [availableTuneSetMembers] = createResource(
    () => {
      const db = localDb();
      const uid = userId();
      const tuneSets = availableTuneSets();
      return db && uid && tuneSets ? { db, userId: uid, tuneSets } : null;
    },
    async (params) => {
      if (!params) return {};

      const entries = await Promise.all(
        params.tuneSets.map(async (tuneSet) => [
          tuneSet.id,
          await getTuneSetItems(params.db, tuneSet.id, params.userId),
        ])
      );

      return Object.fromEntries(entries);
    }
  );

  const setlistGridRows = createMemo(() =>
    buildSetlistGridRows(
      setlistItems.latest ?? setlistItems() ?? [],
      setlistTuneSetMembers.latest ?? setlistTuneSetMembers() ?? {}
    )
  );

  const libraryGridRows = createMemo(() =>
    buildSetlistLibraryGridRows(
      availableTunes.latest ?? availableTunes() ?? [],
      availableTuneSets.latest ?? availableTuneSets() ?? [],
      availableTuneSetMembers.latest ?? availableTuneSetMembers() ?? {},
      {
        filter: libraryFilter(),
        searchQuery: libraryQuery(),
      }
    )
  );

  // ── Actions ──────────────────────────────────────────────────────────────

  const showError = (message: string, descriptionText?: string) => {
    toast.error(message, {
      description: descriptionText,
      duration: Infinity,
    });
  };

  const groupRef = () => selectedGroupId();

  const persistSetlistMetadata = async (options?: {
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
        const created = await createSetlist(db, uid, {
          groupRef: grpRef,
          name: editorName(),
          description: editorDescription(),
        });
        setSelectedSetlistId(created.id);
        setIsCreating(false);
        incrementTuneSetListChanged();
        void refetchSetlists();
        if (showSuccessToast) {
          toast.success(`Created setlist "${created.name}".`, {
            duration: 2500,
          });
        }
        return created;
      }

      // Updating existing setlist
      const progId = selectedSetlistId();
      if (!progId) return null;

      const updated = await updateSetlist(db, progId, uid, {
        name: editorName(),
        description: editorDescription(),
      });
      incrementTuneSetListChanged();
      void refetchSetlists();
      if (showSuccessToast) {
        toast.success(`Saved setlist "${updated?.name ?? editorName()}".`, {
          duration: 2500,
        });
      }
      return updated ?? null;
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Failed to save Setlist"
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
    const prog = selectedSetlist();
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
    await persistSetlistMetadata({ showSuccessToast: false });
    handleCancelEdit();
  };

  const ensureSetlistId = async (): Promise<string | null> => {
    if (!isCreating()) return selectedSetlistId();
    if (!normalizeMetadataValue(editorName())) return null;
    const created = await persistSetlistMetadata();
    return created?.id ?? null;
  };

  const handleAddCandidate = async (candidate: CandidateItem) => {
    const db = localDb();
    const uid = userId();
    if (!db || !uid) {
      showError("Database is not ready yet.");
      return;
    }

    const progId = await ensureSetlistId();
    if (!progId) return;

    try {
      setIsMutatingItems(true);
      if (candidate.kind === "tune") {
        await addTuneToSetlist(db, progId, candidate.id, uid);
      } else {
        await addTuneSetToSetlist(db, progId, candidate.id, uid);
      }
      incrementTuneSetListChanged();
      void refetchSetlists();
      toast.success(`Added "${candidate.title}" to this Setlist.`, {
        duration: 2500,
      });
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Failed to add item to Setlist"
      );
    } finally {
      setIsMutatingItems(false);
    }
  };

  const handleRemoveItem = async (item: SetlistItemWithSummary) => {
    const db = localDb();
    const uid = userId();
    const progId = selectedSetlistId();
    if (!db || !uid || !progId) {
      showError("Database is not ready yet.");
      return;
    }

    try {
      setIsMutatingItems(true);
      await removeSetlistItem(db, progId, item.id, uid);
      incrementTuneSetListChanged();
      void refetchSetlists();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Failed to remove Setlist item"
      );
    } finally {
      setIsMutatingItems(false);
    }
  };

  const handleDropOnItem = async (targetItemId: string) => {
    const draggedId = draggedItemId();
    const db = localDb();
    const uid = userId();
    const progId = selectedSetlistId();
    const items = setlistItems() ?? [];
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
      await reorderSetlistItems(db, progId, reordered, uid);
      incrementTuneSetListChanged();
      void refetchSetlists();
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Failed to reorder Setlist items"
      );
    } finally {
      setDraggedItemId(null);
      setIsMutatingItems(false);
    }
  };

  const handleDeleteSetlist = async () => {
    const prog = selectedSetlist();
    if (!prog) return;
    const db = localDb();
    const uid = userId();
    if (!db || !uid) {
      toast.error("Database is not ready yet.");
      return;
    }

    const confirmed = window.confirm(`Delete the setlist "${prog.name}"?`);
    if (!confirmed) return;

    try {
      setDeletingSetlistId(prog.id);
      await deleteSetlist(db, prog.id, uid);
      setSelectedSetlistId(null);
      incrementTuneSetListChanged();
      void refetchSetlists();
      toast.success(`Deleted setlist "${prog.name}".`, { duration: 2500 });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete setlist"
      );
    } finally {
      setDeletingSetlistId(null);
    }
  };

  // ── Render helpers ───────────────────────────────────────────────────────

  const hasValidSetlistName = () => normalizeMetadataValue(editorName()) !== "";
  const setlistItemsById = createMemo(
    () =>
      new Map(
        (setlistItems.latest ?? setlistItems() ?? []).map((item) => [
          item.id,
          item,
        ])
      )
  );

  const handleGridRowClick = (row: ISetlistGridRow) => {
    if (row.rowKind !== "tune") return;
    setCurrentTuneId(row.id);
  };
  const gridUserId = (scope: string) =>
    `${userId() ?? "setlists-anon"}:${scope}`;

  const defaultExpandedSetlistRowIds = createMemo(
    () => setlistGridRows().autoExpandedRowIds
  );
  const defaultExpandedLibraryRowIds = createMemo(
    () => libraryGridRows().autoExpandedRowIds
  );

  const createGridColumns = (options?: {
    includeOrder?: boolean;
    renderAction?: (row: ISetlistGridRow) => JSX.Element | null;
  }): ColumnDef<ISetlistGridRow>[] => {
    const columns: ColumnDef<ISetlistGridRow>[] = [];

    if (options?.includeOrder) {
      columns.push({
        accessorKey: "setlistPosition",
        id: "order",
        header: "#",
        cell: (info) =>
          info.row.depth === 0 ? (info.getValue<number | null>() ?? "—") : "",
        size: 56,
        minSize: 56,
        maxSize: 70,
        enableSorting: false,
        enableResizing: false,
      });
    }

    columns.push(
      {
        accessorKey: "title",
        id: "title",
        header: "Title",
        cell: (info) => (
          <span class="block truncate" title={info.row.original.title}>
            {info.row.original.title}
          </span>
        ),
        size: 240,
        minSize: 180,
      },
      {
        accessorKey: "type",
        id: "type",
        header: "Type",
        cell: (info) => info.getValue<string | null>() ?? "—",
        size: 120,
        minSize: 96,
      },
      {
        accessorKey: "mode",
        id: "mode",
        header: "Mode",
        cell: (info) => info.getValue<string | null>() ?? "—",
        size: 120,
        minSize: 96,
      },
      {
        accessorKey: "details",
        id: "details",
        header: "Details",
        cell: (info) => (
          <span
            class="block truncate text-xs text-muted-foreground"
            title={info.row.original.details ?? ""}
          >
            {info.row.original.details ?? "—"}
          </span>
        ),
        size: 260,
        minSize: 180,
      }
    );

    if (options?.renderAction) {
      columns.push({
        id: "actions",
        header: "Actions",
        cell: (info) => options.renderAction?.(info.row.original) ?? null,
        size: 110,
        minSize: 92,
        maxSize: 140,
        enableSorting: false,
      });
    }

    return columns;
  };

  const setlistViewColumns = createMemo(() =>
    createGridColumns({ includeOrder: true })
  );
  const setlistEditColumns = createMemo(() =>
    createGridColumns({
      includeOrder: true,
      renderAction: (row) => {
        if (!row.setlistItemId || row.setlistPosition == null) {
          return null;
        }

        return (
          <button
            type="button"
            class="inline-flex items-center rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900/70 dark:text-red-300 dark:hover:bg-red-950/40"
            onClick={(event) => {
              event.stopPropagation();
              const item = setlistItemsById().get(row.setlistItemId ?? "");
              if (item) {
                void handleRemoveItem(item);
              }
            }}
            disabled={isMutatingItems() || isSaving()}
            data-testid="setlist-editor-remove-item-button"
          >
            Remove
          </button>
        );
      },
    })
  );
  const libraryColumns = createMemo(() =>
    createGridColumns({
      renderAction: (row) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void handleAddCandidate({
              kind: row.itemKind,
              id: row.sourceId,
              title: row.title,
              subtitle:
                row.details ??
                (row.itemKind === "tune_set" ? "Tune Set" : "Tune"),
            });
          }}
          disabled={!hasValidSetlistName() || isMutatingItems() || isSaving()}
          class="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-200"
          data-testid="setlists-add-candidate-button"
        >
          <Plus size={14} />
          {row.itemKind === "tune_set" ? "Add Set" : "Add"}
        </button>
      ),
    })
  );

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
              data-testid="setlists-group-label-link"
            >
              Group
            </button>
            <select
              id="setlists-group-select"
              value={selectedGroupId() ?? ""}
              onChange={(e) => {
                setSelectedGroupId(e.currentTarget.value || null);
                setSelectedSetlistId(null);
              }}
              class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              data-testid="setlists-group-select"
            >
              <Show when={(groups() ?? []).length === 0}>
                <option value="">No groups</option>
              </Show>
              <For each={groups() ?? []}>
                {(group) => <option value={group.id}>{group.name}</option>}
              </For>
            </select>
          </div>

          {/* Setlist selector */}
          <div class="flex items-center gap-2">
            <label
              for="setlists-setlist-select"
              class="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Setlist
            </label>
            <select
              id="setlists-setlist-select"
              value={selectedSetlistId() ?? ""}
              onChange={(e) => {
                setSelectedSetlistId(e.currentTarget.value || null);
                if (isEditing()) handleCancelEdit();
              }}
              class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              data-testid="setlists-setlist-select"
            >
              <Show when={(groupSetlists() ?? []).length === 0}>
                <option value="">No setlists</option>
              </Show>
              <For each={groupSetlists() ?? []}>
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
                    (isCreating() && !hasValidSetlistName())
                  }
                  data-testid="setlists-done-editing-button"
                >
                  <Show
                    when={isSaving()}
                    fallback={isCreating() ? "Create Setlist" : "Done Editing"}
                  >
                    Saving...
                  </Show>
                </Button>
              </div>
            }
          >
            {/* Always-visible view-mode toolbar buttons.
                Buttons are always present to avoid layout shifts; permission
                denials surface a toast instead of hiding the control. */}
            <div class="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class={
                  canManage()
                    ? "text-blue-700 hover:bg-blue-50 dark:text-blue-200 dark:hover:bg-blue-950/20"
                    : "opacity-50"
                }
                onClick={() => {
                  if (!canManage()) {
                    toast.error(
                      "You need to be a manager (admin or owner) to edit this setlist.",
                      { duration: 5000 }
                    );
                    return;
                  }
                  handleStartEdit();
                }}
                disabled={!selectedSetlistId()}
                data-testid="setlists-edit-button"
              >
                <SquarePen size={14} class="mr-1.5" />
                Edit
              </Button>
              <Button
                type="button"
                variant="accent"
                size="sm"
                class={canManage() ? "" : "opacity-50"}
                onClick={() => {
                  if (!canManage()) {
                    toast.error(
                      "You need to be a manager (admin or owner) of this group to create setlists.",
                      { duration: 5000 }
                    );
                    return;
                  }
                  handleStartCreate();
                }}
                disabled={!selectedGroupId()}
                data-testid="setlists-new-button"
              >
                <Plus size={14} class="mr-1.5" />
                New Setlist
              </Button>
              <Show when={selectedSetlistId()}>
                <Button
                  type="button"
                  variant="destructive-ghost"
                  size="sm"
                  class={canManage() ? "" : "opacity-50"}
                  onClick={() => {
                    if (!canManage()) {
                      toast.error(
                        "You need to be a manager (admin or owner) to delete this setlist.",
                        { duration: 5000 }
                      );
                      return;
                    }
                    void handleDeleteSetlist();
                  }}
                  disabled={deletingSetlistId() === selectedSetlistId()}
                  data-testid="setlists-delete-button"
                >
                  <Show
                    when={deletingSetlistId() === selectedSetlistId()}
                    fallback={<Trash2 size={14} class="mr-1.5" />}
                  >
                    Deleting...
                  </Show>
                  Delete
                </Button>
              </Show>
            </div>
          </Show>
        </div>
      </div>

      {/* ── Content Area ────────────────────────────────────────────────── */}
      <div class="min-h-0 flex-1 overflow-hidden p-4 sm:p-6">
        {/* No group selected */}
        <Show when={!selectedGroupId()}>
          <EmptyState
            message="No group selected"
            detail="Select a group above to view and manage its setlists."
          />
        </Show>

        <Show when={selectedGroupId()}>
          {/* ── View Mode ──────────────────────────────────────────────── */}
          <Show when={!isEditing()}>
            <Show
              when={selectedSetlist()}
              fallback={
                <EmptyState
                  message="No setlists yet"
                  detail="Create a setlist to get started, or select a different group."
                />
              }
            >
              {(prog) => (
                <div class="flex h-full min-h-0 flex-col space-y-6">
                  {/* Setlist header */}
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

                  {/* Setlist items list */}
                  <div class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                    <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                      <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Setlist Items
                      </h3>
                    </div>
                    <Show
                      when={(setlistItems() ?? []).length > 0}
                      fallback={
                        <div class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                          This setlist is empty. Add tunes or tune sets by
                          editing.
                        </div>
                      }
                    >
                      <div class="h-[min(60vh,36rem)]">
                        <TunesGrid
                          tablePurpose="setlists"
                          userId={gridUserId("view")}
                          data={setlistGridRows().rows}
                          columns={setlistViewColumns()}
                          currentRowId={currentTuneId() ?? undefined}
                          onRowClick={handleGridRowClick}
                          enableColumnReorder={true}
                          enableRowSelection={false}
                          disableListMode={true}
                          getRowId={getSetlistGridRowId}
                          getSubRows={getSetlistGridSubRows}
                          defaultExpandedRowIds={defaultExpandedSetlistRowIds()}
                          hierarchyColumnId="title"
                          getRowProps={(row) =>
                            row.setlistPosition != null
                              ? { "data-testid": "setlist-item-row" }
                              : undefined
                          }
                        />
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
                        Search tunes and tune sets to add to this setlist.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLibraryPanelOpen(false)}
                      data-testid="setlists-collapse-library-button"
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
                          data-testid="setlists-library-search"
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
                              data-testid={`setlists-library-filter-${filter}`}
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

                    <div class="min-h-0 flex-1 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                      <Show
                        when={libraryGridRows().rows.length > 0}
                        fallback={
                          <div class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                            No matching tunes or tune sets.
                          </div>
                        }
                      >
                        <TunesGrid
                          tablePurpose="setlists"
                          userId={gridUserId("library")}
                          data={libraryGridRows().rows}
                          columns={libraryColumns()}
                          currentRowId={currentTuneId() ?? undefined}
                          onRowClick={handleGridRowClick}
                          enableColumnReorder={true}
                          enableRowSelection={false}
                          disableListMode={true}
                          getRowId={getSetlistGridRowId}
                          getSubRows={getSetlistGridSubRows}
                          defaultExpandedRowIds={defaultExpandedLibraryRowIds()}
                          autoExpandedRowIds={
                            libraryGridRows().autoExpandedRowIds
                          }
                          hierarchyColumnId="title"
                        />
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
                    data-testid="setlists-expand-library-button"
                  >
                    Show Library
                  </Button>
                </div>
              </Show>

              {/* Right Panel: Setlist Build */}
              <section class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                  <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Setlist Build
                  </h3>
                </div>

                <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
                  {/* Metadata */}
                  <div class="space-y-3">
                    <div>
                      <label
                        for="setlist-editor-name"
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Setlist Name
                      </label>
                      <input
                        id="setlist-editor-name"
                        type="text"
                        value={editorName()}
                        onInput={(e) => setEditorName(e.currentTarget.value)}
                        class={`mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm text-gray-900 dark:bg-gray-800 dark:text-white ${
                          !hasValidSetlistName() && isCreating()
                            ? "border-red-400 ring-1 ring-red-400/40"
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                        placeholder="Festival opener"
                        data-testid="setlist-editor-name-input"
                      />
                    </div>
                    <div>
                      <label
                        for="setlist-editor-description"
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Notes
                      </label>
                      <textarea
                        id="setlist-editor-description"
                        value={editorDescription()}
                        onInput={(e) =>
                          setEditorDescription(e.currentTarget.value)
                        }
                        rows={2}
                        class="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        placeholder="Optional setlist notes"
                        data-testid="setlist-editor-description-input"
                      />
                    </div>
                  </div>

                  {/* Items list */}
                  <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                    <div class="flex items-center justify-between border-b border-gray-200 px-4 py-2 dark:border-gray-700">
                      <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Setlist Items
                      </span>
                      <span class="text-xs text-gray-500 dark:text-gray-400">
                        {(setlistItems() ?? []).length} item
                        {(setlistItems() ?? []).length === 1 ? "" : "s"}
                      </span>
                    </div>

                    <Show
                      when={(setlistItems() ?? []).length > 0}
                      fallback={
                        <div class="flex flex-1 items-center justify-center px-4 py-8 text-sm text-gray-500 dark:text-gray-400">
                          Add tunes or tune sets from the library panel.
                        </div>
                      }
                    >
                      <div class="min-h-0 flex-1">
                        <TunesGrid
                          tablePurpose="setlists"
                          userId={gridUserId("editor")}
                          data={setlistGridRows().rows}
                          columns={setlistEditColumns()}
                          currentRowId={currentTuneId() ?? undefined}
                          onRowClick={handleGridRowClick}
                          enableColumnReorder={true}
                          enableRowSelection={false}
                          disableListMode={true}
                          getRowId={getSetlistGridRowId}
                          getSubRows={getSetlistGridSubRows}
                          defaultExpandedRowIds={defaultExpandedSetlistRowIds()}
                          hierarchyColumnId="title"
                          getRowProps={(row) =>
                            row.setlistItemId && row.setlistPosition != null
                              ? {
                                  class:
                                    draggedItemId() === row.setlistItemId
                                      ? "opacity-60"
                                      : "",
                                  draggable: !isMutatingItems() && !isSaving(),
                                  "data-testid": "setlist-editor-item-row",
                                  onDragStart: () =>
                                    setDraggedItemId(row.setlistItemId),
                                  onDragEnd: () => setDraggedItemId(null),
                                  onDragOver: (event) => event.preventDefault(),
                                  onDrop: () =>
                                    void handleDropOnItem(row.setlistItemId),
                                }
                              : undefined
                          }
                        />
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

export default SetlistsPage;
