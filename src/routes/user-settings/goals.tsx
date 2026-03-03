/**
 * Goals Settings Page
 *
 * Manages user-defined goals and their associated scheduling techniques.
 * System goals (seeded with private_for = NULL) are shown read-only with a
 * "Built-in" badge.  Users can create, edit, and soft-delete private goals.
 *
 * Technique options per goal:
 *  - FSRS            → full spaced-repetition scheduling
 *  - Base Intervals  → step-ladder scheduling; requires a JSON array of positive
 *                      day-count values (e.g. [0.5, 1, 2, 3, 5])
 *  - Plugin          → scheduling delegated to a named scheduling plugin
 *
 * @module routes/user-settings/goals
 */

import {
  type Component,
  createEffect,
  createSignal,
  For,
  Show,
} from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  type GoalRow,
  getGoals,
  softDeleteGoal,
  upsertGoal,
} from "@/lib/db/queries/user-settings";

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validate a base_intervals JSON string.
 * Returns an error message, or null if valid.
 * Valid: JSON array of positive numbers (sorted order is NOT required).
 */
function validateBaseIntervals(raw: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return "Must be a valid JSON array, e.g. [1, 3, 7, 14, 21]";
  }
  if (!Array.isArray(parsed)) {
    return "Must be a JSON array, e.g. [1, 3, 7, 14, 21]";
  }
  if (parsed.length === 0) {
    return "Array must contain at least one value";
  }
  for (const v of parsed) {
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
      return "All values must be positive numbers (e.g. 0.5, 1, 7)";
    }
  }
  return null;
}

// ─── Add / Edit form ─────────────────────────────────────────────────────────

interface GoalFormState {
  id?: string;
  name: string;
  technique: "fsrs" | "base_interval" | "plugin";
  baseIntervals: string;
  pluginId: string;
}

const EMPTY_FORM: GoalFormState = {
  id: undefined,
  name: "",
  technique: "fsrs",
  baseIntervals: "",
  pluginId: "",
};

