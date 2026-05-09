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

import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { useSearchParams } from "@solidjs/router";
import type { ColumnDef, Table } from "@tanstack/solid-table";
import {
  ChevronDown,
  ChevronRight,
  Columns,
  EllipsisVertical,
  GripVertical,
  Mail,
  Plus,
  Printer,
  Search,
  SquarePen,
  Trash2,
} from "lucide-solid";
import {
  type Component,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  on,
  Show,
} from "solid-js";
import { toast } from "solid-sonner";
import { ColumnVisibilityMenu } from "@/components/catalog/ColumnVisibilityMenu";
import {
  buildSetlistGridRows,
  buildSetlistLibraryGridRows,
  getSetlistGridRowId,
  getSetlistGridSubRows,
  type ISetlistGridRow,
} from "@/components/grids/setlist-grid-rows";
import { getCatalogColumns } from "@/components/grids/TuneColumns";
import { TunesGrid } from "@/components/grids/TunesGrid";
import { useRegisterMobileControlBar } from "@/components/layout/MobileControlBarContext";
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
  updateSetlist,
} from "@/lib/db/queries/setlists";
import { getTuneSetItems } from "@/lib/db/queries/tune-sets";
import { getTunesForUser } from "@/lib/db/queries/tunes";
import type { Tune, TuneSet } from "@/lib/db/types";
import { createIsMobile } from "@/lib/hooks/useIsMobile";

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

