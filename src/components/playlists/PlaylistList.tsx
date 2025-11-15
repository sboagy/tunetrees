/**
 * Playlist List Component - Table-Centric Design
 *
 * Displays a searchable, sortable table of user's playlists.
 * Features:
 * - TanStack Solid Table for information-dense display
 * - Search by playlist ID
 * - Sortable columns
 * - Click rows to edit playlist
 * - Delete action (soft delete)
 *
 * @module components/playlists/PlaylistList
 */

import {
  type ColumnDef,
  createSolidTable,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
} from "@tanstack/solid-table";
import { Pencil, Trash2 } from "lucide-solid";
import {
  type Component,
  createMemo,
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";
import {
  deletePlaylist,
  getUserPlaylists,
} from "../../lib/db/queries/playlists";
import type { PlaylistWithSummary } from "../../lib/db/types";

interface PlaylistListProps {
  /** Callback when a playlist is selected for editing */
  onPlaylistSelect?: (playlist: PlaylistWithSummary) => void;
  /** Callback when a playlist is deleted */
  onPlaylistDeleted?: (playlistId: string) => void;
  /** Include soft-deleted playlists */
  includeDeleted?: boolean;
}

/**
 * Playlist List Component
 *
 * @example
 * ```tsx
 * <PlaylistList onPlaylistSelect={(playlist) => navigate(`/playlists/${playlist.playlistId}`)} />
 * ```
 */
export const PlaylistList: Component<PlaylistListProps> = (props) => {
  const { user, localDb, repertoireListChanged } = useAuth();

  // I commented out the search box.  -sb
  const [searchQuery, _setSearchQuery] = createSignal("");
  const [sorting, setSorting] = createSignal<SortingState>([]);
  const [deletingId, setDeletingId] = createSignal<string | null>(null);

  // Fetch playlists from local database
  const [playlists, { refetch }] = createResource(
    () => {
      const userId = user()?.id;
      const db = localDb();
      const changeCount = repertoireListChanged(); // Track changes
      return userId && db ? { userId, db, changeCount } : null;
    },
    async (params) => {
      if (!params) return [];
      return await getUserPlaylists(
        params.db,
        params.userId,
        props.includeDeleted ?? false
      );
    }
  );

  // Filter playlists based on search
  const filteredPlaylists = createMemo(() => {
    const allPlaylists = playlists() || [];
    const query = searchQuery().toLowerCase();

    if (!query) {
      return allPlaylists;
    }

    return allPlaylists.filter((playlist: PlaylistWithSummary) => {
      // Search by playlist ID
      const matchesId = playlist.playlistId.toString().includes(query);
      // Search by instrument
      const matchesInstrument = playlist.instrumentRef
        ? playlist.instrumentRef.toString().includes(query)
        : false;

      return matchesId || matchesInstrument;
    });
  });

  // Handle delete action
  const handleDelete = async (playlistId: string) => {
    const userId = user()?.id;
    const db = localDb();
    if (!userId || !db) {
      console.error("Cannot delete playlist: missing user or database");
      return;
    }

    // Confirm deletion
    const confirmed = window.confirm(
      "Are you sure you want to delete this playlist? All associated tune assignments will be removed."
    );
    if (!confirmed) return;

    try {
      setDeletingId(playlistId);
      await deletePlaylist(db, playlistId, userId);

      // Notify parent
      props.onPlaylistDeleted?.(playlistId);

      // Refresh list
      refetch();
    } catch (error) {
      console.error("Failed to delete playlist:", error);
      alert(
        `Failed to delete playlist: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setDeletingId(null);
    }
  };

  // Define table columns
  const columns: ColumnDef<PlaylistWithSummary>[] = [
    {
      accessorKey: "playlistId",
      header: "ID",
      size: 80,
      cell: (info) => {
        const fullId = info.getValue() as string;
        // Show last 8 characters of UUID for readability
        const shortId = fullId.slice(-8);
        return (
          <span
            class="text-gray-600 dark:text-gray-400 font-mono text-xs"
            title={fullId}
          >
            {shortId}
          </span>
        );
      },
    },
    {
      accessorKey: "name",
      header: "Name",
      size: 200,
      cell: (info) => {
        const value = info.getValue() as string | null;
        return (
          <Show
            when={value}
            fallback={<span class="text-gray-400 italic">Untitled</span>}
          >
            <span class="font-semibold text-gray-900 dark:text-white">
              {value}
            </span>
          </Show>
        );
      },
    },
    {
      accessorKey: "genreDefault",
      header: "Genre",
      size: 100,
      cell: (info) => {
        const value = info.getValue() as string | null;
        return (
          <Show when={value} fallback={<span class="text-gray-400">—</span>}>
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
              {value}
            </span>
          </Show>
        );
      },
    },
    {
      accessorKey: "instrumentName",
      header: "Instrument",
      size: 150,
      cell: (info) => {
        const value = info.getValue() as string | null;
        return (
          <Show when={value} fallback={<span class="text-gray-400">—</span>}>
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
              {value}
            </span>
          </Show>
        );
      },
    },
    {
      accessorKey: "srAlgType",
      header: "Algorithm",
      size: 90,
      cell: (info) => {
        const value = (info.getValue() as string | null) || "fsrs";
        return (
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
            {value.toUpperCase()}
          </span>
        );
      },
    },
    {
      accessorKey: "tuneCount",
      header: "Tunes",
      size: 70,
      cell: (info) => {
        const count = info.getValue() as number;
        return (
          <span class="font-semibold text-gray-900 dark:text-white">
            {count}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      size: 100,
      cell: (info) => {
        const playlist = info.row.original;
        const isDeleting = deletingId() === playlist.playlistId;

        return (
          <div class="flex gap-2 items-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                props.onPlaylistSelect?.(playlist);
              }}
              class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors p-1"
              disabled={isDeleting}
              title="Edit playlist"
              aria-label="Edit playlist"
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(playlist.playlistId);
              }}
              class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors p-1"
              disabled={isDeleting}
              title={isDeleting ? "Deleting..." : "Delete playlist"}
              aria-label={isDeleting ? "Deleting playlist" : "Delete playlist"}
            >
              <Trash2 size={16} />
            </button>
          </div>
        );
      },
    },
  ];

  // Create table instance
  const table = createSolidTable({
    get data() {
      return filteredPlaylists();
    },
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      get sorting() {
        return sorting();
      },
    },
    onSortingChange: setSorting,
  });

  const handleRowClick = (playlist: PlaylistWithSummary) => {
    props.onPlaylistSelect?.(playlist);
  };

  return (
    <div class="w-full">
      {/* Search Bar */}
      <div class="mb-4 space-y-3">
        {/* Search Input */}
        {/* <div>
          <label
            for="playlist-search"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Search Playlists
          </label>
          <input
            id="playlist-search"
            type="text"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            placeholder="Search by playlist ID or instrument..."
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
          />
        </div> */}

        {/* Results Count */}
        <div class="flex items-center justify-between">
          <div class="text-sm text-gray-600 dark:text-gray-400">
            <Show
              when={!playlists.loading}
              fallback={<span>Loading playlists...</span>}
            >
              Showing {filteredPlaylists().length} of {playlists()?.length || 0}{" "}
              playlists
            </Show>
          </div>
        </div>
      </div>

      {/* Table */}
      <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <Show
          when={!playlists.loading}
          fallback={
            <div class="text-center py-12 bg-white dark:bg-gray-800">
              <div class="animate-spin h-12 w-12 mx-auto border-4 border-blue-600 border-t-transparent rounded-full" />
              <p class="mt-4 text-gray-600 dark:text-gray-400">
                Loading playlists...
              </p>
            </div>
          }
        >
          <Show
            when={filteredPlaylists().length > 0}
            fallback={
              <div class="text-center py-12 bg-gray-50 dark:bg-gray-800">
                <p class="text-lg text-gray-600 dark:text-gray-400">
                  No playlists found
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-500 mt-2">
                  Create your first playlist to get started
                </p>
              </div>
            }
          >
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-200 dark:bg-gray-800 sticky top-0">
                  <For each={table.getHeaderGroups()}>
                    {(headerGroup) => (
                      <tr>
                        <For each={headerGroup.headers}>
                          {(header) => (
                            <th
                              scope="col"
                              class="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-700 select-none"
                              style={{
                                width: header.column.columnDef.size
                                  ? `${header.column.columnDef.size}px`
                                  : "auto",
                              }}
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              <div class="flex items-center gap-2">
                                {flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                                <span class="text-gray-400">
                                  {{
                                    asc: " ↑",
                                    desc: " ↓",
                                  }[header.column.getIsSorted() as string] ??
                                    ""}
                                </span>
                              </div>
                            </th>
                          )}
                        </For>
                      </tr>
                    )}
                  </For>
                </thead>
                <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  <For each={table.getRowModel().rows}>
                    {(row) => (
                      <tr
                        class="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                        onClick={() => handleRowClick(row.original)}
                      >
                        <For each={row.getVisibleCells()}>
                          {(cell) => (
                            <td class="px-4 py-2 whitespace-nowrap text-sm">
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </td>
                          )}
                        </For>
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
  );
};