const GoalForm: Component<{
  initial?: GoalFormState;
  onSave: (form: GoalFormState) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}> = (props) => {
  const [form, setForm] = createSignal<GoalFormState>({
    ...(props.initial ?? EMPTY_FORM),
  });
  const [error, setError] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const f = form();

    // Validate name
    if (!f.name.trim()) {
      setError("Goal name is required.");
      return;
    }

    // Validate base_intervals when technique = base_interval
    if (f.technique === "base_interval") {
      const msg = validateBaseIntervals(f.baseIntervals);
      if (msg) {
        setError(msg);
        return;
      }
    }

    if (f.technique === "plugin" && !f.pluginId.trim()) {
      setError("Plugin ID is required when technique is Plugin.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await props.onSave(f);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof GoalFormState>(k: K, v: GoalFormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <form onSubmit={handleSubmit} class="space-y-4">
      {/* Name */}
      <div>
        <label
          for="goal-name"
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Name
        </label>
        <input
          id="goal-name"
          type="text"
          value={form().name}
          onInput={(e) => set("name", e.currentTarget.value)}
          placeholder="e.g. session_ready"
          class="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Technique selector */}
      <div>
        <p class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Technique
        </p>
        <div class="space-y-2">
          {(
            [
              ["fsrs", "FSRS", "Full spaced-repetition scheduling"],
              [
                "base_interval",
                "Base Intervals",
                "Step-ladder scheduling; steps advance on Good/Easy, reset on Again",
              ],
              [
                "plugin",
                "Plugin",
                "Scheduling delegated to a scheduling plugin",
              ],
            ] as const
          ).map(([value, label, desc]) => (
            <label class="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="technique"
                value={value}
                checked={form().technique === value}
                onChange={() => set("technique", value)}
                class="mt-0.5"
              />
              <span>
                <span class="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {label}
                </span>
                <span class="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  {desc}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Base Intervals input */}
      <Show when={form().technique === "base_interval"}>
        <div>
          <label
            for="base-intervals"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Interval ladder{" "}
            <span class="text-xs font-normal text-gray-500">
              (days, JSON array)
            </span>
          </label>
          <input
            id="base-intervals"
            type="text"
            value={form().baseIntervals}
            onInput={(e) => set("baseIntervals", e.currentTarget.value)}
            placeholder="[0.5, 1, 2, 3, 5]"
            class="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            All values must be positive numbers. The last value repeats
            indefinitely. Repeat values are allowed, e.g.{" "}
            <code class="font-mono">[1, 1, 3, 7, 3, 7, 21, 21]</code>.
          </p>
        </div>
      </Show>

      {/* Plugin ID input */}
      <Show when={form().technique === "plugin"}>
        <div>
          <label
            for="plugin-id"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Plugin ID
          </label>
          <input
            id="plugin-id"
            type="text"
            value={form().pluginId}
            onInput={(e) => set("pluginId", e.currentTarget.value)}
            placeholder="UUID of the scheduling plugin"
            class="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </Show>

      {/* Error message */}
      <Show when={error()}>
        <p class="text-sm text-red-600 dark:text-red-400">{error()}</p>
      </Show>

      {/* Actions */}
      <div class="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving()}
          class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md transition-colors"
        >
          {saving() ? "Saving…" : props.submitLabel}
        </button>
        <button
          type="button"
          onClick={props.onCancel}
          class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

// ─── Goal Row ─────────────────────────────────────────────────────────────────

function techniqueOf(row: GoalRow): GoalFormState["technique"] {
  if (row.defaultTechnique === "base_interval") return "base_interval";
  if (row.defaultTechnique === "fsrs") return "fsrs";
  return "plugin";
}

function techniqueLabel(technique: string): string {
  if (technique === "fsrs") return "FSRS";
  if (technique === "base_interval") return "Base Intervals";
  return `Plugin: ${technique}`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const GoalsPage: Component = () => {
  const { user, localDb } = useAuth();

  const [goals, setGoals] = createSignal<GoalRow[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [showAddForm, setShowAddForm] = createSignal(false);
  const [editingId, setEditingId] = createSignal<string | null>(null);

  // Load goals on mount / user change
  createEffect(() => {
    const db = localDb();
    const userId = user()?.id;
    if (!db || !userId) return;

    setLoading(true);
    setError(null);
    getGoals(db, userId)
      .then(setGoals)
      .catch((err) => {
        console.error("Failed to load goals:", err);
        setError("Failed to load goals. Please try again.");
      })
      .finally(() => setLoading(false));
  });

  const refreshGoals = async () => {
    const db = localDb();
    const userId = user()?.id;
    if (!db || !userId) return;
    try {
      setGoals(await getGoals(db, userId));
    } catch {
      // non-fatal refresh failure; stale list is fine
    }
  };

  const handleAdd = async (form: GoalFormState) => {
    const db = localDb();
    const userId = user()?.id;
    if (!db || !userId) throw new Error("Not authenticated");

    const technique =
      form.technique === "plugin" ? form.pluginId.trim() : form.technique;

    await upsertGoal(db, userId, {
      name: form.name,
      defaultTechnique: technique,
      baseIntervals:
        form.technique === "base_interval" ? form.baseIntervals : null,
    });
    setShowAddForm(false);
    await refreshGoals();
  };

  const handleEdit = async (form: GoalFormState) => {
    const db = localDb();
    const userId = user()?.id;
    if (!db || !userId) throw new Error("Not authenticated");

    const technique =
      form.technique === "plugin" ? form.pluginId.trim() : form.technique;

    await upsertGoal(db, userId, {
      id: form.id,
      name: form.name,
      defaultTechnique: technique,
      baseIntervals:
        form.technique === "base_interval" ? form.baseIntervals : null,
    });
    setEditingId(null);
    await refreshGoals();
  };

  const handleDelete = async (row: GoalRow) => {
    const db = localDb();
    const userId = user()?.id;
    if (!db || !userId) return;

    if (!confirm(`Delete goal "${row.name}"? This cannot be undone.`)) return;
    await softDeleteGoal(db, userId, row.id);
    await refreshGoals();
  };

  return (
    <div class="space-y-6 max-w-2xl">
      <div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
          Goals
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage practice goals and their scheduling techniques. System goals
          are read-only; create your own goals below to customise scheduling.
        </p>
      </div>

      <Show
        when={!loading()}
        fallback={
          <p class="text-sm text-gray-500 animate-pulse">Loading goals…</p>
        }
      >
        <Show when={error()}>
          <p class="text-sm text-red-600 dark:text-red-400">{error()}</p>
        </Show>

        {/* Goal list */}
        <div class="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
          <For each={goals()}>
            {(row) => {
              const isSystem = row.privateFor === null;

              return (
                <div class="p-4">
                  <Show
                    when={editingId() === row.id}
                    fallback={
                      <div class="flex items-start justify-between gap-4">
                        <div class="min-w-0">
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono">
                              {row.name}
                            </span>
                            <Show when={isSystem}>
                              <span class="px-1.5 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                Built-in
                              </span>
                            </Show>
                          </div>
                          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {techniqueLabel(row.defaultTechnique)}
                            <Show when={row.baseIntervals}>
                              <span class="ml-2 font-mono">
                                {row.baseIntervals}
                              </span>
                            </Show>
                          </p>
                        </div>

                        <Show when={!isSystem}>
                          <div class="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setEditingId(row.id)}
                              class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(row)}
                              class="text-xs text-red-600 dark:text-red-400 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        </Show>
                      </div>
                    }
                  >
                    <GoalForm
                      initial={{
                        id: row.id,
                        name: row.name,
                        technique: techniqueOf(row),
                        baseIntervals: row.baseIntervals ?? "",
                        pluginId:
                          techniqueOf(row) === "plugin"
                            ? row.defaultTechnique
                            : "",
                      }}
                      onSave={handleEdit}
                      onCancel={() => setEditingId(null)}
                      submitLabel="Save"
                    />
                  </Show>
                </div>
              );
            }}
          </For>
        </div>

        {/* Add Goal */}
        <Show
          when={showAddForm()}
          fallback={
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              class="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              + Add Goal
            </button>
          }
        >
          <div class="rounded-lg border border-blue-200 dark:border-blue-700 p-4 bg-blue-50/30 dark:bg-blue-900/10">
            <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
              New Goal
            </h4>
            <GoalForm
              onSave={handleAdd}
              onCancel={() => setShowAddForm(false)}
              submitLabel="Add Goal"
            />
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default GoalsPage;
