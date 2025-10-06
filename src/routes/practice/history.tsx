/**
 * Practice History View
 *
 * Displays past practice records in a sortable, filterable table.
 * Shows practice session details with FSRS metrics.
 *
 * Features:
 * - TanStack Solid Table for information-dense display
 * - Sort by date, quality, stability, difficulty
 * - Filter by quality rating, goal, technique
 * - Date range filtering
 * - Pagination
 * - Click rows to see tune details
 *
 * @module routes/practice/history
 */

import { useNavigate } from "@solidjs/router";
import {
  type ColumnDef,
  createSolidTable,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
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
import { getPracticeRecords } from "../../lib/db/queries/practice";
import type { PracticeRecordWithTune } from "../../lib/db/types";
import { FSRS_QUALITY_MAP } from "../../lib/scheduling/fsrs-service";

/**
 * Practice History Component
 *
 * @example
 * ```tsx
 * <Route path="/practice/history" component={PracticeHistory} />
 * ```
 */
const PracticeHistory: Component = () => {
  const navigate = useNavigate();
  const { localDb } = useAuth();
  const [sorting, setSorting] = createSignal<SortingState>([
    { id: "practiced", desc: true }, // Default: newest first
  ]);
  const [filterQuality, setFilterQuality] = createSignal<string>("");
  const [filterGoal, setFilterGoal] = createSignal<string>("");
  const [selectedPlaylistId] = createSignal(1); // TODO: Add playlist selector
  const [pageSize, setPageSize] = createSignal(25);

  // Fetch practice records from local database
  const [records] = createResource(
    () => {
      const db = localDb();
      return db ? { db, playlistId: selectedPlaylistId() } : null;
    },
    async (params) => {
      if (!params) return [];
      return await getPracticeRecords(params.db, params.playlistId, 500); // Get more for filtering
    }
  );

  // Filter records based on filters
  const filteredRecords = createMemo(() => {
    const allRecords = records() || [];
    const quality = filterQuality();
    const goal = filterGoal();

    return allRecords.filter((record) => {
      // Quality filter
      if (quality && String(record.quality) !== quality) {
        return false;
      }

      // Goal filter
      if (goal && record.goal !== goal) {
        return false;
      }

      return true;
    });
  });

  // Get unique quality ratings for filter
  const qualityRatings = createMemo(() => {
    return [
      { value: "1", label: "Again" },
      { value: "2", label: "Hard" },
      { value: "3", label: "Good" },
      { value: "4", label: "Easy" },
    ];
  });

  // Get unique goals for filter
  const goals = createMemo(() => {
    const allRecords = records() || [];
    const goalSet = new Set<string>();
    allRecords.forEach((record) => {
      if (record.goal) goalSet.add(record.goal);
    });
    return Array.from(goalSet).sort();
  });

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get quality label and color
  const getQualityInfo = (quality: number | null) => {
    switch (quality) {
      case FSRS_QUALITY_MAP.AGAIN:
        return {
          label: "Again",
          class: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
        };
      case FSRS_QUALITY_MAP.HARD:
        return {
          label: "Hard",
          class:
            "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200",
        };
      case FSRS_QUALITY_MAP.GOOD:
        return {
          label: "Good",
          class:
            "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
        };
      case FSRS_QUALITY_MAP.EASY:
        return {
          label: "Easy",
          class:
            "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
        };
      default:
        return {
          label: "—",
          class:
            "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
        };
    }
  };

  // Define table columns
  const columns: ColumnDef<PracticeRecordWithTune>[] = [
    {
      accessorKey: "practiced",
      header: "Date",
      size: 180,
      cell: (info) => (
        <span class="text-sm text-gray-900 dark:text-white">
          {formatDate(info.getValue() as string)}
        </span>
      ),
    },
    {
      accessorFn: (row) => row.tune.title,
      id: "title",
      header: "Tune",
      size: 250,
      cell: (info) => (
        <span class="font-semibold text-gray-900 dark:text-white">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: "quality",
      header: "Rating",
      size: 100,
      cell: (info) => {
        const quality = info.getValue() as number | null;
        const { label, class: className } = getQualityInfo(quality);
        return (
          <span
            class={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}
          >
            {label}
          </span>
        );
      },
    },
    {
      accessorKey: "stability",
      header: "Stability",
      size: 100,
      cell: (info) => {
        const value = info.getValue() as number | null;
        return value !== null ? (
          <span class="font-mono text-sm text-gray-600 dark:text-gray-400">
            {value.toFixed(2)}
          </span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
    },
    {
      accessorKey: "difficulty",
      header: "Difficulty",
      size: 100,
      cell: (info) => {
        const value = info.getValue() as number | null;
        return value !== null ? (
          <span class="font-mono text-sm text-gray-600 dark:text-gray-400">
            {value.toFixed(2)}
          </span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
    },
    {
      accessorKey: "interval",
      header: "Interval",
      size: 90,
      cell: (info) => {
        const value = info.getValue() as number | null;
        return value !== null ? (
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {value} day{value !== 1 ? "s" : ""}
          </span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
    },
    {
      accessorKey: "state",
      header: "State",
      size: 100,
      cell: (info) => {
        const value = info.getValue() as number | null;
        const states = ["New", "Learning", "Review", "Relearning"];
        const stateLabel = value !== null ? states[value] || "—" : "—";
        return (
          <span class="text-xs text-gray-600 dark:text-gray-400">
            {stateLabel}
          </span>
        );
      },
    },
    {
      accessorKey: "goal",
      header: "Goal",
      size: 100,
      cell: (info) => {
        const value = info.getValue() as string | null;
        return value ? (
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
            {value}
          </span>
        ) : (
          <span class="text-gray-400">—</span>
        );
      },
    },
  ];

  // Create table instance
  const table = createSolidTable({
    get data() {
      return filteredRecords();
    },
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      get sorting() {
        return sorting();
      },
      get pagination() {
        return {
          pageIndex: 0,
          pageSize: pageSize(),
        };
      },
    },
    onSortingChange: setSorting,
    initialState: {
      pagination: {
        pageSize: 25,
      },
    },
  });

  const handleRowClick = (record: PracticeRecordWithTune) => {
    navigate(`/tunes/${record.tuneRef}`);
  };

  return (
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navigation Bar */}
      <nav class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center h-16">
            <div class="flex items-center gap-4">
              <button
                type="button"
                onClick={() => navigate("/practice")}
                class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                ← Back
              </button>
              <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
                Practice History
              </h1>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          {/* Filter Bar */}
          <div class="mb-4 flex flex-wrap gap-3">
            {/* Quality Filter */}
            <div class="flex-1 min-w-[200px]">
              <label
                for="quality-filter"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Rating
              </label>
              <select
                id="quality-filter"
                value={filterQuality()}
                onChange={(e) => setFilterQuality(e.currentTarget.value)}
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Ratings</option>
                <For each={qualityRatings()}>
                  {(rating) => (
                    <option value={rating.value}>{rating.label}</option>
                  )}
                </For>
              </select>
            </div>

            {/* Goal Filter */}
            <div class="flex-1 min-w-[200px]">
              <label
                for="goal-filter"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Goal
              </label>
              <select
                id="goal-filter"
                value={filterGoal()}
                onChange={(e) => setFilterGoal(e.currentTarget.value)}
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Goals</option>
                <For each={goals()}>
                  {(goal) => <option value={goal}>{goal}</option>}
                </For>
              </select>
            </div>

            {/* Page Size Selector */}
            <div class="flex-1 min-w-[150px]">
              <label
                for="page-size"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Show
              </label>
              <select
                id="page-size"
                value={pageSize()}
                onChange={(e) =>
                  setPageSize(Number.parseInt(e.currentTarget.value, 10))
                }
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>

          {/* Results Count */}
          <div class="mb-3 text-sm text-gray-600 dark:text-gray-400">
            Showing {filteredRecords().length} practice session
            {filteredRecords().length !== 1 ? "s" : ""}
          </div>

          {/* Loading State */}
          <Show when={records.loading}>
            <div class="text-center py-12">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <p class="mt-4 text-gray-600 dark:text-gray-400">
                Loading practice history...
              </p>
            </div>
          </Show>

          {/* Error State */}
          <Show when={records.error}>
            <div class="text-center py-12 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p class="text-red-800 dark:text-red-300">
                Failed to load practice history
              </p>
            </div>
          </Show>

          {/* Empty State */}
          <Show when={!records.loading && filteredRecords().length === 0}>
            <div class="text-center py-12 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
              <div class="text-6xl mb-4">📊</div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Practice History
              </h3>
              <p class="text-gray-600 dark:text-gray-400">
                Start practicing to see your progress here!
              </p>
            </div>
          </Show>

          {/* Table */}
          <Show when={!records.loading && filteredRecords().length > 0}>
            <div class="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-700">
                  <For each={table.getHeaderGroups()}>
                    {(headerGroup) => (
                      <tr>
                        <For each={headerGroup.headers}>
                          {(header) => (
                            <th
                              scope="col"
                              class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                              onClick={header.column.getToggleSortingHandler()}
                              style={{ width: `${header.getSize()}px` }}
                            >
                              <div class="flex items-center gap-2">
                                {flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                                <Show
                                  when={header.column.getIsSorted()}
                                  fallback={
                                    <span class="text-gray-400">⇅</span>
                                  }
                                >
                                  {header.column.getIsSorted() === "asc"
                                    ? "↑"
                                    : "↓"}
                                </Show>
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
                            <td class="px-4 py-3 whitespace-nowrap">
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

            {/* Pagination */}
            <div class="mt-4 flex items-center justify-between">
              <div class="text-sm text-gray-600 dark:text-gray-400">
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {table.getPageCount()}
              </div>
              <div class="flex gap-2">
                <button
                  type="button"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </Show>
        </div>
      </main>
    </div>
  );
};

export default PracticeHistory;
