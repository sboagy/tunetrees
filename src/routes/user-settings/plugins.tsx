/**
 * Plugins Settings Page
 *
 * Manage import and scheduling plugins.
 */

import type { Component } from "solid-js";
import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  createPlugin,
  deletePlugin,
  getPlugins,
  updatePlugin,
} from "@/lib/db/queries/plugins";
import type { Plugin } from "@/lib/db/types";
import {
  type ParsedCapabilities,
  parseCapabilities,
  serializeCapabilities,
} from "@/lib/plugins/capabilities";
import { runPluginFunction } from "@/lib/plugins/runtime";

interface PluginDraft {
  id: string;
  userRef: string;
  name: string;
  description: string;
  script: string;
  capabilities: ParsedCapabilities;
  isPublic: boolean;
  enabled: boolean;
  version: number;
}

const DEFAULT_PLUGIN_SCRIPT = `// TuneTrees Plugin Template
// Define parseImport and/or scheduleGoal.

function parseImport(payload, meta) {
  // payload = { input, genre, isUrl }
  // return { title, type, mode, structure, incipit, genre, sourceUrl }
  log("parseImport", payload, meta);
  return {
    title: "New Tune",
    genre: payload.genre,
    sourceUrl: payload.input,
  };
}

function scheduleGoal(payload, meta) {
  // payload = { input, prior, preferences, scheduling, fallback }
  // return a schedule shape (see fallback for example)
  log("scheduleGoal", payload, meta);
  return payload.fallback;
}
`;

const DEFAULT_CAPABILITIES: ParsedCapabilities = {
  parseImport: true,
  scheduleGoal: false,
};

const CodeMirrorEditor: Component<{
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  dataTestId?: string;
}> = (props) => {
  let container: HTMLDivElement | undefined;
  let view: import("@codemirror/view").EditorView | null = null;
  let isApplying = false;
  const [loading, setLoading] = createSignal(true);

  const loadEditor = async () => {
    const [viewModule, stateModule, jsModule, themeModule] = await Promise.all([
      import("@codemirror/view"),
      import("@codemirror/state"),
      import("@codemirror/lang-javascript"),
      import("@codemirror/theme-one-dark"),
    ]);

    const isDark = document.documentElement.classList.contains("dark");
    const extensions = [
      jsModule.javascript(),
      viewModule.EditorView.lineWrapping,
      viewModule.EditorView.updateListener.of((update) => {
        if (!update.docChanged || isApplying) return;
        props.onChange(update.state.doc.toString());
      }),
    ];

    if (props.readOnly) {
      extensions.push(viewModule.EditorView.editable.of(false));
    }

    if (isDark) {
      extensions.push(themeModule.oneDark);
    }

    const state = stateModule.EditorState.create({
      doc: props.value,
      extensions,
    });

    if (!container) return;
    view = new viewModule.EditorView({
      state,
      parent: container,
    });

    setLoading(false);
  };

  onMount(() => {
    loadEditor();
  });

  createEffect(() => {
    if (!view) return;
    const next = props.value ?? "";
    if (view.state.doc.toString() === next) return;
    isApplying = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: next },
    });
    isApplying = false;
  });

  onCleanup(() => {
    view?.destroy();
    view = null;
  });

  return (
    <div class="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white dark:bg-gray-900">
      <div ref={container} data-testid={props.dataTestId} />
      <Show when={loading()}>
        <div class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
          Loading editor...
        </div>
      </Show>
    </div>
  );
};

