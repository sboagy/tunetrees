/**
 * Repertoire Editor Component
 *
 * Form for creating and editing repertoires (repertoire lists).
 * Fields:
 * - Name (required - e.g., "My Irish Tunes")
 * - Genre Default (optional - default genre for tunes in this repertoire)
 * - Instrument (optional - integer reference, deferred for now)
 * - SR Algorithm Type (optional - default "fsrs")
 *
 * @module components/repertoires/RepertoireEditor
 */

import type { Component } from "solid-js";
import {
  createEffect,
  createResource,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { genre, instrument } from "../../../drizzle/schema-sqlite";
import { useAuth } from "../../lib/auth/AuthContext";
import type { Playlist } from "../../lib/db/types";

interface RepertoireEditorProps {
  /** Repertoire to edit (undefined for new repertoire) */
  repertoire?: Playlist;
  /** Ref to store function that returns current form data */
  onGetFormData?: (getter: () => Partial<Playlist> | null) => void;
  /** Ref to store function that returns validation state */
  onGetIsValid?: (getter: () => boolean) => void;
  /** Ref to store function that sets error message */
  onSetError?: (setter: (error: string | null) => void) => void;
}

const SR_ALG_TYPES = [
  { value: "fsrs", label: "FSRS (Free Spaced Repetition Scheduler)" },
  { value: "sm2", label: "SM2 (SuperMemo 2)" },
];

/**
 * Repertoire Editor Component
 *
 * @example
 * ```tsx
 * <RepertoireEditor
 *   repertoire={existingRepertoire}
 *   onSave={handleSave}
 *   onCancel={() => navigate(-1)}
 * />
 * ```
 */
export const RepertoireEditor: Component<RepertoireEditorProps> = (props) => {
  const { localDb, user } = useAuth();

  // Dev-only mount counter to detect unintended multiple mounts
  const DEV = import.meta.env.DEV;
  let mounted = false;

  // Form state signals - initialize with empty/null values
  const [name, setName] = createSignal("");
  const [genreDefault, setGenreDefault] = createSignal<string | null>(null);
  const [instrumentRef, setInstrumentRef] = createSignal<string | null>(null);
  const [srAlgType, setSrAlgType] = createSignal("fsrs");

  // Dev-only: warn if component mounts more than once per open
  onMount(() => {
    if (DEV && mounted) {
      console.warn("[RepertoireEditor] Mounted more than once for a single open");
    }
    mounted = true;
  });
  onCleanup(() => {
    mounted = false;
  });

  // Update form state when repertoire prop changes
  createEffect(() => {
    const repertoire = props.repertoire;
    if (repertoire) {
      setName(repertoire.name || "");
      setGenreDefault(repertoire.genreDefault ?? null);
      setInstrumentRef(repertoire.instrumentRef ?? null);
      setSrAlgType(repertoire.srAlgType || "fsrs");
    } else {
      setName("");
      setGenreDefault(null);
      setInstrumentRef(null);
      setSrAlgType("fsrs");
    }
  });

  // UI state
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const [submitError, setSubmitError] = createSignal<string | null>(null);

  // Fetch available genres from database
  const [genres] = createResource(
    () => localDb(),
    async (db) => {
      if (!db) return [];
      return await db.select().from(genre).all();
    }
  );

  // Fetch instruments: public instruments + user's private instruments
  const [instruments] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      return db && userId ? { db, userId } : null;
    },
    async (params) => {
      if (!params) return [];
      const { or, isNull, eq } = await import("drizzle-orm");
      const result = await params.db
        .select()
        .from(instrument)
        .where(
          or(
            isNull(instrument.privateToUser),
            eq(instrument.privateToUser, params.userId)
          )
        )
        .orderBy(instrument.instrument)
        .all();
      return result;
    }
  );

  /**
   * Validate form data before submission
   */
  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name().trim()) {
      newErrors.name = "Repertoire name is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Get form data
  const getFormData = (): Partial<Playlist> | null => {
    if (!validate()) {
      return null;
    }

    return {
      name: name().trim(),
      genreDefault: genreDefault(),
      instrumentRef: instrumentRef(),
      srAlgType: srAlgType() || "fsrs",
    };
  };

  // Expose functions to parent
  props.onGetFormData?.(getFormData);
  props.onGetIsValid?.(validate);
  props.onSetError?.(setSubmitError);

  return (
    <div class="w-full">
      <div>
        <div class="space-y-6">
          {/* Error message */}
          <Show when={submitError()}>
            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p class="text-sm text-red-600 dark:text-red-400">
                {submitError()}
              </p>
            </div>
          </Show>

          {/* Repertoire Info */}
          <Show when={props.repertoire}>
            <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
              <p class="text-sm text-blue-800 dark:text-blue-200">
                <strong>Repertoire ID:</strong> {props.repertoire?.playlistId}
              </p>
              <p class="text-sm text-blue-800 dark:text-blue-200 mt-1">
                <strong>User Ref:</strong> {props.repertoire?.userRef}
              </p>
            </div>
          </Show>

          {/* Repertoire Name */}
          <div class="space-y-2">
            <label
              for="repertoire-name"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Repertoire Name <span class="text-red-500">*</span>
            </label>
            <input
              id="repertoire-name"
              type="text"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="e.g., My Irish Tunes, Bluegrass Practice"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
              classList={{ "border-red-500": !!errors().name }}
            />
            <Show when={errors().name}>
              <p class="text-xs text-red-500">{errors().name}</p>
            </Show>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Give your repertoire a descriptive name (e.g., "My Irish Tunes",
              "Beginner Bluegrass")
            </p>
          </div>

          {/* Genre Default */}
          <div class="space-y-2">
            <label
              for="genre-default"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Default Genre
            </label>
            <select
              id="genre-default"
              onInput={(e) => setGenreDefault(e.currentTarget.value || null)}
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="" selected={!genreDefault()}>
                No default genre
              </option>
              <Show when={!genres.loading}>
                <For each={genres()}>
                  {(g) => (
                    <option value={g.id} selected={genreDefault() === g.id}>
                      {g.id} - {g.name || "Unnamed Genre"}
                    </option>
                  )}
                </For>
              </Show>
            </select>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Set a default genre for tunes in this repertoire (e.g., ITRAD,
              BGRA, OTIME)
            </p>
          </div>

          {/* Instrument Reference */}
          <div class="space-y-2">
            <label
              for="instrument-ref"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Instrument
            </label>
            <select
              id="instrument-ref"
              onInput={(e) => setInstrumentRef(e.currentTarget.value || null)}
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
              classList={{ "border-red-500": !!errors().instrumentRef }}
            >
              <option value="" selected={!instrumentRef()}>
                No instrument selected
              </option>
              <Show when={!instruments.loading}>
                <For each={instruments()}>
                  {(inst) => (
                    <option
                      value={inst.id}
                      selected={instrumentRef() === inst.id}
                    >
                      {inst.instrument || "Unnamed Instrument"}
                      {inst.description ? ` - ${inst.description}` : ""}
                    </option>
                  )}
                </For>
              </Show>
            </select>
            <Show when={errors().instrumentRef}>
              <p class="text-xs text-red-500">{errors().instrumentRef}</p>
            </Show>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Select the instrument for this repertoire (e.g., Irish Flute,
              Mandolin).
            </p>
          </div>

          {/* SR Algorithm Type */}
          <div class="space-y-2">
            <label
              for="sr-alg-type"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Spaced Repetition Algorithm
            </label>
            <select
              id="sr-alg-type"
              value={srAlgType()}
              onChange={(e) => setSrAlgType(e.currentTarget.value)}
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
            >
              {SR_ALG_TYPES.map((alg) => (
                <option value={alg.value}>{alg.label}</option>
              ))}
            </select>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Choose the spaced repetition algorithm for this repertoire's
              practice scheduling.
            </p>
          </div>

          {/* Info about sync metadata */}
          <div class="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-md p-3">
            <p class="text-xs text-gray-600 dark:text-gray-400">
              <strong>Note:</strong> Sync metadata (syncVersion, lastModifiedAt,
              deviceId) will be automatically managed when you save.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
