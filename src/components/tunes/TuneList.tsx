/**
 * Tune List Component - Table-Centric Design
 *
 * Displays a searchable, filterable, sortable table of tunes.
 * Features:
 * - TanStack Solid Table for information-dense display
 * - Search by title/incipit
 * - Filter by type, mode, genre
 * - Sortable columns
 * - Click rows to view details
 *
 * @module components/tunes/TuneList
 */

import {
  type ColumnDef,
  createSolidTable,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
} from "@tanstack/solid-table";
import {
  type Component,
  createMemo,
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";
import { getTunesForUser } from "../../lib/db/queries/tunes";
import type { Tune } from "../../lib/db/types";

interface TuneListProps {
  /** Callback when a tune is selected */
  onTuneSelect?: (tune: Tune) => void;
  /** Show only user's private tunes */
  privateOnly?: boolean;
}

/**
 * Tune List Component
 *
 * @example
 * ```tsx
 * <TuneList onTuneSelect={(tune) => navigate(`/tunes/${tune.id}`)} />
 * ```
 */
export const TuneList: Component<TuneListProps> = (props) => {
  const { user, localDb } = useAuth();
  const [searchQuery, setSearchQuery] = createSignal("");
  const [filterType, setFilterType] = createSignal<string>("");
  const [filterMode, setFilterMode] = createSignal<string>("");
  const [sorting, setSorting] = createSignal<SortingState>([]);

  // Fetch tunes from local database
  const [tunes] = createResource(
    () => {
      const userId = user()?.id;
      const db = localDb();
      return userId && db ? { userId, db } : null;
    },
    async (params) => {
      if (!params) return [];
      return await getTunesForUser(params.db, params.userId);
    }
  );

  // Filter tunes based on search and filters
  const filteredTunes = createMemo(() => {
    const allTunes = tunes() || [];
    const query = searchQuery().toLowerCase();
    const type = filterType();
    const mode = filterMode();

    return allTunes.filter((tune: Tune) => {
      // Search filter
      if (query) {
        const matchesTitle = tune.title?.toLowerCase().includes(query);
        const matchesIncipit = tune.incipit?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesIncipit) {
          return false;
        }
      }

      // Type filter
      if (type && tune.type !== type) {
        return false;
      }

      // Mode filter
      if (mode && tune.mode !== mode) {
        return false;
      }

      // Private filter
      if (props.privateOnly && !tune.privateFor) {
        return false;
      }

      return true;
    });
  });

  // Get unique types and modes for filter dropdowns
  const tuneTypes = createMemo(() => {
    const allTunes = tunes() || [];
    const types = new Set<string>();
    allTunes.forEach((tune: Tune) => {
      if (tune.type) types.add(tune.type);
    });
    return Array.from(types).sort();
  });

  const tuneModes = createMemo(() => {
    const allTunes = tunes() || [];
    const modes = new Set<string>();
    allTunes.forEach((tune: Tune) => {
      if (tune.mode) modes.add(tune.mode);
    });
    return Array.from(modes).sort();
  });

  // Define table columns
  const columns: ColumnDef<Tune>[] = [
    {
      accessorKey: "id",
      header: "ID",
      size: 60,
      cell: (info) => (
        <span class="text-gray-600 dark:text-gray-400">
          {info.getValue() as number}
        </span>
      ),
    },
    {
      accessorKey: "title",
      header: "Title",
      size: 250,
      cell: (info) => (
        <span class="font-semibold text-gray-900 dark:text-white">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      size: 100,
      cell: (info) => {
        const value = info.getValue() as string | null;
        return (
          <Show when={value} fallback={<span class="text-gray-400">—</span>}>
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
              {value}
            </span>
          </Show>
        );
      },
    },
    {
      accessorKey: "mode",
      header: "Mode",
      size: 80,
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
      accessorKey: "structure",
      header: "Structure",
      size: 120,
      cell: (info) => {
        const value = info.getValue() as string | null;
        return value ? (
          <span class="font-mono text-sm text-gray-600 dark:text-gray-400">
            {value}
          </span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
    },
    {
      accessorKey: "incipit",
      header: "Incipit",
      size: 200,
      cell: (info) => {
        const value = info.getValue() as string | null;
        return value ? (
          <span class="font-mono text-xs text-gray-500 dark:text-gray-400 truncate block">
            {value}
          </span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
    },
    {
      accessorKey: "private_for",
      header: "Status",
      size: 80,
      cell: (info) => {
        const value = info.getValue() as string | null;
        return value ? (
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
            🔒 Private
          </span>
        ) : (
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
            Public
          </span>
        );
      },
    },
  ];

  // Create table instance
  const table = createSolidTable({
    get data() {
      return filteredTunes();
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

  const handleRowClick = (tune: Tune) => {
    props.onTuneSelect?.(tune);
  };

  return (
    <div class="w-full">
      {/* Search and Filter Bar */}
      <div class="mb-4 space-y-3">
        {/* Search Input */}
        <div>
          <label
            for="tune-search"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Search Tunes
          </label>
          <input
            id="tune-search"
            type="text"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            placeholder="Search by title or incipit..."
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
          />
        </div>

        {/* Filter Dropdowns */}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Type Filter */}
          <div>
            <label
              for="filter-type"
              class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Type
            </label>
            <select
              id="filter-type"
              value={filterType()}
              onChange={(e) => setFilterType(e.currentTarget.value)}
              class="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="">All Types</option>
              <For each={tuneTypes()}>
                {(type) => <option value={type}>{type}</option>}
              </For>
            </select>
          </div>

          {/* Mode Filter */}
          <div>
            <label
              for="filter-mode"
              class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Mode
            </label>
            <select
              id="filter-mode"
              value={filterMode()}
              onChange={(e) => setFilterMode(e.currentTarget.value)}
              class="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="">All Modes</option>
              <For each={tuneModes()}>
                {(mode) => <option value={mode}>{mode}</option>}
              </For>
            </select>
          </div>

          {/* Results Count */}
          <div class="flex items-end">
            <div class="text-sm text-gray-600 dark:text-gray-400 pb-1.5">
              <Show
                when={!tunes.loading}
                fallback={<span>Loading tunes...</span>}
              >
                Showing {filteredTunes().length} of {tunes()?.length || 0} tunes
              </Show>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <Show
          when={!tunes.loading}
          fallback={
            <div class="text-center py-12 bg-white dark:bg-gray-800">
              <div class="animate-spin h-12 w-12 mx-auto border-4 border-blue-600 border-t-transparent rounded-full" />
              <p class="mt-4 text-gray-600 dark:text-gray-400">
                Loading tunes...
              </p>
            </div>
          }
        >
          <Show
            when={filteredTunes().length > 0}
            fallback={
              <div class="text-center py-12 bg-gray-50 dark:bg-gray-800">
                <p class="text-lg text-gray-600 dark:text-gray-400">
                  No tunes found
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-500 mt-2">
                  Try adjusting your search or filters
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