const PluginsPage: Component = () => {
  const { user, localDb } = useAuth();

  const [plugins, setPlugins] = createSignal<Plugin[]>([]);
  const [selectedId, setSelectedId] = createSignal<string | null>(null);
  const [draft, setDraft] = createSignal<PluginDraft | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [isDirty, setIsDirty] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [statusMessage, setStatusMessage] = createSignal<string | null>(null);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  const [testFunction, setTestFunction] = createSignal<
    "parseImport" | "scheduleGoal"
  >("parseImport");
  const [testPayload, setTestPayload] = createSignal<string>(
    JSON.stringify(
      {
        input: "https://example.com/tunes.csv",
        genre: "ITRAD",
        isUrl: true,
      },
      null,
      2
    )
  );
  const [testMeta, setTestMeta] = createSignal<string>(
    JSON.stringify({ source: "plugin-test" }, null, 2)
  );
  const [testResult, setTestResult] = createSignal<string | null>(null);
  const [testError, setTestError] = createSignal<string | null>(null);
  const [isRunningTest, setIsRunningTest] = createSignal(false);

  const selectedPlugin = createMemo(() => {
    const id = selectedId();
    return plugins().find((row) => row.id === id) ?? null;
  });

  const isOwner = createMemo(() => {
    const current = draft();
    const currentUser = user();
    return Boolean(current && currentUser?.id === current.userRef);
  });

  const loadPlugins = async () => {
    const currentUser = user();
    const db = localDb();
    if (!currentUser?.id || !db) return;

    setIsLoading(true);
    try {
      const rows = await getPlugins(db, currentUser.id, {
        includePublic: true,
      });
      setPlugins(rows);
      if (!selectedId() && rows[0]) {
        setSelectedId(rows[0].id);
      }
      if (selectedId()) {
        const updated = rows.find((row) => row.id === selectedId());
        if (updated) {
          setDraft({
            id: updated.id,
            userRef: updated.userRef,
            name: updated.name,
            description: updated.description ?? "",
            script: updated.script,
            capabilities: parseCapabilities(updated.capabilities),
            isPublic: updated.isPublic === 1,
            enabled: updated.enabled === 1,
            version: updated.version ?? 1,
          });
          setIsDirty(false);
        }
      }
    } catch (error) {
      console.error("Failed to load plugins", error);
      setErrorMessage("Failed to load plugins");
    } finally {
      setIsLoading(false);
    }
  };

  createEffect(() => {
    const currentUser = user();
    const db = localDb();
    if (!currentUser?.id || !db) return;
    loadPlugins();
  });

  createEffect(() => {
    const plugin = selectedPlugin();
    if (!plugin) return;
    setDraft({
      id: plugin.id,
      userRef: plugin.userRef,
      name: plugin.name,
      description: plugin.description ?? "",
      script: plugin.script,
      capabilities: parseCapabilities(plugin.capabilities),
      isPublic: plugin.isPublic === 1,
      enabled: plugin.enabled === 1,
      version: plugin.version ?? 1,
    });
    setIsDirty(false);
    setStatusMessage(null);
    setErrorMessage(null);
  });

  const updateDraft = (partial: Partial<PluginDraft>) => {
    setDraft((prev) => (prev ? { ...prev, ...partial } : prev));
    setIsDirty(true);
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const handleCreate = async () => {
    const currentUser = user();
    const db = localDb();
    if (!currentUser?.id || !db) return;

    setIsSaving(true);
    try {
      const created = await createPlugin(db, {
        userRef: currentUser.id,
        name: "New Plugin",
        description: "",
        script: DEFAULT_PLUGIN_SCRIPT,
        capabilities: serializeCapabilities(DEFAULT_CAPABILITIES),
        enabled: true,
        isPublic: false,
        version: 1,
      });

      setPlugins((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setStatusMessage("Plugin created");
    } catch (error) {
      console.error("Failed to create plugin", error);
      setErrorMessage("Failed to create plugin");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    const currentUser = user();
    const db = localDb();
    const currentDraft = draft();
    if (!currentUser?.id || !db || !currentDraft) return;

    setIsSaving(true);
    try {
      const updated = await updatePlugin(db, currentDraft.id, {
        name: currentDraft.name,
        description: currentDraft.description,
        script: currentDraft.script,
        capabilities: serializeCapabilities(currentDraft.capabilities),
        isPublic: currentDraft.isPublic,
        enabled: currentDraft.enabled,
        version: currentDraft.version,
      });

      if (updated) {
        setPlugins((prev) =>
          prev.map((row) => (row.id === updated.id ? updated : row))
        );
        setStatusMessage("Plugin saved");
        setIsDirty(false);
      }
    } catch (error) {
      console.error("Failed to save plugin", error);
      setErrorMessage("Failed to save plugin");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    const db = localDb();
    const currentDraft = draft();
    if (!db || !currentDraft) return;

    const confirmed = window.confirm(`Delete plugin "${currentDraft.name}"?`);
    if (!confirmed) return;

    setIsSaving(true);
    try {
      await deletePlugin(db, currentDraft.id);
      setPlugins((prev) => prev.filter((row) => row.id !== currentDraft.id));
      setSelectedId(null);
      setDraft(null);
      setStatusMessage("Plugin deleted");
    } catch (error) {
      console.error("Failed to delete plugin", error);
      setErrorMessage("Failed to delete plugin");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunTest = async () => {
    const currentDraft = draft();
    if (!currentDraft) return;

    setIsRunningTest(true);
    setTestResult(null);
    setTestError(null);

    try {
      const payload = JSON.parse(testPayload());
      const meta = JSON.parse(testMeta());
      const result = await runPluginFunction({
        script: currentDraft.script,
        functionName: testFunction(),
        payload,
        meta,
        timeoutMs: 10000,
      });
      setTestResult(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error("Plugin test failed", error);
      setTestError(error instanceof Error ? error.message : "Test failed");
    } finally {
      setIsRunningTest(false);
    }
  };

  return (
    <div class="space-y-6">
      <div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
          Plugins
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage custom import and scheduling plugins.
        </p>
      </div>

      <div class="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-6">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
            Installed Plugins
          </h4>
          <Button
            variant="outline"
            onClick={handleCreate}
            disabled={isSaving()}
            data-testid="plugin-create-button"
          >
            New Plugin
          </Button>
        </div>

        <Show
          when={!isLoading()}
          fallback={<div class="text-sm text-gray-500">Loading plugins...</div>}
        >
          <div class="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-md">
            <table class="min-w-full text-sm">
              <thead class="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                <tr>
                  <th class="px-4 py-2 text-left">Name</th>
                  <th class="px-4 py-2 text-left">Capabilities</th>
                  <th class="px-4 py-2 text-left">Public</th>
                  <th class="px-4 py-2 text-left">Enabled</th>
                </tr>
              </thead>
              <tbody>
                {plugins().map((row) => (
                  <tr
                    class="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer"
                    classList={{
                      "bg-blue-50 dark:bg-blue-900/20": row.id === selectedId(),
                    }}
                    onClick={() => setSelectedId(row.id)}
                    data-testid={`plugin-row-${row.id}`}
                  >
                    <td class="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                      {row.name}
                    </td>
                    <td class="px-4 py-2 text-gray-600 dark:text-gray-300">
                      {Object.entries(parseCapabilities(row.capabilities))
                        .filter(([, enabled]) => enabled)
                        .map(([key]) => key)
                        .join(", ") || "None"}
                    </td>
                    <td class="px-4 py-2">
                      {row.isPublic === 1 ? "Yes" : "No"}
                    </td>
                    <td class="px-4 py-2">
                      {row.enabled === 1 ? "Enabled" : "Disabled"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Show>

        <Show when={draft()}>
          {(current) => (
            <div class="space-y-6">
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Plugin Details
                  </h4>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    {isOwner()
                      ? "Edit your plugin settings and script."
                      : "This plugin is read-only."}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSave}
                    disabled={!isDirty() || isSaving() || !isOwner()}
                    data-testid="plugin-save-button"
                  >
                    Save
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isSaving() || !isOwner()}
                    data-testid="plugin-delete-button"
                  >
                    Delete
                  </Button>
                </div>
              </div>

              <Show when={statusMessage()}>
                <p class="text-xs text-green-600" data-testid="plugin-status">
                  {statusMessage()}
                </p>
              </Show>
              <Show when={errorMessage()}>
                <p class="text-xs text-red-600" data-testid="plugin-error">
                  {errorMessage()}
                </p>
              </Show>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-2">
                  <label
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                    for="plugin-name"
                  >
                    Name
                  </label>
                  <input
                    id="plugin-name"
                    type="text"
                    value={current().name}
                    disabled={!isOwner()}
                    onInput={(e) =>
                      updateDraft({ name: e.currentTarget.value })
                    }
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    data-testid="plugin-name-input"
                  />
                </div>
                <div class="space-y-2">
                  <label
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                    for="plugin-version"
                  >
                    Version
                  </label>
                  <input
                    id="plugin-version"
                    type="number"
                    min="1"
                    value={current().version}
                    disabled={!isOwner()}
                    onInput={(e) =>
                      updateDraft({
                        version: Number.parseInt(e.currentTarget.value, 10),
                      })
                    }
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    data-testid="plugin-version-input"
                  />
                </div>
              </div>

              <div class="space-y-2">
                <label
                  class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  for="plugin-description"
                >
                  Description
                </label>
                <textarea
                  id="plugin-description"
                  value={current().description}
                  disabled={!isOwner()}
                  onInput={(e) =>
                    updateDraft({ description: e.currentTarget.value })
                  }
                  rows={3}
                  class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  data-testid="plugin-description-input"
                />
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={current().capabilities.parseImport ?? false}
                    disabled={!isOwner()}
                    onChange={(e) =>
                      updateDraft({
                        capabilities: {
                          ...current().capabilities,
                          parseImport: e.currentTarget.checked,
                        },
                      })
                    }
                  />
                  Import Parser
                </label>
                <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={current().capabilities.scheduleGoal ?? false}
                    disabled={!isOwner()}
                    onChange={(e) =>
                      updateDraft({
                        capabilities: {
                          ...current().capabilities,
                          scheduleGoal: e.currentTarget.checked,
                        },
                      })
                    }
                  />
                  Goal Scheduler
                </label>
                <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={current().isPublic}
                    disabled={!isOwner()}
                    onChange={(e) =>
                      updateDraft({ isPublic: e.currentTarget.checked })
                    }
                  />
                  Public
                </label>
                <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={current().enabled}
                    disabled={!isOwner()}
                    onChange={(e) =>
                      updateDraft({ enabled: e.currentTarget.checked })
                    }
                  />
                  Enabled
                </label>
              </div>

              <div class="space-y-2">
                <div
                  class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  id="plugin-script-label"
                >
                  Script
                </div>
                <CodeMirrorEditor
                  value={current().script}
                  onChange={(value) => updateDraft({ script: value })}
                  readOnly={!isOwner()}
                  dataTestId="plugin-script-editor"
                />
              </div>

              <div class="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                <div class="flex items-center justify-between">
                  <div>
                    <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Test Runner
                    </h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      Execute plugin functions in the sandboxed runtime.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleRunTest}
                    disabled={isRunningTest()}
                    data-testid="plugin-test-run"
                  >
                    {isRunningTest() ? "Running..." : "Run Test"}
                  </Button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div class="space-y-2">
                    <label
                      class="text-sm font-medium text-gray-700 dark:text-gray-300"
                      for="plugin-test-function"
                    >
                      Function
                    </label>
                    <select
                      id="plugin-test-function"
                      value={testFunction()}
                      onChange={(e) =>
                        setTestFunction(
                          e.currentTarget.value as
                            | "parseImport"
                            | "scheduleGoal"
                        )
                      }
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      data-testid="plugin-test-function"
                    >
                      <option value="parseImport">parseImport</option>
                      <option value="scheduleGoal">scheduleGoal</option>
                    </select>
                  </div>
                  <div class="space-y-2">
                    <label
                      class="text-sm font-medium text-gray-700 dark:text-gray-300"
                      for="plugin-test-payload"
                    >
                      Payload (JSON)
                    </label>
                    <textarea
                      id="plugin-test-payload"
                      value={testPayload()}
                      onInput={(e) => setTestPayload(e.currentTarget.value)}
                      rows={6}
                      class="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
                      data-testid="plugin-test-payload"
                    />
                  </div>
                  <div class="space-y-2">
                    <label
                      class="text-sm font-medium text-gray-700 dark:text-gray-300"
                      for="plugin-test-meta"
                    >
                      Meta (JSON)
                    </label>
                    <textarea
                      id="plugin-test-meta"
                      value={testMeta()}
                      onInput={(e) => setTestMeta(e.currentTarget.value)}
                      rows={6}
                      class="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
                      data-testid="plugin-test-meta"
                    />
                  </div>
                </div>

                <Show when={testResult()}>
                  <div class="space-y-2">
                    <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Result
                    </h5>
                    <pre
                      class="text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-3 overflow-auto"
                      data-testid="plugin-test-result"
                    >
                      {testResult()}
                    </pre>
                  </div>
                </Show>

                <Show when={testError()}>
                  <p
                    class="text-xs text-red-600"
                    data-testid="plugin-test-error"
                  >
                    {testError()}
                  </p>
                </Show>
              </div>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
};

export default PluginsPage;
