/**
 * Tune List Component - Table-Centric Design
 *
 * Displays a searchable, filterable, sortable table of tunes.
 * Features:
 * - TanStack Solid Table for information-dense display
 * - Advanced search and filtering with FilterBar
 * - Search by title/incipit/structure
 * - Multi-select filters for type, mode, genre
 * - URL query param persistence
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
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { useAuth } from "../../lib/auth/AuthContext";
import { getTunesForUser } from "../../lib/db/queries/tunes";
import type { Tune } from "../../lib/db/types";
import { FilterBar } from "./FilterBar";

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
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Helper to safely get string from searchParams
  const getParam = (value: string | string[] | undefined): string => {
    if (Array.isArray(value)) return value[0] || "";
    return value || "";
  };
  
  // Helper to safely get array from searchParams
  const getParamArray = (value: string | string[] | undefined): string[] => {
    if (!value) return [];
    const str = Array.isArray(value) ? value[0] || "" : value;
    return str.split(",").filter(Boolean);
  };
  
  // Filter state from URL params
  const [searchQuery, setSearchQuery] = createSignal(getParam(searchParams.q));
  const [selectedTypes, setSelectedTypes] = createSignal<string[]>(
    getParamArray(searchParams.types)
  );
  const [selectedModes, setSelectedModes] = createSignal<string[]>(
    getParamArray(searchParams.modes)
  );
  const [selectedGenres, setSelectedGenres] = createSignal<string[]>(
    getParamArray(searchParams.genres)
  );
  const [sorting, setSorting] = createSignal<SortingState>([]);

  // Sync filter state to URL params
  createEffect(() => {
    const params: Record<string, string> = {};
    
    if (searchQuery()) {
      params.q = searchQuery();
    }
    
    if (selectedTypes().length > 0) {
      params.types = selectedTypes().join(",");
    }
    
    if (selectedModes().length > 0) {
      params.modes = selectedModes().join(",");
    }
    
    if (selectedGenres().length > 0) {
      params.genres = selectedGenres().join(",");
    }
    
    setSearchParams(params, { replace: true });
  });

  // Fetch all tunes from local database
  const [allTunes] = createResource(
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
    const tunes = allTunes() || [];
    const query = String(searchQuery()).trim().toLowerCase();
    const types = selectedTypes();
    const modes = selectedModes();
    const genres = selectedGenres();

    return tunes.filter((tune: Tune) => {
      // Search filter
      if (query) {
        const matchesTitle = tune.title?.toLowerCase().includes(query);
        const matchesIncipit = tune.incipit?.toLowerCase().includes(query);
        const matchesStructure = tune.structure?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesIncipit && !matchesStructure) {
          return false;
        }
      }

      // Type filter (multi-select)
      if (types.length > 0 && tune.type) {
        if (!types.includes(tune.type)) {
          return false;
        }
      }

      // Mode filter (multi-select)
      if (modes.length > 0 && tune.mode) {
        if (!modes.includes(tune.mode)) {
          return false;
        }
      }

      // Genre filter (multi-select)
      if (genres.length > 0 && tune.genre) {
        if (!genres.includes(tune.genre)) {
          return false;
        }
      }

      // Private filter
      if (props.privateOnly && !tune.privateFor) {
        return false;
      }

      return true;
    });
  });

  // Get unique types, modes, and genres for filter dropdowns
  const availableTypes = createMemo(() => {
    const tunes = allTunes() || [];
    const types = new Set<string>();
    tunes.forEach((tune: Tune) => {
      if (tune.type) types.add(tune.type);
    });
    return Array.from(types).sort();
  });

  const availableModes = createMemo(() => {
    const tunes = allTunes() || [];
    const modes = new Set<string>();
    tunes.forEach((tune: Tune) => {
      if (tune.mode) modes.add(tune.mode);
    });
    return Array.from(modes).sort();
  });

  const availableGenres = createMemo(() => {
    const tunes = allTunes() || [];
    const genres = new Set<string>();
    tunes.forEach((tune: Tune) => {
      if (tune.genre) genres.add(tune.genre);
    });
    return Array.from(genres).sort();
  });

  // Clear all filters
  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedTypes([]);
    setSelectedModes([]);
    setSelectedGenres([]);
  };

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
      {/* Filter Bar */}
      <FilterBar
        searchQuery={searchQuery()}
        onSearchChange={setSearchQuery}
        selectedTypes={selectedTypes()}
        onTypesChange={setSelectedTypes}
        selectedModes={selectedModes()}
        onModesChange={setSelectedModes}
        selectedGenres={selectedGenres()}
        onGenresChange={setSelectedGenres}
        availableTypes={availableTypes()}
        availableModes={availableModes()}
        availableGenres={availableGenres()}
        onClearFilters={handleClearFilters}
      />

      {/* Results Summary */}
      <div class="mb-3 text-sm text-gray-600 dark:text-gray-400">
        <Show
          when={!allTunes.loading}
          fallback={<span>Loading tunes...</span>}
        >
          Showing <span class="font-semibold">{filteredTunes().length}</span> of{" "}
          <span class="font-semibold">{allTunes()?.length || 0}</span> tunes
        </Show>
      </div>

      {/* Table */}
      <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <Show
          when={!allTunes.loading}
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
