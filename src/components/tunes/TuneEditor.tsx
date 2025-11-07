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
import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  For,
  Show,
} from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import { getDb } from "@/lib/db/client-sqlite";
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
  /** Callback when save is requested (should return tune ID for new tunes) */
  onSave?: (
    tuneData: Partial<TuneEditorData>
  ) => Promise<string | undefined> | undefined;
  /** Callback when cancel is requested */
  onCancel?: () => void;
  /** Show all FSRS/SM2 fields (collapsed by default) */
  showAdvancedFields?: boolean;
}

// Tune types list (from legacy app)
const TUNE_TYPES = [
  { id: "Jig", name: "Jig", rhythm: "6/8" },
  { id: "Reel", name: "Reel", rhythm: "4/4" },
  { id: "SlipJig", name: "Slip Jig", rhythm: "9/8" },
  { id: "Hornpipe", name: "Hornpipe", rhythm: "4/4" },
  { id: "Polka", name: "Polka", rhythm: "2/4" },
  { id: "Waltz", name: "Waltz", rhythm: "3/4" },
  { id: "Mazurka", name: "Mazurka", rhythm: "3/4" },
  { id: "March", name: "March", rhythm: "4/4" },
  { id: "Strathspey", name: "Strathspey", rhythm: "4/4" },
  { id: "Barndance", name: "Barndance", rhythm: "4/4" },
  { id: "Slide", name: "Slide", rhythm: "12/8" },
  { id: "Fling", name: "Fling", rhythm: "4/4" },
  { id: "Song", name: "Song", rhythm: "" },
  { id: "Slow Air", name: "Slow Air", rhythm: "" },
  { id: "Other", name: "Other", rhythm: "" },
];

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
  const [genre, setGenre] = createSignal(props.tune?.genre || "");
  const [title, setTitle] = createSignal(props.tune?.title || "");
  const [type, setType] = createSignal(props.tune?.type || "");
  const [structure, setStructure] = createSignal(props.tune?.structure || "");
  const [mode, setMode] = createSignal(props.tune?.mode || "");
  const [incipit, setIncipit] = createSignal(props.tune?.incipit || "");
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
        const abcNotation = `X:1\nT:${title() || "Preview"}\nM:4/4\nL:1/8\nK:${
          mode() || "D"
        }\n${incipitValue}`;
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
    <div class="w-full max-w-4xl mx-auto">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {props.tune ? "Edit Tune" : "New Tune"}
        </h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
          class="space-y-4"
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
            <div class="border-b border-gray-300 dark:border-gray-600 pb-2 mb-4">
              <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">
                Core Tune Data
              </h3>
            </div>

            {/* Genre */}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <label
                for="genre"
                class="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Genre:
              </label>
              <div class="md:col-span-2">
                <input
                  id="genre"
                  type="text"
                  value={genre()}
                  onInput={(e) => setGenre(e.currentTarget.value)}
                  placeholder="e.g., ITRAD, SCOT, BLUEGRASS"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
            </div>

            {/* Title */}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <label
                for="title"
                class="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Title: <span class="text-red-500">*</span>
              </label>
              <div class="md:col-span-2">
                <input
                  id="title"
                  type="text"
                  value={title()}
                  onInput={(e) => setTitle(e.currentTarget.value)}
                  placeholder="Tune title"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
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
                class="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Type: <span class="text-red-500">*</span>
              </label>
              <div class="md:col-span-2">
                <select
                  id="type"
                  value={type()}
                  onChange={(e) => setType(e.currentTarget.value)}
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  classList={{ "border-red-500": !!errors().type }}
                >
                  <option value="">Select type</option>
                  <For each={TUNE_TYPES}>
                    {(tuneType) => (
                      <option value={tuneType.id}>
                        {tuneType.name}{" "}
                        {tuneType.rhythm ? `(${tuneType.rhythm})` : ""}
                      </option>
                    )}
                  </For>
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
                class="text-sm font-medium text-gray-700 dark:text-gray-300"
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
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm font-mono"
                />
              </div>
            </div>

            {/* Mode */}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <label
                for="mode"
                class="text-sm font-medium text-gray-700 dark:text-gray-300"
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
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
            </div>

            {/* Incipit */}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              <label
                for="incipit"
                class="text-sm font-medium text-gray-700 dark:text-gray-300 pt-2"
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
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm font-mono"
                />
                {/* ABC Preview */}
                <div class="border border-gray-200 dark:border-gray-700 rounded-md p-3 bg-gray-50 dark:bg-gray-900">
                  <div ref={abcPreviewRef} class="abc-preview" />
                </div>
              </div>
            </div>

            {/* Tags */}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300 pt-2">
                Tags:
              </span>
              <div class="md:col-span-2">
                <TagInput
                  selectedTags={selectedTags()}
                  onTagsChange={setSelectedTags}
                  placeholder="Add tags for organization..."
                  disabled={isSaving()}
                />
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Press Enter to add a tag, or select from existing tags
                </p>
              </div>
            </div>

            {/* Request Public */}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <label
                for="request-public"
                class="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Request Public:
              </label>
              <div class="md:col-span-2">
                <input
                  id="request-public"
                  type="checkbox"
                  checked={requestPublic()}
                  onChange={(e) => setRequestPublic(e.currentTarget.checked)}
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
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
                  class="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  <em>Learned Date:</em>
                </label>
                <div class="md:col-span-2">
                  <input
                    id="learned"
                    type="datetime-local"
                    value={learned()}
                    onInput={(e) => setLearned(e.currentTarget.value)}
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  />
                </div>
              </div>

              {/* Practiced Date */}
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <label
                  for="practiced"
                  class="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  <em>Practiced Date:</em>
                </label>
                <div class="md:col-span-2">
                  <input
                    id="practiced"
                    type="datetime-local"
                    value={practiced()}
                    onInput={(e) => setPracticed(e.currentTarget.value)}
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  />
                </div>
              </div>

              {/* Quality */}
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <label
                  for="quality"
                  class="text-sm font-medium text-gray-700 dark:text-gray-300"
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
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
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
                        class="text-sm font-medium text-gray-700 dark:text-gray-300"
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
                            setEasiness(e.currentTarget.valueAsNumber || null)
                          }
                          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      </div>
                    </div>

                    {/* Interval */}
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <label
                        for="interval"
                        class="text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        <em>Interval:</em>
                      </label>
                      <div class="md:col-span-2">
                        <input
                          id="interval"
                          type="number"
                          value={interval() ?? ""}
                          onInput={(e) =>
                            setInterval(e.currentTarget.valueAsNumber || null)
                          }
                          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
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
                        class="text-sm font-medium text-gray-700 dark:text-gray-300"
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
                            setDifficulty(e.currentTarget.valueAsNumber || null)
                          }
                          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      </div>
                    </div>

                    {/* Stability */}
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <label
                        for="stability"
                        class="text-sm font-medium text-gray-700 dark:text-gray-300"
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
                            setStability(e.currentTarget.valueAsNumber || null)
                          }
                          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      </div>
                    </div>

                    {/* Step */}
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <label
                        for="step"
                        class="text-sm font-medium text-gray-700 dark:text-gray-300"
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
                          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      </div>
                    </div>

                    {/* State */}
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <label
                        for="state"
                        class="text-sm font-medium text-gray-700 dark:text-gray-300"
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
                          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      </div>
                    </div>

                    {/* Repetitions */}
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <label
                        for="repetitions"
                        class="text-sm font-medium text-gray-700 dark:text-gray-300"
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
                          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      </div>
                    </div>

                    {/* Due Date */}
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <label
                        for="due"
                        class="text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        <em>Due:</em>
                      </label>
                      <div class="md:col-span-2">
                        <input
                          id="due"
                          type="datetime-local"
                          value={due()}
                          onInput={(e) => setDue(e.currentTarget.value)}
                          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
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
                  class="text-sm font-medium text-gray-700 dark:text-gray-300 pt-2"
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
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  />
                </div>
              </div>
            </div>
          </Show>

          {/* Action Buttons */}
          <div class="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleCancel}
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving()}
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Show when={isSaving()} fallback={<>Save</>}>
                <div class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Saving...
              </Show>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
