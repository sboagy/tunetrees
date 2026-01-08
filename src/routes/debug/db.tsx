/**
 * SQLite WASM Database Browser (Debug Tool)
 *
 * Web-based SQL query interface for inspecting the local SQLite WASM database.
 * Similar to SQLite Browser or phpLiteAdmin but runs entirely in the browser.
 *
 * Usage: Navigate to /debug/db
 */

import { TABLE_REGISTRY } from "@sync-schema/table-meta";
import type { Component } from "solid-js";
import { createResource, createSignal, For, Show } from "solid-js";
import { toast } from "solid-sonner";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { getFailedOutboxItems, retryOutboxItem } from "@/lib/sync";

interface QueryResult {
  columns: string[];
  values: unknown[][];
}

export default function DatabaseBrowser(): ReturnType<Component> {
  const { localDb, isAnonymous } = useAuth();
  const [query, setQuery] = createSignal(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
  );
  const [results, setResults] = createSignal<QueryResult | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [executionTime, setExecutionTime] = createSignal<number>(0);
  const [tipsOpen, setTipsOpen] = createSignal(false);
  const [compareRunning, setCompareRunning] = createSignal(false);
  const [compareTable, setCompareTable] = createSignal<string>("__all__");

  // Get table list for quick access
  const [tables] = createResource(localDb, async (db) => {
    if (!db) return [];
    const rows = await db.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
    );
    return rows.map((row) => row.name);
  });

  // Preset queries
  const presetQueries = [
    {
      name: "List Tables",
      sql: "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;",
    },
    { name: "Table Info (tune)", sql: "PRAGMA table_info(tune);" },
    { name: "Count Tunes", sql: "SELECT COUNT(*) as count FROM tune;" },
    {
      name: "Count Practice Records",
      sql: "SELECT COUNT(*) as count FROM practice_record;",
    },
    { name: "Count Playlists", sql: "SELECT COUNT(*) as count FROM playlist;" },
    {
      name: "Recent Practice Records",
      sql: "SELECT * FROM practice_record ORDER BY id DESC LIMIT 10;",
    },
    { name: "All Tunes", sql: "SELECT * FROM tune ORDER BY title LIMIT 100;" },
    { name: "Playlists", sql: "SELECT * FROM playlist;" },
    {
      name: "Daily Practice Queue",
      sql: "SELECT * FROM daily_practice_queue ORDER BY queue_date DESC LIMIT 20;",
    },
    {
      name: "Daily Queue (Readable)",
      sql: "SELECT * FROM view_daily_practice_queue_readable WHERE queue_date = '2025-11-05' LIMIT 50;",
    },
    {
      name: "Transient Data (Readable)",
      sql: "SELECT * FROM view_transient_data_readable LIMIT 50;",
    },
    {
      name: "Practice Records (Readable)",
      sql: "SELECT * FROM view_practice_record_readable LIMIT 50;",
    },
    {
      name: "Tune Overrides (Readable)",
      sql: "SELECT * FROM view_tune_override_readable LIMIT 50;",
    },
    {
      name: "Practice List (Joined)",
      sql: "SELECT * FROM practice_list_joined LIMIT 50;",
    },
    {
      name: "Practice List (Staged)",
      sql: "SELECT * FROM practice_list_staged LIMIT 50;",
    },
    {
      name: "Playlist (Joined)",
      sql: "SELECT * FROM view_playlist_joined LIMIT 50;",
    },
    {
      name: "Sync Push Queue (All)",
      sql: "SELECT id, table_name, row_id, operation, status, attempts, changed_at, last_error FROM sync_push_queue ORDER BY changed_at DESC LIMIT 50;",
    },
    {
      name: "Sync Push Queue (Pending)",
      sql: "SELECT id, table_name, row_id, operation, status, attempts, changed_at FROM sync_push_queue WHERE status = 'pending' ORDER BY changed_at;",
    },
    {
      name: "Sync Push Queue (Failed)",
      sql: "SELECT id, table_name, row_id, operation, status, attempts, last_error, changed_at FROM sync_push_queue WHERE status = 'failed' ORDER BY changed_at DESC;",
    },
  ];

  const executeQuery = async () => {
    setError(null);
    setResults(null);

    const db = localDb();
    console.log("[DB identity]", db);

    if (!db) {
      setError("Database not initialized. Please log in first.");
      return;
    }

    try {
      const startTime = performance.now();
      const rows = await db.all<Record<string, unknown>>(query());
      const endTime = performance.now();
      setExecutionTime(endTime - startTime);

      if (rows.length === 0) {
        setResults({ columns: [], values: [] });
        return;
      }

      const columns = Object.keys(rows[0]);
      const values = rows.map((row) => columns.map((col) => row[col]));

      setResults({
        columns,
        values,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const loadPresetQuery = (sql: string) => {
    setQuery(sql);
  };

  const browseTable = async (tableName: string) => {
    const sql = `SELECT * FROM ${tableName} LIMIT 100;`;
    setQuery(sql);
    // Execute query immediately after setting it
    // Use setTimeout to ensure the query signal has updated
    setTimeout(() => executeQuery(), 0);
  };

  const retryFailedSyncItems = async () => {
    if (!localDb()) {
      toast.error("Database not initialized");
      return;
    }

    try {
      const failedItems = await getFailedOutboxItems(localDb()!);

      if (failedItems.length === 0) {
        toast.info("No failed sync items to retry");
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const item of failedItems) {
        try {
          await retryOutboxItem(localDb()!, item.id);
          successCount++;
        } catch (error) {
          errorCount++;
          console.error(`Failed to reset sync item ${item.id}:`, error);
        }
      }

      if (errorCount === 0) {
        toast.success(`Reset ${successCount} failed sync items for retry`);
      } else {
        toast.warning(`Reset ${successCount} items, ${errorCount} errors`, {
          duration: 5000,
        });
      }

      // Refresh the results if showing sync_push_queue
      if (query().toLowerCase().includes("sync_push_queue")) {
        executeQuery();
      }
    } catch (error) {
      toast.error(
        `Error retrying failed items: ${error instanceof Error ? error.message : String(error)}`,
        {
          duration: Number.POSITIVE_INFINITY,
        }
      );
    }
  };

  const buildRowKey = (pk: string | string[], row: Record<string, unknown>) => {
    if (Array.isArray(pk)) {
      const obj: Record<string, unknown> = {};
      for (const k of pk) obj[k] = row[k];
      return JSON.stringify(obj);
    }
    return String(row[pk]);
  };

  const compareWithSupabase = async () => {
    setError(null);
    setResults(null);
    setExecutionTime(0);

    if (isAnonymous()) {
      toast.error("Anonymous mode has no Supabase data to compare");
      return;
    }

    if (!navigator.onLine) {
      toast.error("You are offline; Supabase comparison requires network");
      return;
    }

    const db = localDb();
    if (!db) {
      toast.error("Database not initialized");
      return;
    }

    setCompareRunning(true);
    const start = performance.now();

    try {
      // Use the already-loaded local tables list to avoid probing unknown tables.
      const localTables = new Set(tables() ?? []);

      const selectedTable = compareTable();
      const tableFilter =
        selectedTable === "__all__" ? null : (selectedTable as string);

      const mismatchRows: Array<{
        table: string;
        type:
          | "missing_in_supabase"
          | "missing_in_sqlite"
          | "last_modified_at_diff";
        row_id: string;
        local_last_modified_at: string | null;
        remote_last_modified_at: string | null;
      }> = [];

      const MAX_MISMATCH_ROWS = 2000;
      let truncated = false;

      for (const [tableName, meta] of Object.entries(TABLE_REGISTRY)) {
        if (tableFilter && tableName !== tableFilter) continue;
        if (!localTables.has(tableName)) continue;

        const pkCols = Array.isArray(meta.primaryKey)
          ? meta.primaryKey
          : [meta.primaryKey];
        const hasLastModified = meta.supportsIncremental;
        const columns = hasLastModified
          ? [...pkCols, "last_modified_at"]
          : [...pkCols];

        // Local keys
        const localSql = `SELECT ${columns.join(", ")} FROM ${tableName};`;
        const localRows = await db.all<Record<string, unknown>>(localSql);
        const localMap = new Map<string, string | null>();

        for (const row of localRows) {
          const key = buildRowKey(meta.primaryKey, row);
          const lm = hasLastModified
            ? ((row as { last_modified_at?: string | null }).last_modified_at ??
              null)
            : null;
          localMap.set(key, lm);
        }

        // Remote keys (paged)
        const remoteMap = new Map<string, string | null>();
        const pageSize = 1000;
        let from = 0;

        while (true) {
          let q = supabase.from(tableName).select(columns.join(","));
          for (const pk of pkCols) {
            q = q.order(pk, { ascending: true });
          }
          const { data, error: remoteError } = await q.range(
            from,
            from + pageSize - 1
          );

          if (remoteError) {
            // Skip table if RLS or schema mismatch; surface error once.
            mismatchRows.push({
              table: tableName,
              type: "missing_in_supabase",
              row_id: `__error__: ${remoteError.message}`,
              local_last_modified_at: null,
              remote_last_modified_at: null,
            });
            break;
          }

          const page = data ?? [];
          if (page.length === 0) break;

          for (const row of page as unknown as Record<string, unknown>[]) {
            const key = buildRowKey(meta.primaryKey, row);
            const lm = hasLastModified
              ? ((row as { last_modified_at?: string | null })
                  .last_modified_at ?? null)
              : null;
            remoteMap.set(key, lm);
          }

          if (page.length < pageSize) break;
          from += page.length;
        }

        // Missing in Supabase
        for (const [key, localLm] of localMap) {
          if (!remoteMap.has(key)) {
            mismatchRows.push({
              table: tableName,
              type: "missing_in_supabase",
              row_id: key,
              local_last_modified_at: localLm,
              remote_last_modified_at: null,
            });
            if (mismatchRows.length >= MAX_MISMATCH_ROWS) {
              truncated = true;
              break;
            }
          }
        }
        if (truncated) break;

        // Missing in SQLite + timestamp differences
        for (const [key, remoteLm] of remoteMap) {
          const localLm = localMap.get(key);
          if (!localMap.has(key)) {
            mismatchRows.push({
              table: tableName,
              type: "missing_in_sqlite",
              row_id: key,
              local_last_modified_at: null,
              remote_last_modified_at: remoteLm,
            });
          } else if (hasLastModified && localLm !== remoteLm) {
            mismatchRows.push({
              table: tableName,
              type: "last_modified_at_diff",
              row_id: key,
              local_last_modified_at: localLm ?? null,
              remote_last_modified_at: remoteLm ?? null,
            });
          }

          if (mismatchRows.length >= MAX_MISMATCH_ROWS) {
            truncated = true;
            break;
          }
        }

        if (truncated) break;
      }

      const end = performance.now();
      setExecutionTime(end - start);

      setResults({
        columns: [
          "table",
          "type",
          "row_id",
          "local_last_modified_at",
          "remote_last_modified_at",
        ],
        values: mismatchRows.map((r) => [
          r.table,
          r.type,
          r.row_id,
          r.local_last_modified_at,
          r.remote_last_modified_at,
        ]),
      });

      if (mismatchRows.length === 0) {
        toast.success("No mismatches found");
      } else {
        toast.warning(
          `Found ${mismatchRows.length}${truncated ? "+" : ""} mismatches`
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(`Compare failed: ${msg}`);
    } finally {
      setCompareRunning(false);
    }
  };

  return (
    <div class="fixed inset-0 flex flex-col bg-white dark:bg-gray-950">
      {/* Header */}
      <div class="p-6 flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
        <h1 class="text-3xl font-bold">SQLite WASM Database Browser</h1>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
          💡 <strong>Tip:</strong> Each browser tab has its own database copy.
          After making changes in another tab,{" "}
          <button
            type="button"
            onClick={() => window.location.reload()}
            class="text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            refresh this page
          </button>{" "}
          to see the latest data from IndexedDB.
        </p>
      </div>

      {/* Main Content - Flex to fill remaining space */}
      <div class="flex-1 flex overflow-hidden">
        {/* Sidebar - Tables & Presets */}
        <div class="w-80 p-6 space-y-4 overflow-y-auto border-r border-gray-200 dark:border-gray-700">
          {/* Tables List */}
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-col h-96">
            <h2 class="text-lg font-semibold mb-3">Tables</h2>
            <Show
              when={!tables.loading}
              fallback={<p class="text-sm text-gray-500">Loading...</p>}
            >
              <div class="overflow-y-auto flex-1">
                <div class="space-y-1">
                  <For each={tables()}>
                    {(table) => (
                      <button
                        type="button"
                        onClick={() => browseTable(table)}
                        class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        📋 {table}
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </div>

          {/* Preset Queries */}
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 class="text-lg font-semibold mb-3">Preset Queries</h2>
            <div class="space-y-1">
              <For each={presetQueries}>
                {(preset) => (
                  <button
                    type="button"
                    onClick={() => loadPresetQuery(preset.sql)}
                    class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    ⚡ {preset.name}
                  </button>
                )}
              </For>
            </div>

            {/* Sync Actions */}
            <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={retryFailedSyncItems}
                class="w-full px-3 py-2 text-sm rounded bg-amber-100 dark:bg-amber-900/20 hover:bg-amber-200 dark:hover:bg-amber-900/30 text-amber-900 dark:text-amber-300 font-medium transition-colors"
              >
                🔄 Retry Failed Sync Items
              </button>

              <button
                type="button"
                onClick={compareWithSupabase}
                disabled={compareRunning()}
                class="w-full mt-2 px-3 py-2 text-sm rounded bg-sky-100 dark:bg-sky-900/20 hover:bg-sky-200 dark:hover:bg-sky-900/30 text-sky-900 dark:text-sky-300 font-medium transition-colors"
                classList={{
                  "opacity-50 cursor-not-allowed": compareRunning(),
                }}
              >
                🔎 Compare SQLite vs Supabase
              </button>

              <label
                for="compare-table"
                class="block mt-2 text-xs text-gray-600 dark:text-gray-400"
              >
                Compare table
              </label>
              <select
                id="compare-table"
                value={compareTable()}
                onChange={(e) => setCompareTable(e.currentTarget.value)}
                disabled={compareRunning()}
                class="w-full mt-1 px-3 py-2 text-sm rounded border bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600"
              >
                <option value="__all__">All tables</option>
                <For each={tables() ?? []}>
                  {(t) => <option value={t}>{t}</option>}
                </For>
              </select>
            </div>
          </div>
        </div>

        {/* Main Query Panel - Fill remaining space */}
        <div class="flex-1 p-6 flex flex-col space-y-4 overflow-y-auto">
          {/* Query Editor */}
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex-shrink-0">
            <h2 class="text-lg font-semibold mb-3">SQL Query</h2>
            <textarea
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              rows={6}
              class="w-full px-3 py-2 border rounded-md font-mono text-sm bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600"
              placeholder="Enter SQL query..."
            />
            <div class="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={executeQuery}
                class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                ▶ Execute Query
              </button>
              <Show when={executionTime() > 0}>
                <span class="text-sm text-gray-500">
                  Executed in {executionTime().toFixed(2)}ms
                </span>
              </Show>
            </div>
          </div>

          {/* Error Display */}
          <Show when={error()}>
            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex-shrink-0">
              <h3 class="text-red-800 dark:text-red-400 font-semibold mb-1">
                Error
              </h3>
              <p class="text-red-700 dark:text-red-300 font-mono text-sm">
                {error()}
              </p>
            </div>
          </Show>

          {/* Results Display - Grows to fill remaining space */}
          <Show when={results()}>
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden flex flex-col flex-1 min-h-0">
              <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <h2 class="text-lg font-semibold">
                  Results ({results()?.values.length || 0} rows)
                </h2>
              </div>
              <div class="overflow-auto flex-1">
                <Show
                  when={(results()?.values.length ?? 0) > 0}
                  fallback={
                    <p class="p-4 text-gray-500 text-center">
                      No results returned
                    </p>
                  }
                >
                  <table class="w-full text-sm">
                    <thead class="bg-gray-50 dark:bg-gray-900 sticky top-0">
                      <tr>
                        <For each={results()?.columns}>
                          {(column) => (
                            <th class="px-4 py-2 text-left font-semibold border-b dark:border-gray-700">
                              {column}
                            </th>
                          )}
                        </For>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={results()?.values}>
                        {(row) => (
                          <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                            <For each={row}>
                              {(cell) => (
                                <td class="px-4 py-2 font-mono text-xs">
                                  {cell === null ? (
                                    <span class="text-gray-400 italic">
                                      NULL
                                    </span>
                                  ) : typeof cell === "object" ? (
                                    JSON.stringify(cell)
                                  ) : (
                                    String(cell)
                                  )}
                                </td>
                              )}
                            </For>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </Show>
              </div>
            </div>
          </Show>
        </div>
      </div>

      {/* Collapsible Tips Section - Fixed at bottom */}
      <div class="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <button
          type="button"
          onClick={() => setTipsOpen(!tipsOpen())}
          class="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <h3 class="text-blue-800 dark:text-blue-400 font-semibold flex items-center gap-2">
            💡 Tips
            <span class="text-xs text-blue-600 dark:text-blue-300">
              {tipsOpen() ? "▼" : "▶"}
            </span>
          </h3>
        </button>
        <Show when={tipsOpen()}>
          <div class="px-6 pb-4 max-h-48 overflow-y-auto bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800">
            <ul class="text-blue-700 dark:text-blue-300 text-sm space-y-1">
              <li>• Click a table name to browse its contents</li>
              <li>• Use preset queries for common inspections</li>
              <li>
                • Run any valid SQLite SQL (SELECT, INSERT, UPDATE, DELETE,
                etc.)
              </li>
              <li>
                • Check PRAGMA commands:{" "}
                <code class="px-1 py-0.5 bg-blue-100 dark:bg-blue-900 rounded">
                  PRAGMA table_info(table_name)
                </code>
              </li>
              <li>
                • View schema:{" "}
                <code class="px-1 py-0.5 bg-blue-100 dark:bg-blue-900 rounded">
                  SELECT sql FROM sqlite_master WHERE name='table_name'
                </code>
              </li>
            </ul>
          </div>
        </Show>
      </div>
    </div>
  );
}