function normalizeExclusiveLibrarySelection(
  next: Record<string, boolean>,
  prev: Record<string, boolean>,
  getRow: (rowId: string) => ISetlistGridRow | undefined
): Record<string, boolean> {
  const normalized: Record<string, boolean> = { ...next };
  const nextIds = Object.keys(next);
  const prevIds = new Set(Object.keys(prev));
  const addedIds = nextIds.filter((rowId) => !prevIds.has(rowId));

  for (const rowId of addedIds) {
    const row = getRow(rowId);
    if (!row) continue;

    if (row.rowKind === "tune" && row.tuneSetRef) {
      for (const selectedId of Object.keys(normalized)) {
        if (selectedId === rowId) continue;
        const selectedRow = getRow(selectedId);
        if (
          selectedRow?.rowKind === "tune_set" &&
          selectedRow.sourceId === row.tuneSetRef
        ) {
          delete normalized[selectedId];
        }
      }
      continue;
    }

    if (row.rowKind === "tune_set") {
      for (const selectedId of Object.keys(normalized)) {
        if (selectedId === rowId) continue;
        const selectedRow = getRow(selectedId);
        if (selectedRow?.tuneSetRef === row.sourceId) {
          delete normalized[selectedId];
        }
      }
    }
  }

  for (const selectedId of Object.keys(normalized)) {
    const selectedRow = getRow(selectedId);
    if (selectedRow?.rowKind !== "tune_set") continue;

    for (const childId of Object.keys(normalized)) {
      if (childId === selectedId) continue;
      const childRow = getRow(childId);
      if (childRow?.tuneSetRef === selectedRow.sourceId) {
        delete normalized[childId];
      }
    }
  }

  return normalized;
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
  const isMobile = createIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [dropTargetId, setDropTargetId] = createSignal<string | null>(null);
  const [isSaving, setIsSaving] = createSignal(false);
  const [isMutatingItems, setIsMutatingItems] = createSignal(false);
  const [deletingSetlistId, setDeletingSetlistId] = createSignal<string | null>(
    null
  );
  const [libraryPanelOpen, setLibraryPanelOpen] = createSignal(true);
  const [metadataExpanded, setMetadataExpanded] = createSignal(false);

  // Selection state for checkbox-based bulk actions
  const [librarySelectionCount, setLibrarySelectionCount] = createSignal(0);
  const [editorSelectionCount, setEditorSelectionCount] = createSignal(0);
  const [showColumnsDropdown, setShowColumnsDropdown] = createSignal(false);
  const [showLibraryColumnsDropdown, setShowLibraryColumnsDropdown] =
    createSignal(false);
  const [showEditorColumnsDropdown, setShowEditorColumnsDropdown] =
    createSignal(false);
  const [showOverflowMenu, setShowOverflowMenu] = createSignal(false);
  const [showLibraryPanelMenu, setShowLibraryPanelMenu] = createSignal(false);
  const [showSetlistPanelMenu, setShowSetlistPanelMenu] = createSignal(false);
  const [pendingDisplayOptionsOpen, setPendingDisplayOptionsOpen] =
    createSignal(false);
  const [viewTable, setViewTable] = createSignal<Table<ISetlistGridRow> | null>(
    null
  );
  const [libraryTable, setLibraryTable] =
    createSignal<Table<ISetlistGridRow> | null>(null);
  const [editorTable, setEditorTable] =
    createSignal<Table<ISetlistGridRow> | null>(null);
  const [isRouteInitialized, setIsRouteInitialized] = createSignal(false);
  const [lastHydratedStorageKey, setLastHydratedStorageKey] = createSignal<
    string | null
  >(null);
  let libraryTableRef: Table<ISetlistGridRow> | null = null;
  let editorTableRef: Table<ISetlistGridRow> | null = null;
  let columnsButtonRef: HTMLButtonElement | undefined;
  let libraryColumnsButtonRef: HTMLButtonElement | undefined;
  let editorColumnsButtonRef: HTMLButtonElement | undefined;
  let mobileOverflowButtonRef: HTMLButtonElement | undefined;
  let mobileLibraryOverflowButtonRef: HTMLButtonElement | undefined;
  let mobileSetlistOverflowButtonRef: HTMLButtonElement | undefined;

  createEffect(() => {
    if (!pendingDisplayOptionsOpen() || showOverflowMenu()) {
      return;
    }

    setPendingDisplayOptionsOpen(false);
    queueMicrotask(() => {
      setShowColumnsDropdown(true);
    });
  });

  const getParam = (value: string | string[] | undefined): string => {
    if (Array.isArray(value)) return value[0] || "";
    return value || "";
  };

  const setlistsStateStorageKey = createMemo(
    () => `tt:setlists:state:${userId() ?? "anon"}`
  );

  const readStoredSetlistsState = () => {
    try {
      const raw = localStorage.getItem(setlistsStateStorageKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        groupId?: string;
        setlistId?: string;
        mode?: string;
        create?: string;
      };
      return parsed;
    } catch {
      return null;
    }
  };

  createEffect(
    on(
      () => [
        setlistsStateStorageKey(),
        searchParams.s_group,
        searchParams.s_setlist,
        searchParams.s_mode,
        searchParams.s_create,
        searchParams.tab,
      ],
      () => {
        const storageKey = setlistsStateStorageKey();
        const urlState = {
          groupId: getParam(searchParams.s_group),
          setlistId: getParam(searchParams.s_setlist),
          mode: getParam(searchParams.s_mode),
          create: getParam(searchParams.s_create),
        };
        const hasUrlOverride =
          urlState.groupId !== "" ||
          urlState.setlistId !== "" ||
          urlState.mode !== "" ||
          urlState.create !== "";

        if (!hasUrlOverride && lastHydratedStorageKey() === storageKey) {
          if (!isRouteInitialized()) setIsRouteInitialized(true);
          return;
        }

        const storedState = hasUrlOverride ? null : readStoredSetlistsState();
        const groupId = hasUrlOverride
          ? urlState.groupId
          : (storedState?.groupId ?? "");
        const setlistId = hasUrlOverride
          ? urlState.setlistId
          : (storedState?.setlistId ?? "");
        const mode = hasUrlOverride ? urlState.mode : (storedState?.mode ?? "");
        const create = hasUrlOverride
          ? urlState.create
          : (storedState?.create ?? "");

        const nextGroupId = groupId || null;
        const nextSetlistId = setlistId || null;
        const nextIsCreating = create === "1";
        const nextIsEditing = nextIsCreating || mode === "edit";

        if (selectedGroupId() !== nextGroupId) {
          setSelectedGroupId(nextGroupId);
        }
        if (selectedSetlistId() !== nextSetlistId) {
          setSelectedSetlistId(nextSetlistId);
        }
        if (isCreating() !== nextIsCreating) {
          setIsCreating(nextIsCreating);
        }
        if (isEditing() !== nextIsEditing) {
          setIsEditing(nextIsEditing);
        }

        setLastHydratedStorageKey(storageKey);
        if (hasUrlOverride) {
          setSearchParams(
            {
              s_group: undefined,
              s_setlist: undefined,
              s_mode: undefined,
              s_create: undefined,
            } as unknown as Record<string, string>,
            { replace: true }
          );
        }

        if (!isRouteInitialized()) setIsRouteInitialized(true);
      }
    )
  );

  createEffect(() => {
    if (!isRouteInitialized()) return;

    const nextState = {
      groupId: selectedGroupId() ?? "",
      setlistId: selectedSetlistId() ?? "",
      mode: isEditing() ? "edit" : "",
      create: isCreating() ? "1" : "",
    };

    try {
      localStorage.setItem(
        setlistsStateStorageKey(),
        JSON.stringify(nextState)
      );
    } catch {
      // non-fatal: localStorage may be unavailable
    }
  });

  createEffect(
    on(
      () => [
        setlistsStateStorageKey(),
        searchParams.s_group,
        searchParams.s_setlist,
        searchParams.s_mode,
        searchParams.s_create,
        searchParams.tab,
      ],
      () => {
        const storageKey = setlistsStateStorageKey();
        const urlState = {
          groupId: getParam(searchParams.s_group),
          setlistId: getParam(searchParams.s_setlist),
          mode: getParam(searchParams.s_mode),
          create: getParam(searchParams.s_create),
        };
        const hasUrlOverride =
          urlState.groupId !== "" ||
          urlState.setlistId !== "" ||
          urlState.mode !== "" ||
          urlState.create !== "";

        if (!hasUrlOverride && lastHydratedStorageKey() === storageKey) {
          if (!isRouteInitialized()) setIsRouteInitialized(true);
          return;
        }

        const storedState = hasUrlOverride ? null : readStoredSetlistsState();
        const groupId = hasUrlOverride
          ? urlState.groupId
          : (storedState?.groupId ?? "");
        const setlistId = hasUrlOverride
          ? urlState.setlistId
          : (storedState?.setlistId ?? "");
        const mode = hasUrlOverride ? urlState.mode : (storedState?.mode ?? "");
        const create = hasUrlOverride
          ? urlState.create
          : (storedState?.create ?? "");

        const nextGroupId = groupId || null;
        const nextSetlistId = setlistId || null;
        const nextIsCreating = create === "1";
        const nextIsEditing = nextIsCreating || mode === "edit";

        if (selectedGroupId() !== nextGroupId) {
          setSelectedGroupId(nextGroupId);
        }
        if (selectedSetlistId() !== nextSetlistId) {
          setSelectedSetlistId(nextSetlistId);
        }
        if (isCreating() !== nextIsCreating) {
          setIsCreating(nextIsCreating);
        }
        if (isEditing() !== nextIsEditing) {
          setIsEditing(nextIsEditing);
        }

        setLastHydratedStorageKey(storageKey);
        if (hasUrlOverride) {
          setSearchParams(
            {
              s_group: undefined,
              s_setlist: undefined,
              s_mode: undefined,
              s_create: undefined,
            } as unknown as Record<string, string>,
            { replace: true }
          );
        }

        if (!isRouteInitialized()) setIsRouteInitialized(true);
      }
    )
  );

  createEffect(() => {
    if (!isRouteInitialized()) return;

    const nextState = {
      groupId: selectedGroupId() ?? "",
      setlistId: selectedSetlistId() ?? "",
      mode: isEditing() ? "edit" : "",
      create: isCreating() ? "1" : "",
    };

    try {
      localStorage.setItem(
        setlistsStateStorageKey(),
        JSON.stringify(nextState)
      );
    } catch {
      // non-fatal: localStorage may be unavailable
    }
  });

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

  createEffect(() => {
    const prog = selectedSetlist();
    if (!prog || !isEditing() || isCreating()) return;

    // When edit mode is restored from persisted state, hydrate the editor
    // fields once from the selected setlist without overwriting active edits.
    if (editorName() === "" && editorDescription() === "") {
      setEditorName(prog.name);
      setEditorDescription(prog.description ?? "");
    }
  });

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
    setMetadataExpanded(false);
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
    setMetadataExpanded(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setIsCreating(false);
    setEditorName("");
    setEditorDescription("");
    setLibraryQuery("");
    setLibraryFilter("all");
    setDraggedItemId(null);
    setDropTargetId(null);
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

  const handleDropOnItem = async (
    targetItemId: string,
    sourceItemId?: string
  ) => {
    const draggedId = sourceItemId ?? draggedItemId();
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
  const canMutateSetlistItems = () =>
    hasValidSetlistName() && !isSaving() && !isMutatingItems();

  const handleGridRowClick = (row: ISetlistGridRow) => {
    if (row.rowKind !== "tune") return;
    setCurrentTuneId(row.id);
  };
  const gridUserId = (scope: string) =>
    `${userId() ?? "setlists-anon"}:${scope}`;

  const defaultExpandedLibraryRowIds = createMemo(
    () => libraryGridRows().autoExpandedRowIds
  );

  const createGridColumns = (options?: {
    includeOrder?: boolean;
    showSelect?: boolean;
    showDragHandle?: boolean;
  }): ColumnDef<ISetlistGridRow>[] => {
    const catalogColumns = getCatalogColumns() as ColumnDef<ISetlistGridRow>[];
    const columns: ColumnDef<ISetlistGridRow>[] = [];

    if (options?.showSelect) {
      const selectColumn = catalogColumns.find(
        (column) => column.id === "select"
      );
      if (selectColumn) {
        columns.push(selectColumn);
      }
    }

    // Drag handle column (for reordering setlist items)
    if (options?.showDragHandle) {
      columns.push({
        id: "drag",
        header: "",
        enableHiding: false,
        cell: ({ row }) => {
          if (
            !row.original.setlistItemId ||
            row.original.setlistPosition == null
          ) {
            return <span class="inline-block w-5" aria-hidden="true" />;
          }
          return (
            <span
              class={`inline-flex items-center ${
                canMutateSetlistItems()
                  ? "cursor-grab text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  : "cursor-not-allowed text-gray-300 dark:text-gray-600"
              }`}
              onPointerDown={(event) => {
                if (!canMutateSetlistItems()) return;
                event.preventDefault();

                const handle = event.currentTarget as HTMLElement;
                handle.classList.add("cursor-grabbing");
                handle.classList.remove("cursor-grab");
                const setlistItemId = row.original.setlistItemId!;
                setDraggedItemId(setlistItemId);

                const onMove = (e: PointerEvent) => {
                  const el = document.elementFromPoint(e.clientX, e.clientY);
                  const tr = el?.closest<HTMLTableRowElement>(
                    '[data-testid="setlist-editor-item-row"]'
                  );
                  const targetId = tr
                    ? ((tr as HTMLElement).dataset.setlistItemId ?? null)
                    : null;
                  setDropTargetId(
                    targetId && targetId !== setlistItemId ? targetId : null
                  );
                };

                const onUp = () => {
                  window.removeEventListener("pointermove", onMove);
                  window.removeEventListener("pointerup", onUp);
                  handle.classList.remove("cursor-grabbing");
                  handle.classList.add("cursor-grab");

                  const target = dropTargetId();
                  setDraggedItemId(null);
                  setDropTargetId(null);
                  if (target) {
                    void handleDropOnItem(target, setlistItemId);
                  }
                };

                window.addEventListener("pointermove", onMove);
                window.addEventListener("pointerup", onUp);
              }}
            >
              <GripVertical size={16} />
            </span>
          );
        },
        size: 36,
        minSize: 36,
        maxSize: 36,
        enableSorting: false,
        enableResizing: false,
      });
    }

    if (options?.includeOrder) {
      columns.push({
        accessorKey: "setlistPosition",
        id: "order",
        meta: { headerLabel: "#" },
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

    const sharedColumns = catalogColumns.filter(
      (column) => column.id !== "select"
    );

    columns.push(...sharedColumns);

    columns.push({
      accessorKey: "details",
      id: "details",
      meta: { headerLabel: "Details" },
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
    });

    return columns;
  };

  const setlistViewColumns = createMemo(() =>
    createGridColumns({ includeOrder: true })
  );
  const setlistEditColumns = createMemo(() =>
    createGridColumns({
      includeOrder: true,
      showSelect: true,
      showDragHandle: true,
    })
  );
  const libraryColumns = createMemo(() =>
    createGridColumns({
      showSelect: true,
    })
  );

  // ── Bulk selection actions ─────────────────────────────────────────────

  const handleAddSelected = async () => {
    const table = libraryTableRef;
    if (!table) return;

    const selectedRows = table.getSelectedRowModel().flatRows;
    if (selectedRows.length === 0) {
      toast.info("No items selected in the library.", { duration: 2500 });
      return;
    }

    const candidates: CandidateItem[] = [];
    const seen = new Set<string>();
    for (const row of selectedRows) {
      const original = row.original;
      // Deduplicate: skip if we already have this sourceId+kind combo
      const key = `${original.itemKind}:${original.sourceId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      candidates.push({
        kind: original.itemKind,
        id: original.sourceId,
        title: original.title,
        subtitle:
          original.details ??
          (original.itemKind === "tune_set" ? "Tune Set" : "Tune"),
      });
    }

    if (candidates.length === 0) {
      toast.info("No valid items selected.", { duration: 2500 });
      return;
    }

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
      let addedCount = 0;

      for (const candidate of candidates) {
        try {
          if (candidate.kind === "tune") {
            await addTuneToSetlist(db, progId, candidate.id, uid);
          } else {
            await addTuneSetToSetlist(db, progId, candidate.id, uid);
          }
          addedCount++;
        } catch {
          // Individual item failures are surfaced but don't block the batch
          toast.error(`Failed to add "${candidate.title}".`);
        }
      }

      if (addedCount > 0) {
        incrementTuneSetListChanged();
        void refetchSetlists();
        toast.success(
          `Added ${addedCount} item${addedCount === 1 ? "" : "s"} to this Setlist.`,
          {
            duration: 2500,
          }
        );
      }

      // Clear selection after bulk add
      table.resetRowSelection();
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Failed to add items to Setlist"
      );
    } finally {
      setIsMutatingItems(false);
    }
  };

  const handleRemoveSelected = async () => {
    const table = editorTableRef;
    if (!table) return;

    const selectedRows = table.getSelectedRowModel().flatRows;
    if (selectedRows.length === 0) {
      toast.info("No items selected in the setlist.", { duration: 2500 });
      return;
    }

    const db = localDb();
    const uid = userId();
    const progId = selectedSetlistId();
    if (!db || !uid || !progId) {
      showError("Database is not ready yet.");
      return;
    }

    // Collect unique setlist item IDs from selected rows
    const itemIds: string[] = [];
    const seen = new Set<string>();
    for (const row of selectedRows) {
      const itemId = row.original.setlistItemId;
      if (itemId && !seen.has(itemId)) {
        seen.add(itemId);
        itemIds.push(itemId);
      }
    }

    if (itemIds.length === 0) {
      toast.info("No valid items selected.", { duration: 2500 });
      return;
    }

    const confirmed = window.confirm(
      `Remove ${itemIds.length} item${itemIds.length === 1 ? "" : "s"} from this setlist?`
    );
    if (!confirmed) return;

    try {
      setIsMutatingItems(true);
      let removedCount = 0;

      for (const itemId of itemIds) {
        try {
          await removeSetlistItem(db, progId, itemId, uid);
          removedCount++;
        } catch {
          toast.error(`Failed to remove an item.`);
        }
      }

      if (removedCount > 0) {
        incrementTuneSetListChanged();
        void refetchSetlists();
        toast.success(
          `Removed ${removedCount} item${removedCount === 1 ? "" : "s"} from this Setlist.`,
          {
            duration: 2500,
          }
        );
      }

      // Clear selection after bulk remove
      table.resetRowSelection();
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Failed to remove Setlist items"
      );
    } finally {
      setIsMutatingItems(false);
    }
  };

  const handleNotYetImplemented = () => {
    window.alert("Not yet implemented");
  };

  const handleViewModeEdit = () => {
    if (!canManage()) {
      toast.error(
        "You need to be a manager (admin or owner) to edit this setlist.",
        { duration: 5000 }
      );
      return;
    }
    handleStartEdit();
  };

  const handleViewModeCreate = () => {
    if (!canManage()) {
      toast.error(
        "You need to be a manager (admin or owner) of this group to create setlists.",
        { duration: 5000 }
      );
      return;
    }
    handleStartCreate();
  };

  const handleColumnsToggle = () => {
    if (!viewTable()) return;
    setShowColumnsDropdown((open) => !open);
  };

  const handleLibraryColumnsToggle = () => {
    if (!libraryTable()) return;
    setShowLibraryColumnsDropdown((open) => !open);
  };

  const handleEditorColumnsToggle = () => {
    if (!editorTable()) return;
    setShowEditorColumnsDropdown((open) => !open);
  };

  const openDisplayOptions = () => {
    if (!viewTable()) return;
    setPendingDisplayOptionsOpen(true);
    setShowOverflowMenu(false);
  };

  const openLibraryDisplayOptions = () => {
    if (!libraryTable()) return;
    setShowLibraryPanelMenu(false);
    queueMicrotask(() => setShowLibraryColumnsDropdown(true));
  };

  const openEditorDisplayOptions = () => {
    if (!editorTable()) return;
    setShowSetlistPanelMenu(false);
    queueMicrotask(() => setShowEditorColumnsDropdown(true));
  };

  const displayOptionsTriggerRef = () =>
    isMobile() ? mobileOverflowButtonRef : columnsButtonRef;
  const libraryDisplayOptionsTriggerRef = () =>
    isMobile() ? mobileLibraryOverflowButtonRef : libraryColumnsButtonRef;
  const editorDisplayOptionsTriggerRef = () =>
    isMobile() ? mobileSetlistOverflowButtonRef : editorColumnsButtonRef;

  const mobileMenuItemClasses =
    "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-left text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-800";

  useRegisterMobileControlBar(() => {
    if (!isMobile()) return undefined;

    return (
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <select
          value={selectedGroupId() ?? ""}
          onChange={(e) => {
            setSelectedGroupId(e.currentTarget.value || null);
            setSelectedSetlistId(null);
          }}
          class="h-10 min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          data-testid="setlists-group-select-mobile"
          aria-label="Select group"
        >
          <Show when={(groups() ?? []).length === 0}>
            <option value="">No groups</option>
          </Show>
          <For each={groups() ?? []}>
            {(group) => <option value={group.id}>{group.name}</option>}
          </For>
        </select>

        <select
          value={selectedSetlistId() ?? ""}
          onChange={(e) => {
            setSelectedSetlistId(e.currentTarget.value || null);
            if (isEditing()) handleCancelEdit();
          }}
          class="h-10 min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          data-testid="setlists-setlist-select-mobile"
          aria-label="Select setlist"
        >
          <Show when={(groupSetlists() ?? []).length === 0}>
            <option value="">No setlists</option>
          </Show>
          <For each={groupSetlists() ?? []}>
            {(prog) => <option value={prog.id}>{prog.name}</option>}
          </For>
        </select>

        <DropdownMenu
          open={showOverflowMenu()}
          onOpenChange={setShowOverflowMenu}
        >
          <DropdownMenu.Trigger
            ref={mobileOverflowButtonRef}
            type="button"
            data-testid="setlists-overflow-button"
            aria-label="More options"
            class="flex h-10 w-10 flex-none items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <EllipsisVertical class="h-4 w-4" />
            <span class="sr-only">More options</span>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content class="z-50 min-w-[16rem] rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
              <Show
                when={!isEditing()}
                fallback={
                  <>
                    <button
                      type="button"
                      data-testid="setlists-overflow-done-button"
                      class={mobileMenuItemClasses}
                      disabled={
                        isSaving() ||
                        isMutatingItems() ||
                        (isCreating() && !hasValidSetlistName())
                      }
                      onClick={() => {
                        setShowOverflowMenu(false);
                        void handleSaveAndClose();
                      }}
                    >
                      <span>
                        {isSaving()
                          ? "Saving..."
                          : isCreating()
                            ? "Create Setlist"
                            : "Done Editing"}
                      </span>
                    </button>

                    <Show when={!isCreating() && !!selectedSetlistId()}>
                      <button
                        type="button"
                        data-testid="setlists-overflow-delete-button"
                        class={mobileMenuItemClasses}
                        disabled={
                          isSaving() ||
                          isMutatingItems() ||
                          deletingSetlistId() === selectedSetlistId()
                        }
                        onClick={() => {
                          setShowOverflowMenu(false);
                          if (!canManage()) {
                            toast.error(
                              "You need to be a manager (admin or owner) to delete this setlist.",
                              { duration: 5000 }
                            );
                            return;
                          }
                          void handleDeleteSetlist();
                        }}
                      >
                        <span>
                          {deletingSetlistId() === selectedSetlistId()
                            ? "Deleting..."
                            : "Delete"}
                        </span>
                      </button>
                    </Show>

                    <div class="my-1 h-px bg-gray-200 dark:bg-gray-700" />

                    <button
                      type="button"
                      data-testid="setlists-overflow-library-toggle-button"
                      class={mobileMenuItemClasses}
                      onClick={() => {
                        setShowOverflowMenu(false);
                        setLibraryPanelOpen((open) => !open);
                      }}
                    >
                      <span>
                        {libraryPanelOpen() ? "Hide Library" : "Show Library"}
                      </span>
                    </button>
                  </>
                }
              >
                <button
                  type="button"
                  data-testid="setlists-overflow-edit-button"
                  class={mobileMenuItemClasses}
                  disabled={!selectedSetlistId()}
                  onClick={() => {
                    setShowOverflowMenu(false);
                    handleViewModeEdit();
                  }}
                >
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  data-testid="setlists-overflow-new-button"
                  class={mobileMenuItemClasses}
                  disabled={!selectedGroupId()}
                  onClick={() => {
                    setShowOverflowMenu(false);
                    handleViewModeCreate();
                  }}
                >
                  <span>New Setlist</span>
                </button>

                <button
                  type="button"
                  data-testid="setlists-overflow-print-button"
                  class={mobileMenuItemClasses}
                  onClick={() => {
                    setShowOverflowMenu(false);
                    handleNotYetImplemented();
                  }}
                >
                  <span>Print</span>
                </button>

                <button
                  type="button"
                  data-testid="setlists-overflow-email-button"
                  class={mobileMenuItemClasses}
                  onClick={() => {
                    setShowOverflowMenu(false);
                    handleNotYetImplemented();
                  }}
                >
                  <span>Email</span>
                </button>

                <div class="my-1 h-px bg-gray-200 dark:bg-gray-700" />

                <button
                  type="button"
                  data-testid="display-options-entry-button"
                  class={mobileMenuItemClasses}
                  disabled={!viewTable()}
                  onClick={openDisplayOptions}
                >
                  <span>Display Options</span>
                  <ChevronRight class="h-4 w-4 text-gray-400 dark:text-gray-500" />
                </button>
              </Show>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu>
      </div>
    );
  });

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div class="flex h-full flex-col bg-gray-50 dark:bg-gray-900">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div class="hidden shrink-0 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800 md:block">
        <div class="flex items-center gap-3 overflow-x-auto md:flex-wrap md:overflow-visible">
          {/* Group selector */}
          <div class="flex shrink-0 items-center gap-2">
            <button
              type="button"
              class="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300 md:text-sm"
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
              class="w-28 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white md:w-auto md:px-3 md:text-sm"
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
          <div class="flex shrink-0 items-center gap-2">
            <label
              for="setlists-setlist-select"
              class="text-xs font-medium text-gray-700 dark:text-gray-300 md:text-sm"
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
              class="w-36 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white md:w-auto md:px-3 md:text-sm"
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

          <div class="h-6 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />

          {/* Edit toggle + actions */}
          <Show
            when={!isEditing()}
            fallback={
              /* Editing toolbar actions */
              <div class="flex shrink-0 items-center gap-2">
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
                <Show when={!isCreating() && !!selectedSetlistId()}>
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
                    disabled={
                      isSaving() ||
                      isMutatingItems() ||
                      deletingSetlistId() === selectedSetlistId()
                    }
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
            }
          >
            {/* Always-visible view-mode toolbar buttons.
                Buttons are always present to avoid layout shifts; permission
                denials surface a toast instead of hiding the control. */}
            <div class="flex min-w-0 flex-1 items-center gap-2">
              <div class="hidden items-center gap-2 md:flex">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  class={
                    canManage()
                      ? "text-blue-700 hover:bg-blue-50 dark:text-blue-200 dark:hover:bg-blue-950/20"
                      : "opacity-50"
                  }
                  onClick={handleViewModeEdit}
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
                  onClick={handleViewModeCreate}
                  disabled={!selectedGroupId()}
                  data-testid="setlists-new-button"
                >
                  <Plus size={14} class="mr-1.5" />
                  New Setlist
                </Button>
              </div>

              <div class="hidden flex-1 md:block" />

              <div class="hidden items-center gap-2 md:flex">
                <button
                  type="button"
                  onClick={handleNotYetImplemented}
                  class="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  data-testid="setlists-print-button"
                  title="Print setlist"
                >
                  <Printer size={14} aria-hidden="true" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={handleNotYetImplemented}
                  class="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  data-testid="setlists-email-button"
                  title="Email setlist"
                >
                  <Mail size={14} aria-hidden="true" />
                  <span>Email</span>
                </button>
                <button
                  ref={columnsButtonRef}
                  type="button"
                  onClick={handleColumnsToggle}
                  class="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  data-testid="setlists-columns-button"
                  disabled={!viewTable()}
                  aria-expanded={showColumnsDropdown()}
                  title="Display options"
                >
                  <Columns size={14} aria-hidden="true" />
                  <span>Display Options</span>
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          </Show>
        </div>
      </div>

      <Show when={!isEditing() && showColumnsDropdown() && viewTable()}>
        <ColumnVisibilityMenu
          table={viewTable()!}
          isOpen={showColumnsDropdown()}
          onClose={() => setShowColumnsDropdown(false)}
          triggerRef={displayOptionsTriggerRef()}
          closeGuardRef={isMobile() ? null : undefined}
          title="Display Options"
        />
      </Show>

      <Show
        when={isEditing() && showLibraryColumnsDropdown() && libraryTable()}
      >
        <ColumnVisibilityMenu
          table={libraryTable()!}
          isOpen={showLibraryColumnsDropdown()}
          onClose={() => setShowLibraryColumnsDropdown(false)}
          triggerRef={libraryDisplayOptionsTriggerRef()}
          closeGuardRef={isMobile() ? null : undefined}
          title="Display Options"
        />
      </Show>

      <Show when={isEditing() && showEditorColumnsDropdown() && editorTable()}>
        <ColumnVisibilityMenu
          table={editorTable()!}
          isOpen={showEditorColumnsDropdown()}
          onClose={() => setShowEditorColumnsDropdown(false)}
          triggerRef={editorDisplayOptionsTriggerRef()}
          closeGuardRef={isMobile() ? null : undefined}
          title="Display Options"
        />
      </Show>

      {/* ── Content Area ────────────────────────────────────────────────── */}
      <div
        class={`min-h-0 flex-1 overflow-hidden ${
          selectedGroupId() && !isEditing() && selectedSetlist()
            ? ""
            : "p-4 sm:p-6"
        }`}
      >
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
                <div class="flex h-full min-h-0 flex-col">
                  {/* Setlist items list */}
                  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-gray-800">
                    {/* Setlist title and metadata, hidden for now, remove the div to show */}
                    <div class="hidden items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                      <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                        <div class="flex items-center justify-between gap-3">
                          <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2 overflow-hidden whitespace-nowrap">
                              <h3 class="shrink-0 text-sm font-semibold text-gray-900 dark:text-white">
                                {prog().name}
                              </h3>
                              <Show when={prog().groupName}>
                                <span class="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                                  •
                                </span>
                                <span class="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                                  Group: {prog().groupName}
                                </span>
                              </Show>
                              <Show when={prog().description}>
                                <span class="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                                  •
                                </span>
                                <span
                                  class="min-w-0 truncate text-xs text-gray-500 dark:text-gray-400"
                                  title={prog().description ?? undefined}
                                >
                                  {prog().description}
                                </span>
                              </Show>
                            </div>
                          </div>
                        </div>
                        <span class="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          {prog().itemCount} item
                          {prog().itemCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                    <Show
                      when={(setlistItems() ?? []).length > 0}
                      fallback={
                        <div class="flex flex-1 items-center justify-center px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                          This setlist is empty. Add tunes or tune sets by
                          editing.
                        </div>
                      }
                    >
                      <div class="min-h-0 flex-1 overflow-hidden">
                        <TunesGrid
                          tablePurpose="setlists"
                          userId={gridUserId("view")}
                          data={setlistGridRows().rows}
                          columns={setlistViewColumns()}
                          currentRowId={currentTuneId() ?? undefined}
                          onRowClick={handleGridRowClick}
                          enableColumnReorder={true}
                          enableRowSelection={false}
                          getRowId={getSetlistGridRowId}
                          getSubRows={getSetlistGridSubRows}
                          hierarchyColumnId="title"
                          onTableReady={(table) => {
                            setViewTable(table);
                          }}
                          getRowProps={(row) =>
                            row.setlistPosition != null
                              ? { "data-testid": "setlist-item-row" }
                              : undefined
                          }
                        />
                      </div>
                    </Show>

                    <div class="border-t border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-800 flex-shrink-0">
                      <div class="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                        <span>
                          {prog().itemCount}{" "}
                          {prog().itemCount === 1 ? "item" : "items"} in setlist
                        </span>
                        <span>
                          {setlistGridRows().rows.length}{" "}
                          {setlistGridRows().rows.length === 1
                            ? "top-level item"
                            : "top-level items"}
                        </span>
                      </div>
                    </div>
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
                  <div class="flex flex-wrap items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700 md:gap-y-3 md:px-4 md:py-3">
                    <div class="hidden min-w-0 flex-1 md:block">
                      <h3 class="truncate text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 md:text-sm">
                        Group Catalog
                      </h3>
                      <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        Search tunes and tune sets to add to this setlist.
                      </p>
                    </div>

                    <div class="order-1 relative min-w-0 flex-1 md:order-3 md:basis-0">
                      <Search
                        size={14}
                        class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        type="text"
                        value={libraryQuery()}
                        onInput={(e) => setLibraryQuery(e.currentTarget.value)}
                        placeholder="Search tunes and tune sets"
                        class="h-8 w-full rounded-md border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white md:h-9 md:text-sm"
                        data-testid="setlists-library-search"
                      />
                    </div>

                    <div class="order-2 flex shrink-0 items-center gap-2 md:order-2">
                      <Button
                        type="button"
                        variant="accent"
                        size="sm"
                        class="h-8 px-2 text-xs md:h-9 md:px-3 md:text-sm"
                        onClick={() => void handleAddSelected()}
                        disabled={
                          librarySelectionCount() === 0 ||
                          !hasValidSetlistName() ||
                          isMutatingItems() ||
                          isSaving()
                        }
                        data-testid="setlists-add-selected-button"
                      >
                        <Plus size={14} class="mr-1 sm:mr-1.5" />
                        Add
                        <Show when={librarySelectionCount() > 0}>
                          <span class="ml-1">({librarySelectionCount()})</span>
                        </Show>
                      </Button>

                      <DropdownMenu
                        open={showLibraryPanelMenu()}
                        onOpenChange={setShowLibraryPanelMenu}
                      >
                        <DropdownMenu.Trigger
                          ref={mobileLibraryOverflowButtonRef}
                          type="button"
                          aria-label="Group catalog options"
                          data-testid="setlists-library-panel-overflow-button"
                          class="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 md:hidden"
                        >
                          <EllipsisVertical class="h-4 w-4" />
                          <span class="sr-only">Group catalog options</span>
                        </DropdownMenu.Trigger>

                        <DropdownMenu.Portal>
                          <DropdownMenu.Content class="z-50 min-w-[14rem] rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                            <div class="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                              Filter Library
                            </div>
                            {(["all", "tune", "tune_set"] as const).map(
                              (filter) => (
                                <button
                                  type="button"
                                  class={mobileMenuItemClasses}
                                  onClick={() => {
                                    setLibraryFilter(filter);
                                    setShowLibraryPanelMenu(false);
                                  }}
                                  data-testid={`setlists-library-filter-menu-${filter}`}
                                >
                                  <span>
                                    {filter === "all"
                                      ? "All"
                                      : filter === "tune"
                                        ? "Tunes"
                                        : "Sets"}
                                  </span>
                                  <Show when={libraryFilter() === filter}>
                                    <span class="text-blue-600 dark:text-blue-400">
                                      Selected
                                    </span>
                                  </Show>
                                </button>
                              )
                            )}

                            <div class="my-1 h-px bg-gray-200 dark:bg-gray-700" />

                            <button
                              type="button"
                              class={mobileMenuItemClasses}
                              disabled={!libraryTable()}
                              onClick={openLibraryDisplayOptions}
                              data-testid="setlists-library-display-options-menu-button"
                            >
                              <span>Display Options</span>
                              <ChevronRight class="h-4 w-4 text-gray-400 dark:text-gray-500" />
                            </button>

                            <div class="my-1 h-px bg-gray-200 dark:bg-gray-700" />

                            <button
                              type="button"
                              class={mobileMenuItemClasses}
                              onClick={() => {
                                setLibraryPanelOpen(false);
                                setShowLibraryPanelMenu(false);
                              }}
                              data-testid="setlists-library-hide-button"
                            >
                              <span>Hide Library</span>
                            </button>
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3">
                    {/* Search + filter */}
                    <div class="hidden min-w-0 items-center justify-between gap-2 overflow-x-auto md:flex">
                      <div class="flex shrink-0 items-center gap-1 whitespace-nowrap">
                        {(["all", "tune", "tune_set"] as const).map(
                          (filter) => (
                            <button
                              type="button"
                              class={`rounded-md px-2 py-1 text-[11px] font-medium md:px-2.5 md:py-1.5 md:text-xs ${
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
                      <button
                        ref={libraryColumnsButtonRef}
                        type="button"
                        onClick={handleLibraryColumnsToggle}
                        class="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                        data-testid="setlists-library-columns-button"
                        disabled={!libraryTable()}
                        aria-expanded={showLibraryColumnsDropdown()}
                        title="Display options"
                      >
                        <Columns size={14} aria-hidden="true" />
                        <span>Display Options</span>
                        <ChevronDown size={14} aria-hidden="true" />
                      </button>
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
                          enableRowSelection={true}
                          enableSubRowSelection={false}
                          canSelectRow={(row) => !!row.sourceId}
                          normalizeRowSelection={(next, prev, helpers) =>
                            normalizeExclusiveLibrarySelection(
                              next,
                              prev,
                              helpers.getRow
                            )
                          }
                          onSelectionChange={setLibrarySelectionCount}
                          onTableReady={(table) => {
                            libraryTableRef = table;
                            setLibraryTable(table);
                          }}
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
                  <Show
                    when={metadataExpanded()}
                    fallback={
                      <div class="flex min-w-0 items-center gap-2 md:gap-3">
                        <button
                          type="button"
                          class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                          onClick={() => setMetadataExpanded(true)}
                          aria-label="Expand setlist details"
                          data-testid="setlist-build-header-toggle"
                        >
                          <ChevronRight size={16} aria-hidden="true" />
                        </button>
                        <label
                          for="setlist-editor-name-collapsed"
                          class="hidden text-sm font-medium text-gray-700 dark:text-gray-300 md:block"
                        >
                          Setlist Name:
                        </label>
                        <input
                          id="setlist-editor-name-collapsed"
                          type="text"
                          value={editorName()}
                          onInput={(e) => setEditorName(e.currentTarget.value)}
                          class={`min-w-0 flex-1 rounded-md border bg-white px-3 py-1.5 text-xs text-gray-900 dark:bg-gray-800 dark:text-white md:min-w-[14rem] md:py-2 md:text-sm ${
                            !hasValidSetlistName()
                              ? "border-red-400 ring-1 ring-red-400/40"
                              : "border-gray-300 dark:border-gray-600"
                          }`}
                          placeholder="Festival opener"
                          data-testid="setlist-editor-name-input-collapsed"
                        />
                        <DropdownMenu
                          open={showSetlistPanelMenu()}
                          onOpenChange={setShowSetlistPanelMenu}
                        >
                          <DropdownMenu.Trigger
                            ref={mobileSetlistOverflowButtonRef}
                            type="button"
                            aria-label="Setlist panel options"
                            data-testid="setlists-setlist-panel-overflow-button"
                            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 md:hidden"
                          >
                            <EllipsisVertical class="h-4 w-4" />
                            <span class="sr-only">Setlist panel options</span>
                          </DropdownMenu.Trigger>

                          <DropdownMenu.Portal>
                            <DropdownMenu.Content class="z-50 min-w-[14rem] rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                              <div class="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                {(setlistItems() ?? []).length} item
                                {(setlistItems() ?? []).length === 1 ? "" : "s"}
                              </div>

                              <button
                                type="button"
                                class={mobileMenuItemClasses}
                                disabled={
                                  !hasValidSetlistName() ||
                                  editorSelectionCount() === 0 ||
                                  isMutatingItems() ||
                                  isSaving()
                                }
                                onClick={() => {
                                  setShowSetlistPanelMenu(false);
                                  void handleRemoveSelected();
                                }}
                                data-testid="setlists-remove-selected-menu-button"
                              >
                                <span>Remove Selected</span>
                                <Show when={editorSelectionCount() > 0}>
                                  <span>({editorSelectionCount()})</span>
                                </Show>
                              </button>

                              <div class="my-1 h-px bg-gray-200 dark:bg-gray-700" />

                              <button
                                type="button"
                                class={mobileMenuItemClasses}
                                disabled={!editorTable()}
                                onClick={openEditorDisplayOptions}
                                data-testid="setlists-editor-display-options-menu-button"
                              >
                                <span>Display Options</span>
                                <ChevronRight class="h-4 w-4 text-gray-400 dark:text-gray-500" />
                              </button>
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu>
                        <Show when={!hasValidSetlistName()}>
                          <span class="hidden text-xs font-medium text-red-600 dark:text-red-400 md:block">
                            Required before adding, removing, or reordering
                            items.
                          </span>
                        </Show>
                      </div>
                    }
                  >
                    <div class="flex items-center gap-3">
                      <button
                        type="button"
                        class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                        onClick={() => setMetadataExpanded(false)}
                        aria-label="Collapse setlist details"
                        data-testid="setlist-build-header-toggle"
                      >
                        <ChevronDown size={16} aria-hidden="true" />
                      </button>
                      <div class="min-w-0 flex-1">
                        <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Setlist Build
                        </h3>
                        <Show when={!hasValidSetlistName()}>
                          <p class="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                            Setlist name is required before adding, removing, or
                            reordering items.
                          </p>
                        </Show>
                      </div>
                      <DropdownMenu
                        open={showSetlistPanelMenu()}
                        onOpenChange={setShowSetlistPanelMenu}
                      >
                        <DropdownMenu.Trigger
                          ref={mobileSetlistOverflowButtonRef}
                          type="button"
                          aria-label="Setlist panel options"
                          data-testid="setlists-setlist-panel-overflow-button"
                          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 md:hidden"
                        >
                          <EllipsisVertical class="h-4 w-4" />
                          <span class="sr-only">Setlist panel options</span>
                        </DropdownMenu.Trigger>

                        <DropdownMenu.Portal>
                          <DropdownMenu.Content class="z-50 min-w-[14rem] rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                            <div class="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                              {(setlistItems() ?? []).length} item
                              {(setlistItems() ?? []).length === 1 ? "" : "s"}
                            </div>

                            <button
                              type="button"
                              class={mobileMenuItemClasses}
                              disabled={
                                !hasValidSetlistName() ||
                                editorSelectionCount() === 0 ||
                                isMutatingItems() ||
                                isSaving()
                              }
                              onClick={() => {
                                setShowSetlistPanelMenu(false);
                                void handleRemoveSelected();
                              }}
                              data-testid="setlists-remove-selected-menu-button"
                            >
                              <span>Remove Selected</span>
                              <Show when={editorSelectionCount() > 0}>
                                <span>({editorSelectionCount()})</span>
                              </Show>
                            </button>

                            <div class="my-1 h-px bg-gray-200 dark:bg-gray-700" />

                            <button
                              type="button"
                              class={mobileMenuItemClasses}
                              disabled={!editorTable()}
                              onClick={openEditorDisplayOptions}
                              data-testid="setlists-editor-display-options-menu-button"
                            >
                              <span>Display Options</span>
                              <ChevronRight class="h-4 w-4 text-gray-400 dark:text-gray-500" />
                            </button>
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu>
                    </div>
                  </Show>
                </div>

                <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
                  {/* Collapsible metadata section */}
                  <Show when={metadataExpanded()}>
                    <div class="space-y-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
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
                            !hasValidSetlistName()
                              ? "border-red-400 ring-1 ring-red-400/40"
                              : "border-gray-300 dark:border-gray-600"
                          }`}
                          placeholder="Festival opener"
                          data-testid="setlist-editor-name-input"
                        />
                        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Required before adding, removing, or reordering items
                          in the setlist.
                        </p>
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
                  </Show>

                  {/* Items list */}
                  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-gray-900/50">
                    <div class="hidden items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700 md:flex md:px-4">
                      <div class="flex min-w-0 items-center gap-1.5">
                        <span class="truncate text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 md:text-xs">
                          Setlist Items
                        </span>
                        <span class="shrink-0 text-[11px] text-gray-500 dark:text-gray-400 md:text-xs">
                          {(setlistItems() ?? []).length} item
                          {(setlistItems() ?? []).length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div class="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="destructive-ghost"
                          size="sm"
                          class="h-8 px-2 text-xs md:h-9 md:px-3 md:text-sm"
                          onClick={() => void handleRemoveSelected()}
                          disabled={
                            !hasValidSetlistName() ||
                            editorSelectionCount() === 0 ||
                            isMutatingItems() ||
                            isSaving()
                          }
                          data-testid="setlists-remove-selected-button"
                        >
                          <Trash2 size={14} class="mr-1 md:mr-1.5" />
                          Remove
                          <Show when={editorSelectionCount() > 0}>
                            <span class="ml-1">({editorSelectionCount()})</span>
                          </Show>
                        </Button>
                        <button
                          ref={editorColumnsButtonRef}
                          type="button"
                          onClick={handleEditorColumnsToggle}
                          class="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                          data-testid="setlists-editor-columns-button"
                          disabled={!editorTable()}
                          aria-expanded={showEditorColumnsDropdown()}
                          title="Display options"
                        >
                          <Columns size={14} aria-hidden="true" />
                          <span>Display Options</span>
                          <ChevronDown size={14} aria-hidden="true" />
                        </button>
                      </div>
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
                          enableRowSelection={true}
                          canSelectRow={(row) =>
                            !!row.setlistItemId && row.setlistPosition != null
                          }
                          onSelectionChange={setEditorSelectionCount}
                          onTableReady={(table) => {
                            editorTableRef = table;
                            setEditorTable(table);
                          }}
                          getRowId={getSetlistGridRowId}
                          getSubRows={getSetlistGridSubRows}
                          hierarchyColumnId="title"
                          getRowProps={(row) =>
                            row.setlistItemId && row.setlistPosition != null
                              ? {
                                  class: [
                                    draggedItemId() === row.setlistItemId
                                      ? "opacity-60"
                                      : "",
                                    dropTargetId() === row.setlistItemId &&
                                    draggedItemId() !== row.setlistItemId
                                      ? "border-t-2 border-t-blue-400 dark:border-t-blue-500"
                                      : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" "),
                                  "data-testid": "setlist-editor-item-row",
                                  "data-setlist-item-id":
                                    row.setlistItemId ?? undefined,
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
