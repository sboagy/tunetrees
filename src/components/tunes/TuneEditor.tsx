/**
 * Tune Editor Component
 *
 * Full-featured form for creating and editing tunes.
 * Sections:
 * - Core Tune Data: Genre, Title, Type, Structure, Mode, Incipit
 * - User/Repertoire Specific: Learned, Practiced, Quality, FSRS/SM2 fields
 * - ABC Notation Preview: Live rendering with abcjs
 *
 * @module components/tunes/TuneEditor
 */

import abcjs from "abcjs";
import { CircleX, Pencil, Save } from "lucide-solid";
import {
  type Component,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import { getDb } from "@/lib/db/client-sqlite";
import {
  getAllGenres,
  getAllTuneTypes,
  getTuneTypesForGenre,
} from "@/lib/db/queries/genres";
import {
  addTagToTune,
  getTuneTags,
  removeTagFromTune,
} from "@/lib/db/queries/tags";
import type { Tune } from "../../lib/db/types";
import { TagInput } from "./TagInput";

/**
 * Extended tune data for editor (includes practice record and override fields)
 */
export interface TuneEditorData extends Tune {
  // Additional fields from practice records and overrides
  request_public?: boolean;
  learned?: string;
  practiced?: string;
  quality?: number | null;
  notes_private?: string;
  difficulty?: number | null;
  stability?: number | null;
  step?: number | null;
  state?: number | null;
  repetitions?: number | null;
  due?: string;
  easiness?: number | null;
  interval?: number | null;
}

interface TuneEditorProps {
  /** Tune to edit (undefined for new tune) */
  tune?: TuneEditorData;
  /** Initial data for creating a new tune (query imports). Used when tune is undefined */
  initialData?: Partial<TuneEditorData>;
  /** Callback when save is requested (should return tune ID for new tunes) */
  onSave?: (
    tuneData: Partial<TuneEditorData>
  ) => Promise<string | undefined> | undefined;
  /** Callback when cancel is requested */
  onCancel?: () => void;
  /** Show all FSRS/SM2 fields (collapsed by default) */
  showAdvancedFields?: boolean;
  /** Hide the built-in action buttons (for external button control) */
  hideButtons?: boolean;
  /** Read-only mode (disables all form inputs) */
  readOnly?: boolean;
  /** Callback when edit is requested (read-only mode only) */
  onEdit?: () => void;
  /** Callback when delete is requested (read-only mode only) */
  onDelete?: () => void;
}

// Note: Tune types are now loaded from database based on selected genre

/**
 * Tune Editor Component
 *
 * @example
 * ```tsx
 * <TuneEditor
 *   tune={existingTune}
 *   onSave={handleSave}
 *   onCancel={() => navigate(-1)}
 * />
 * ```
 */
export const TuneEditor: Component<TuneEditorProps> = (props) => {
  const { user } = useAuth();

  // Form state signals
  const init = (field: keyof TuneEditorData): string => {
    return (
      (props.tune && (props.tune as any)[field]) ||
      (props.initialData && (props.initialData as any)[field]) ||
      ""
    );
  };

  const [genre, setGenre] = createSignal(init("genre"));
  const [title, setTitle] = createSignal(init("title"));
  const [type, setType] = createSignal(init("type"));
  const [structure, setStructure] = createSignal(init("structure"));
  const [mode, setMode] = createSignal(init("mode"));
  const [incipit, setIncipit] = createSignal(init("incipit"));
  const [selectedTags, setSelectedTags] = createSignal<string[]>([]);
  const [requestPublic, setRequestPublic] = createSignal(
    props.tune?.request_public || false
  );

  // User/Repertoire specific fields
  const [learned, setLearned] = createSignal(props.tune?.learned || "");
  const [practiced, setPracticed] = createSignal(props.tune?.practiced || "");
  const [quality, setQuality] = createSignal<number | null>(
    props.tune?.quality || null
  );
  const [notes, setNotes] = createSignal(props.tune?.notes_private || "");

  // FSRS fields (collapsible)
  const [difficulty, setDifficulty] = createSignal<number | null>(
    props.tune?.difficulty || null
  );
  const [stability, setStability] = createSignal<number | null>(
    props.tune?.stability || null
  );
  const [step, setStep] = createSignal<number | null>(props.tune?.step || null);
  const [state, setState] = createSignal<number | null>(
    props.tune?.state || null
  );
  const [repetitions, setRepetitions] = createSignal<number | null>(
    props.tune?.repetitions || null
  );
  const [due, setDue] = createSignal(props.tune?.due || "");

  // SM2 fields (collapsible)
  const [easiness, setEasiness] = createSignal<number | null>(
    props.tune?.easiness || null
  );
  const [interval, setInterval] = createSignal<number | null>(
    props.tune?.interval || null
  );

  // UI state
  const [sm2Open, setSm2Open] = createSignal(false);
  const [fsrsOpen, setFsrsOpen] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [errors, setErrors] = createSignal<Record<string, string>>({});

  // Load genres from database
  const [allGenres] = createResource(async () => {
    const db = getDb();
    return await getAllGenres(db);
  });

  // Load tune types filtered by selected genre
  const [tuneTypes] = createResource(
    genre, // Watch genre signal
    async (genreId) => {
      const db = getDb();
      if (!genreId) {
        return await getAllTuneTypes(db);
      }
      return await getTuneTypesForGenre(db, genreId);
    }
  );

  // Track if form has been modified (dirty state)
  const isDirty = createMemo(() => {
    // Skip dirty check in read-only mode
    if (props.readOnly) return false;

    // Check core fields
    if (genre() !== init("genre")) return true;
    if (title() !== init("title")) return true;
    if (type() !== init("type")) return true;
    if (structure() !== init("structure")) return true;
    if (mode() !== init("mode")) return true;
    if (incipit() !== init("incipit")) return true;
    if (requestPublic() !== (props.tune?.request_public || false)) return true;

    // Check user/repertoire fields (only if editing existing tune)
    if (props.tune) {
      if (learned() !== (props.tune.learned || "")) return true;
      if (practiced() !== (props.tune.practiced || "")) return true;
      if (quality() !== (props.tune.quality || null)) return true;
      if (notes() !== (props.tune.notes_private || "")) return true;
      if (difficulty() !== (props.tune.difficulty || null)) return true;
      if (stability() !== (props.tune.stability || null)) return true;
      if (step() !== (props.tune.step || null)) return true;
      if (state() !== (props.tune.state || null)) return true;
      if (repetitions() !== (props.tune.repetitions || null)) return true;
      if (due() !== (props.tune.due || "")) return true;
      if (easiness() !== (props.tune.easiness || null)) return true;
      if (interval() !== (props.tune.interval || null)) return true;
    }

    return false;
  });

  // Load existing tags if editing a tune
  createEffect(async () => {
    if (props.tune?.id) {
      const currentUser = user();
      if (!currentUser?.id) return;

      const db = getDb();
      const tags = await getTuneTags(db, props.tune.id, currentUser.id);
      setSelectedTags(tags.map((t) => t.tagText));
    }
  });

  // ABC notation preview
  let abcPreviewRef: HTMLDivElement | undefined;

  // Render ABC notation whenever incipit changes
  createEffect(() => {
    const incipitValue = incipit();
    if (abcPreviewRef && incipitValue) {
      try {
        // Simple ABC structure for preview
        const abcNotation = `X:1\nT:${title() || "Preview"}\nM:4/4\nL:1/8\nK:${mode() || "D"}\n${incipitValue}`;
        abcjs.renderAbc(abcPreviewRef, abcNotation, {
          responsive: "resize",
          scale: 0.8,
        });
      } catch (error) {
        console.error("ABC rendering error:", error);
        // Clear preview on error
        if (abcPreviewRef) {
          abcPreviewRef.innerHTML =
            '<p class="text-red-500 text-sm">Invalid ABC notation</p>';
        }
      }
    } else if (abcPreviewRef) {
      abcPreviewRef.innerHTML =
        '<p class="text-gray-400 text-sm">Enter incipit to see preview</p>';
    }
  });

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title().trim()) {
      newErrors.title = "Title is required";
    }

    if (!type()) {
      newErrors.type = "Type is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    setIsSaving(true);

    const tuneData: Partial<TuneEditorData> = {
      genre: genre() || undefined,
      title: title(),
      type: type(),
      structure: structure() || undefined,
      mode: mode() || undefined,
      incipit: incipit() || undefined,
      privateFor: props.tune?.privateFor || undefined,
      request_public: requestPublic(),
      learned: learned() || undefined,
      practiced: practiced() || undefined,
      quality: quality(),
      difficulty: difficulty(),
      stability: stability(),
      step: step(),
      state: state(),
      repetitions: repetitions(),
      due: due() || undefined,
      easiness: easiness(),
      interval: interval(),
      notes_private: notes() || undefined,
    };

    try {
      // Save tune data and get tune ID (for new tunes) or undefined (for edits)
      const result = await props.onSave?.(tuneData);
      const tuneId = typeof result === "number" ? result : props.tune?.id;

      // Save tags if we have a tune ID and tags to save
      if (tuneId && selectedTags().length > 0) {
        const currentUser = user();
        if (currentUser?.id) {
          const db = getDb();
          const supabaseUserId = currentUser.id; // This is a UUID string

          // Get current tags from database
          const existingTags = await getTuneTags(db, tuneId, supabaseUserId);
          const existingTagTexts = new Set(existingTags.map((t) => t.tagText));
          const newTagTexts = new Set(selectedTags());

          // Add new tags
          for (const tagText of newTagTexts) {
            if (!existingTagTexts.has(tagText)) {
              await addTagToTune(db, tuneId, supabaseUserId, tagText);
            }
          }

          // Remove deleted tags (only for existing tunes)
          if (props.tune?.id) {
            for (const tag of existingTags) {
              if (!newTagTexts.has(tag.tagText)) {
                await removeTagFromTune(
                  db,
                  tuneId,
                  supabaseUserId,
                  tag.tagText
                );
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Save error:", error);
      setErrors({ submit: "Failed to save tune. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    props.onCancel?.();
  };

  // Chevron rotation for collapsible sections
  const sm2ChevronRotation = createMemo(() =>
    sm2Open() ? "rotate(90deg)" : "rotate(0deg)"
  );
  const fsrsChevronRotation = createMemo(() =>
    fsrsOpen() ? "rotate(90deg)" : "rotate(0deg)"
  );

  return (
    <div class="h-full flex flex-col bg-gray-50 dark:bg-gray-900 overflow-y-auto">
      {/* Scrollable Editor Content flush to left */}
      <div class="max-w-4xl py-1 pl-1 pr-4 w-full">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          {/* Header with buttons inside constrained area (only when not hidden) */}
          <Show when={!props.hideButtons}>
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              {/* Left: Title */}
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {props.readOnly
                  ? title()
                  : props.tune
                    ? "Edit Tune"
                    : "New Tune"}
              </h2>

              {/* Right: Action buttons */}
              <Show
                when={props.readOnly}
                fallback={
                  <div class="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={isSaving()}
                      class="text-gray-700 dark:text-gray-300 hover:underline text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Cancel"
                    >
                      <div class="flex items-center gap-2">
                        <span>Cancel</span>
                        <CircleX size={20} />
                      </div>
                    </button>
                    <button
                      type="submit"
                      onClick={(e) => {
                        e.preventDefault();
                        void handleSave();
                      }}
                      disabled={isSaving() || !isDirty()}
                      class="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      aria-label="Save"
                    >
                      Save <Save size={24} />
                    </button>
                  </div>
                }
              >
                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={props.onCancel}
                    class="text-gray-700 dark:text-gray-300 hover:underline text-sm font-medium"
                    aria-label="Cancel"
                  >
                    <div class="flex items-center gap-2">
                      <span>Cancel</span>
                      <CircleX size={20} />
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={props.onEdit}
                    class="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium flex items-center gap-2"
                    aria-label="Edit"
                  >
                    Edit <Pencil size={24} />
                  </button>
                </div>
              </Show>
            </div>
          </Show>

          {/* Form Content */}
          <div class="p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSave();
              }}
              class="space-y-4"
              data-testid="tune-editor-form"
            >
              {/* Error message */}
              <Show when={errors().submit}>
                <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                  <p class="text-sm text-red-600 dark:text-red-400">
                    {errors().submit}
                  </p>
                </div>
              </Show>

              {/* Core Tune Data Section */}
              <div class="space-y-4">
                {/* <div class="border-b border-gray-300 dark:border-gray-600 pb-2 mb-4">
                  <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">
                    Core Tune Data
                  </h3>
                </div> */}

                {/* Genre */}
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <label
                    for="genre"
                    class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right"
                  >
                    Genre:
                  </label>
                  <div class="md:col-span-2">
                    <select
                      id="genre"
                      value={genre()}
                      onChange={(e) => setGenre(e.currentTarget.value)}
                      disabled={props.readOnly}
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="">Select a genre...</option>
                      <Show when={!allGenres.loading && allGenres()}>
                        <For each={allGenres()}>
                          {(g) => (
                            <option value={g.id} selected={genre() === g.id}>
                              {g.name}
                            </option>
                          )}
                        </For>
                      </Show>
                    </select>
                  </div>
                </div>

                {/* Title */}
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <label
                    for="title"
                    class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right"
                  >
                    Title:{" "}
                    <Show when={!props.readOnly}>
                      <span class="text-red-500">*</span>
                    </Show>
                  </label>
                  <div class="md:col-span-2">
                    <input
                      id="title"
                      type="text"
                      value={title()}
                      onInput={(e) => setTitle(e.currentTarget.value)}
                      placeholder="Tune title"
                      disabled={props.readOnly}
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                      classList={{ "border-red-500": !!errors().title }}
                    />
                    <Show when={errors().title}>
                      <p class="text-xs text-red-500 mt-1">{errors().title}</p>
                    </Show>
                  </div>
                </div>

                {/* Type */}
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <label
                    for="type"
                    class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right"
                  >
                    Type:{" "}
                    <Show when={!props.readOnly}>
                      <span class="text-red-500">*</span>
                    </Show>
                  </label>
                  <div class="md:col-span-2">
                    <select
                      id="type"
                      value={type()}
                      onChange={(e) => setType(e.currentTarget.value)}
                      disabled={props.readOnly}
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                      classList={{ "border-red-500": !!errors().type }}
                    >
                      <option value="">Select type</option>
                      <Show when={!tuneTypes.loading && tuneTypes()}>
                        <For each={tuneTypes()}>
                          {(tt) => (
                            <option value={tt.id} selected={type() === tt.id}>
                              {tt.name} {tt.rhythm ? `(${tt.rhythm})` : ""}
                            </option>
                          )}
                        </For>
                      </Show>
                      <option value="other" selected={type() === "other"}>
                        Other...
                      </option>
                    </select>
                    <Show when={errors().type}>
                      <p class="text-xs text-red-500 mt-1">{errors().type}</p>
                    </Show>
                  </div>
                </div>

                {/* Structure */}
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <label
                    for="structure"
                    class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right"
                  >
                    Structure:
                  </label>
                  <div class="md:col-span-2">
                    <input
                      id="structure"
                      type="text"
                      value={structure()}
                      onInput={(e) => setStructure(e.currentTarget.value)}
                      placeholder="e.g., AABB, ABC"
                      disabled={props.readOnly}
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Mode */}
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <label
                    for="mode"
                    class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right"
                  >
                    Mode:
                  </label>
                  <div class="md:col-span-2">
                    <input
                      id="mode"
                      type="text"
                      value={mode()}
                      onInput={(e) => setMode(e.currentTarget.value)}
                      placeholder="e.g., D Major, A Dorian"
                      disabled={props.readOnly}
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Incipit */}
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                  <label
                    for="incipit"
                    class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right pt-2"
                  >
                    Incipit:
                  </label>
                  <div class="md:col-span-2 space-y-2">
                    <textarea
                      id="incipit"
                      value={incipit()}
                      onInput={(e) => setIncipit(e.currentTarget.value)}
                      placeholder="ABC notation (e.g., |:DFA dAF|GBE gBE|...)"
                      rows={3}
                      disabled={props.readOnly}
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    {/* ABC Preview */}
                    <div class="border border-gray-200 dark:border-gray-700 rounded-md p-3 bg-gray-50 dark:bg-gray-900">
                      <div ref={abcPreviewRef} class="abc-preview" />
                    </div>
                  </div>
                </div>

                {/* Tags */}
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right pt-2">
                    Tags:
                  </span>
                  <div class="md:col-span-2">
                    <TagInput
                      selectedTags={selectedTags()}
                      onTagsChange={setSelectedTags}
                      placeholder="Add tags for organization..."
                      disabled={isSaving() || props.readOnly}
                    />
                    <Show when={!props.readOnly}>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Press Enter to add a tag, or select from existing tags
                      </p>
                    </Show>
                  </div>
                </div>

                {/* Request Public */}
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <label
                    for="request-public"
                    class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right"
                  >
                    Request Public:
                  </label>
                  <div class="md:col-span-2">
                    <input
                      id="request-public"
                      type="checkbox"
                      checked={requestPublic()}
                      onChange={(e) =>
                        setRequestPublic(e.currentTarget.checked)
                      }
                      disabled={props.readOnly}
                      class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <span class="ml-2 text-sm text-gray-600 dark:text-gray-400">
                      Request to make this tune publicly available
                    </span>
                  </div>
                </div>
              </div>

              {/* User/Repertoire Specific Section - placeholder for next phase */}
              <Show when={props.tune}>
                <div class="space-y-4 pt-4">
                  <div class="border-t border-gray-300 dark:border-gray-600 pt-4 mt-4">
                    <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">
                      User/Repertoire Specific Data
                    </h3>
                  </div>

                  {/* Learned Date */}
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <label
                      for="learned"
                      class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right"
                    >
                      <em>Learned Date:</em>
                    </label>
                    <div class="md:col-span-2">
                      <input
                        id="learned"
                        type="datetime-local"
                        value={learned()}
                        onInput={(e) => setLearned(e.currentTarget.value)}
                        disabled={props.readOnly}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Practiced Date */}
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <label
                      for="practiced"
                      class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right"
                    >
                      <em>Practiced Date:</em>
                    </label>
                    <div class="md:col-span-2">
                      <input
                        id="practiced"
                        type="datetime-local"
                        value={practiced()}
                        onInput={(e) => setPracticed(e.currentTarget.value)}
                        disabled={props.readOnly}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Quality */}
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <label
                      for="quality"
                      class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right"
                    >
                      <em>Quality:</em>
                    </label>
                    <div class="md:col-span-2">
                      <input
                        id="quality"
                        type="number"
                        step="0.01"
                        value={quality() ?? ""}
                        onInput={(e) =>
                          setQuality(e.currentTarget.valueAsNumber || null)
                        }
                        disabled={props.readOnly}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Collapsible SM2 Fields */}
                  <div class="pt-2">
                    <button
                      type="button"
                      onClick={() => setSm2Open(!sm2Open())}
                      class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      SM2 Fields
                      <svg
                        class="w-4 h-4 transition-transform"
                        style={{ transform: sm2ChevronRotation() }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <title>Toggle SM2 fields</title>
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>

                    <Show when={sm2Open()}>
                      <div class="mt-4 space-y-4 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                        {/* Easiness */}
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                          <label
                            for="easiness"
                            class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right"
                          >
                            <em>Easiness:</em>
                          </label>
                          <div class="md:col-span-2">
                            <input
                              id="easiness"
                              type="number"
                              step="0.01"
                              value={easiness() ?? ""}
                              onInput={(e) =>
                                setEasiness(
                                  e.currentTarget.valueAsNumber || null
                                )
                              }
                              disabled={props.readOnly}
                              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>

                        {/* Interval */}
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                          <label
                            for="interval"
                            class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right"
                          >
                            <em>Interval:</em>
                          </label>
                          <div class="md:col-span-2">
                            <input
                              id="interval"
                              type="number"
                              value={interval() ?? ""}
                              onInput={(e) =>
                                setInterval(
                                  e.currentTarget.valueAsNumber || null
                                )
                              }
                              disabled={props.readOnly}
                              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>
                      </div>
                    </Show>
                  </div>

                  {/* Collapsible FSRS Fields */}
                  <div class="pt-2">
                    <button
                      type="button"
                      onClick={() => setFsrsOpen(!fsrsOpen())}
                      class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      FSRS Fields
                      <svg
                        class="w-4 h-4 transition-transform"
                        style={{ transform: fsrsChevronRotation() }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <title>Toggle FSRS fields</title>
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>

                    <Show when={fsrsOpen()}>
                      <div class="mt-4 space-y-4 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                        {/* Difficulty */}
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                          <label
                            for="difficulty"
                            class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right"
                          >
                            <em>Difficulty:</em>
                          </label>
                          <div class="md:col-span-2">
                            <input
                              id="difficulty"
                              type="number"
                              step="0.01"
                              value={difficulty() ?? ""}
                              onInput={(e) =>
                                setDifficulty(
                                  e.currentTarget.valueAsNumber || null
                                )
                              }
                              disabled={props.readOnly}
                              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>

                        {/* Stability */}
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                          <label
                            for="stability"
                            class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right"
                          >
                            <em>Stability:</em>
                          </label>
                          <div class="md:col-span-2">
                            <input
                              id="stability"
                              type="number"
                              step="0.01"
                              value={stability() ?? ""}
                              onInput={(e) =>
                                setStability(
                                  e.currentTarget.valueAsNumber || null
                                )
                              }
                              disabled={props.readOnly}
                              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>

                        {/* Step */}
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                          <label
                            for="step"
                            class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right"
                          >
                            <em>Step:</em>
                          </label>
                          <div class="md:col-span-2">
                            <input
                              id="step"
                              type="number"
                              value={step() ?? ""}
                              onInput={(e) =>
                                setStep(e.currentTarget.valueAsNumber || null)
                              }
                              disabled={props.readOnly}
                              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>

                        {/* State */}
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                          <label
                            for="state"
                            class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right"
                          >
                            <em>State:</em>
                          </label>
                          <div class="md:col-span-2">
                            <input
                              id="state"
                              type="number"
                              value={state() ?? ""}
                              onInput={(e) =>
                                setState(e.currentTarget.valueAsNumber || null)
                              }
                              disabled={props.readOnly}
                              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>

                        {/* Repetitions */}
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                          <label
                            for="repetitions"
                            class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right"
                          >
                            <em>Repetitions:</em>
                          </label>
                          <div class="md:col-span-2">
                            <input
                              id="repetitions"
                              type="number"
                              value={repetitions() ?? ""}
                              onInput={(e) =>
                                setRepetitions(
                                  e.currentTarget.valueAsNumber || null
                                )
                              }
                              disabled={props.readOnly}
                              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>

                        {/* Due Date */}
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                          <label
                            for="due"
                            class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right"
                          >
                            <em>Due:</em>
                          </label>
                          <div class="md:col-span-2">
                            <input
                              id="due"
                              type="datetime-local"
                              value={due()}
                              onInput={(e) => setDue(e.currentTarget.value)}
                              disabled={props.readOnly}
                              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>
                      </div>
                    </Show>
                  </div>

                  {/* Private Notes */}
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-start pt-4">
                    <label
                      for="notes"
                      class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right pt-2"
                    >
                      Private Notes:
                    </label>
                    <div class="md:col-span-2">
                      <textarea
                        id="notes"
                        value={notes()}
                        onInput={(e) => setNotes(e.currentTarget.value)}
                        placeholder="Your private notes about this tune..."
                        rows={4}
                        disabled={props.readOnly}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              </Show>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
