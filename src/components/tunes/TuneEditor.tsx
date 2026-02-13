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

import { A } from "@solidjs/router";
import abcjs from "abcjs";
import { eq } from "drizzle-orm";
import { CircleX, History, Layers, Pencil, Save, Undo2 } from "lucide-solid";
import {
  type Component,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  Show,
} from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCurrentPlaylist } from "@/lib/context/CurrentPlaylistContext";
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
import {
  Select,
  SelectContent,
  SelectHiddenSelect,
  SelectItem,
  SelectTrigger,
} from "../ui/select";
import { TagInput } from "./TagInput";

/**
 * Extended tune data for editor (includes playlist_tune fields)
 */
export interface TuneEditorData extends Tune {
  // Additional fields from tune_override
  request_public?: boolean;
  // playlist_tune fields
  learned?: string;
  goal?: string;
  scheduled?: string;
  current?: string; // Legacy field (ignored)
  // practice_record latest due date
  latest_due?: string;
}

export interface TuneEditorProps {
  tune?: TuneEditorData;
  initialData?: Partial<TuneEditorData>;
  onSave?: (
    tuneData: Partial<TuneEditorData>
  ) => Promise<string | undefined> | string | undefined;
  onCancel?: () => void;
  showAdvancedFields?: boolean;
  hideButtons?: boolean;
  readOnly?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}
export const TuneEditor: Component<TuneEditorProps> = (props) => {
  const { user } = useAuth();
  const { currentPlaylistId } = useCurrentPlaylist();

  // Form state signals
  const init = (field: keyof TuneEditorData): string => {
    const fromTune = props.tune?.[field];
    const fromInitial = props.initialData?.[field];
    const raw = fromTune ?? fromInitial;
    if (raw === null || raw === undefined) return "";
    return String(raw);
  };

  const [genre, setGenre] = createSignal(init("genre"));
  const [title, setTitle] = createSignal(init("title"));
  const [type, setType] = createSignal(init("type"));
  const [structure, setStructure] = createSignal(init("structure"));
  const [mode, setMode] = createSignal(init("mode"));
  const [incipit, setIncipit] = createSignal(init("incipit"));
  const [composer, setComposer] = createSignal(init("composer"));
  const [artist, setArtist] = createSignal(init("artist"));
  const [idForeign, setIdForeign] = createSignal(init("idForeign"));
  const [releaseYear, setReleaseYear] = createSignal(init("releaseYear"));
  const [selectedTags, setSelectedTags] = createSignal<string[]>([]);
  const [requestPublic, setRequestPublic] = createSignal(
    props.tune?.request_public || false
  );

  // Helper to format ISO dates for datetime-local inputs
  const formatDateForInput = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      if (Number.isNaN(date.getTime())) return "";
      // datetime-local expects YYYY-MM-DDTHH:mm format in local time
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
      return "";
    }
  };

  // User/Repertoire specific fields (playlist_tune)
  const [learned, setLearned] = createSignal(
    formatDateForInput(props.tune?.learned)
  );
  const [goal, setGoal] = createSignal(props.tune?.goal || "recall");
  const [scheduled, setScheduled] = createSignal(
    formatDateForInput(props.tune?.scheduled)
  );
  // Next review is computed: scheduled override OR latest practice record due (read-only)
  const computedNextReview = () => {
    const scheduledOverride = props.tune?.scheduled;
    const latestDue = props.tune?.latest_due;
    return formatDateForInput(scheduledOverride || latestDue);
  };

  // UI state
  const [isSaving, setIsSaving] = createSignal(false);
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  // Determine if form should be read-only (global public toggle removed)
  const isFormReadOnly = createMemo(() => props.readOnly);

  // Base public tune (for comparison with user override values)
  const [baseTune] = createResource(
    () => (props.tune?.id ? { tuneId: props.tune.id } : null),
    async (params) => {
      if (!params) return null;
      const db = getDb();
      const { getTuneById } = await import("../../lib/db/queries/tunes");
      return await getTuneById(db, params.tuneId);
    }
  );

  // Field-level override reveal state
  const [revealed, setRevealed] = createSignal<Record<string, boolean>>({});
  const toggleReveal = (field: string) => {
    setRevealed((r) => ({ ...r, [field]: !r[field] }));
  };

  // Signals mapping for comparison
  const fieldGetters: Record<string, () => string> = {
    title,
    genre,
    type,
    structure,
    mode,
    incipit,
    composer,
    artist,
    idForeign,
    releaseYear,
  };
  const fieldHasOverride = (field: string): boolean => {
    if (!props.tune || !baseTune()) return false;
    if (props.tune.privateFor) return false;
    const currentVal = fieldGetters[field]?.() || "";
    const publicVal = (baseTune() as any)[field] || "";
    if (!publicVal) return false;
    return currentVal !== publicVal;
  };

  // Load override record for revert actions
  const [overrideRecord] = createResource(
    () => (props.tune?.id ? { tuneId: props.tune.id } : null),
    async (params) => {
      if (!params) return null;
      const db = getDb();
      const { getTuneOverride } = await import(
        "../../lib/db/queries/tune-overrides"
      );
      const currentUser = user();
      if (!currentUser?.id) return null;
      return await getTuneOverride(db, params.tuneId, currentUser.id);
    }
  );

  const revertField = async (field: keyof TuneEditorData) => {
    if (!props.tune?.id || !baseTune()) return;
    const currentUser = user();
    if (!currentUser?.id) return;
    const db = getDb();
    const ov = overrideRecord();
    if (!ov) return;
    const { clearTuneOverrideFields } = await import(
      "../../lib/db/queries/tune-overrides"
    );
    await clearTuneOverrideFields(db, ov.id, [field as any]);
    const publicVal = (baseTune() as any)[field] || "";
    switch (field) {
      case "title":
        setTitle(publicVal);
        break;
      case "genre":
        setGenre(publicVal);
        break;
      case "type":
        setType(publicVal);
        break;
      case "structure":
        setStructure(publicVal);
        break;
      case "mode":
        setMode(publicVal);
        break;
      case "incipit":
        setIncipit(publicVal);
        break;
      case "composer":
        setComposer(publicVal);
        break;
      case "artist":
        setArtist(publicVal);
        break;
      case "idForeign":
        setIdForeign(publicVal);
        break;
      case "releaseYear":
        setReleaseYear(publicVal ? String(publicVal) : "");
        break;
    }
    setRevealed((r) => ({ ...r, [field]: false }));
  };

  // Load genres from database
  const [allGenres] = createResource(async () => {
    const db = getDb();
    return await getAllGenres(db);
  });

  // Load current playlist (to derive default genre) when creating a new tune
  const [currentPlaylist] = createResource(
    () => {
      if (!currentPlaylistId() || props.tune) return null; // Only for new tunes
      const supaUser = user();
      if (!supaUser?.id) return null;
      return { playlistId: currentPlaylistId()!, userId: supaUser.id };
    },
    async (params) => {
      if (!params) return null;
      const db = getDb();
      const { getPlaylistById } = await import(
        "../../lib/db/queries/playlists"
      );
      const pl = await getPlaylistById(db, params.playlistId, params.userId);
      if (!pl) return null;
      // If playlist.genreDefault null, attempt instrument fallback
      if (!pl.genreDefault && pl.instrumentRef) {
        const { instrument } = await import("../../lib/db/schema");
        const inst = await db
          .select({ genreDefault: instrument.genreDefault })
          .from(instrument)
          .where(eq(instrument.id, pl.instrumentRef))
          .limit(1);
        const resolved = inst && inst.length > 0 ? inst[0].genreDefault : null;
        return { ...pl, resolvedGenreDefault: resolved } as any;
      }
      return { ...pl, resolvedGenreDefault: pl.genreDefault } as any;
    }
  );

  // Apply default genre once when empty
  createEffect(() => {
    if (
      !props.tune && // new tune
      !genre() && // no existing genre selection
      currentPlaylist() &&
      currentPlaylist()!.resolvedGenreDefault
    ) {
      setGenre(currentPlaylist()!.resolvedGenreDefault || "");
    }
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

    // For new tunes, always allow saving
    if (!props.tune) return true;

    // Check core fields
    if (genre() !== init("genre")) return true;
    if (title() !== init("title")) return true;
    if (type() !== init("type")) return true;
    if (structure() !== init("structure")) return true;
    if (mode() !== init("mode")) return true;
    if (incipit() !== init("incipit")) return true;
    if (composer() !== init("composer")) return true;
    if (artist() !== init("artist")) return true;
    if (idForeign() !== init("idForeign")) return true;
    if (releaseYear() !== init("releaseYear")) return true;
    if (requestPublic() !== (props.tune?.request_public || false)) return true;

    // Check user/repertoire fields (only if editing existing tune)
    // Use formatted versions for comparison since inputs store formatted strings
    if (learned() !== formatDateForInput(props.tune.learned)) return true;
    if (goal() !== (props.tune.goal || "recall")) return true;
    if (scheduled() !== formatDateForInput(props.tune.scheduled)) return true;
    // current is read-only, no dirty check needed

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

    if (!genre()) {
      newErrors.genre = "Genre is required";
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

    // Helper to convert datetime-local format to ISO 8601
    const toIsoString = (dateStr: string | undefined): string | undefined => {
      if (!dateStr) return undefined;
      try {
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) return undefined;
        return date.toISOString();
      } catch {
        return undefined;
      }
    };

    const tuneData: Partial<TuneEditorData> = {
      genre: genre() || undefined,
      title: title(),
      type: type(),
      structure: structure() || undefined,
      mode: mode() || undefined,
      incipit: incipit() || undefined,
      composer: composer() || undefined,
      artist: artist() || undefined,
      idForeign: idForeign() || undefined,
      releaseYear: releaseYear() ? Number(releaseYear()) : undefined,
      privateFor: props.tune?.privateFor || undefined,
      request_public: requestPublic(),
      learned: toIsoString(learned()),
      goal: goal() || undefined,
      scheduled: toIsoString(scheduled()),
      // current is read-only, not included in save
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
          const userId = currentUser.id;

          // Get current tags from database
          const existingTags = await getTuneTags(db, tuneId, userId);
          const existingTagTexts = new Set(existingTags.map((t) => t.tagText));
          const newTagTexts = new Set(selectedTags());

          // Add new tags
          for (const tagText of newTagTexts) {
            if (!existingTagTexts.has(tagText)) {
              await addTagToTune(db, tuneId, userId, tagText);
            }
          }

          // Remove deleted tags (only for existing tunes)
          if (props.tune?.id) {
            for (const tag of existingTags) {
              if (!newTagTexts.has(tag.tagText)) {
                await removeTagFromTune(
                  db,
                  tuneId,
                  userId,
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

  return (
    <div
      class="h-full flex flex-col bg-gray-50 dark:bg-gray-900 overflow-y-auto"
      data-testid="tune-editor-container"
    >
      {/* Scrollable Editor Content flush to left */}
      <div class="max-w-4xl py-1 pl-1 pr-4 w-full">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          {/* Header with buttons inside constrained area (only when not hidden) */}
          <Show when={!props.hideButtons}>
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              {/* Left: Title */}
              <div class="flex items-center gap-6">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                  {props.readOnly
                    ? title()
                    : props.tune
                      ? "Edit Tune"
                      : "New Tune"}
                </h2>
              </div>

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
                      data-testid="tune-editor-cancel-button"
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
                      data-testid="tune-editor-save-button"
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
                    data-testid="tune-editor-cancel-button"
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
                    data-testid="tune-editor-edit-button"
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

              {/* Field-level override indicators below */}

              {/* Core Tune Data Section */}
              <div class="space-y-4">
                {/* <div class="border-b border-gray-300 dark:border-gray-600 pb-2 mb-4">
                  <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">
                    Core Tune Data
                  </h3>
                </div> */}

                <Show when={props.tune?.id}>
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <label
                      for="genre"
                      class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right"
                    >
                      Id:
                    </label>
                    <div class="md:col-span-2">
                      <em class="text-gray-400">{props.tune?.id}</em>
                    </div>
                  </div>
                </Show>

                {/* Title */}
                <div class="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                  <label
                    for="title"
                    class="h-9 flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right md:w-40 w-full md:justify-end"
                  >
                    Title:{" "}
                    <Show when={!isFormReadOnly()}>
                      <span class="text-red-500">*</span>
                    </Show>
                  </label>
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <input
                        id="title"
                        type="text"
                        value={title()}
                        onInput={(e) => setTitle(e.currentTarget.value)}
                        placeholder="Tune title"
                        disabled={isFormReadOnly()}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        data-testid="tune-editor-input-title"
                        classList={{ "border-red-500": !!errors().title }}
                      />
                      <Show when={fieldHasOverride("title")}>
                        <button
                          type="button"
                          onClick={() => toggleReveal("title")}
                          data-testid="override-indicator-title"
                          title="Reveal public value / revert"
                          class="shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Layers class="w-4 h-4 text-gray-400" />
                        </button>
                      </Show>
                    </div>
                    <Show when={revealed().title && fieldHasOverride("title")}>
                      <div
                        class="mt-2 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded p-2 space-y-1"
                        data-testid="override-reveal-title"
                      >
                        <div class="flex justify-between items-center">
                          <span class="font-medium">Public Value:</span>
                          <button
                            type="button"
                            onClick={() => void revertField("title")}
                            class="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            data-testid="override-revert-title"
                          >
                            Revert <Undo2 class="w-3 h-3" />
                          </button>
                        </div>
                        <p class="italic break-words">
                          {baseTune()?.title || ""}
                        </p>
                      </div>
                    </Show>
                    <Show when={errors().title}>
                      <p class="text-xs text-red-500 mt-1">{errors().title}</p>
                    </Show>
                  </div>
                </div>

                {/* Genre (Required) */}
                <div class="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                  <label
                    for="genre"
                    class="h-9 flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right md:w-40 w-full md:justify-end"
                  >
                    Genre:{" "}
                    <Show when={!isFormReadOnly()}>
                      <span class="text-red-500">*</span>
                    </Show>
                  </label>
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <Select
                        id="genre"
                        value={genre()}
                        onChange={setGenre}
                        disabled={isFormReadOnly()}
                        options={(allGenres() ?? []).map((g) => String(g.id))}
                        class="w-full"
                        itemComponent={(props) => {
                          const opts = allGenres() || [];
                          const raw =
                            (props.item as any)?.rawValue ?? props.item;
                          const g = opts.find(
                            (x) => String(x.id) === String(raw)
                          );
                          return (
                            <SelectItem item={props.item}>
                              {g ? g.name : String(raw)}
                            </SelectItem>
                          );
                        }}
                      >
                        <SelectHiddenSelect name="genre" />
                        <SelectTrigger
                          class={`flex h-9 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-[1.5px] focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 ${errors().genre ? "border-red-500" : ""}`}
                          data-testid="tune-editor-select-genre"
                        >
                          {(() => {
                            const opts = allGenres() || [];
                            const g = opts.find(
                              (x) => String(x.id) === String(genre())
                            );
                            return g ? (
                              <span>{g.name}</span>
                            ) : (
                              <span class="text-gray-500 dark:text-gray-400">
                                Select Genre...
                              </span>
                            );
                          })()}
                        </SelectTrigger>
                        <SelectContent />
                      </Select>
                      <Show when={fieldHasOverride("genre")}>
                        <button
                          type="button"
                          onClick={() => toggleReveal("genre")}
                          data-testid="override-indicator-genre"
                          title="Reveal public value / revert"
                          class="shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Layers class="w-4 h-4 text-gray-400" />
                        </button>
                      </Show>
                    </div>
                    <Show when={revealed().genre && fieldHasOverride("genre")}>
                      <div
                        class="mt-2 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded p-2 space-y-1"
                        data-testid="override-reveal-genre"
                      >
                        <div class="flex justify-between items-center">
                          <span class="font-medium">Public Value:</span>
                          <button
                            type="button"
                            onClick={() => void revertField("genre")}
                            class="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            data-testid="override-revert-genre"
                          >
                            Revert <Undo2 class="w-3 h-3" />
                          </button>
                        </div>
                        <p class="italic break-words">
                          {(() => {
                            const gId = baseTune()?.genre;
                            const opts = allGenres() || [];
                            const g = opts.find(
                              (x) => String(x.id) === String(gId)
                            );
                            return g ? g.name : gId || "";
                          })()}
                        </p>
                      </div>
                    </Show>
                    <Show when={errors().genre}>
                      <p class="text-xs text-red-500 mt-1">{errors().genre}</p>
                    </Show>
                  </div>
                </div>

                {/* Type */}
                <div class="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                  <label
                    for="type"
                    class="h-9 flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right md:w-40 w-full md:justify-end"
                  >
                    Type:{" "}
                    <Show when={!isFormReadOnly()}>
                      <span class="text-red-500">*</span>
                    </Show>
                  </label>
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <Select
                        id="type"
                        value={type()}
                        onChange={setType}
                        disabled={isFormReadOnly()}
                        options={(tuneTypes() ?? [])
                          .map((tt) => String(tt.id))
                          .concat(["other"])}
                        class="w-full"
                        itemComponent={(props) => {
                          const opts = tuneTypes() || [];
                          const raw =
                            (props.item as any)?.rawValue ?? props.item;
                          const tt = opts.find(
                            (x) => String(x.id) === String(raw)
                          );
                          return (
                            <SelectItem item={props.item}>
                              {tt
                                ? `${tt.name}${tt.rhythm ? ` (${tt.rhythm})` : ""}`
                                : String(raw)}
                            </SelectItem>
                          );
                        }}
                      >
                        <SelectTrigger
                          class={`flex h-9 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-[1.5px] focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 ${
                            errors().type ? "border-red-500" : ""
                          }`}
                          data-testid="tune-editor-select-type"
                        >
                          {(() => {
                            const opts = tuneTypes() || [];
                            const tt = opts.find(
                              (x) => String(x.id) === String(type())
                            );
                            return tt ? (
                              <span>
                                {tt.name}
                                {tt.rhythm ? ` (${tt.rhythm})` : ""}
                              </span>
                            ) : (
                              <span class="text-gray-500 dark:text-gray-400">
                                Select Tune Type... (Dependent on Genre)
                              </span>
                            );
                          })()}
                        </SelectTrigger>
                        <SelectContent />
                      </Select>
                      <Show when={fieldHasOverride("type")}>
                        <button
                          type="button"
                          onClick={() => toggleReveal("type")}
                          data-testid="override-indicator-type"
                          title="Reveal public value / revert"
                          class="shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Layers class="w-4 h-4 text-gray-400" />
                        </button>
                      </Show>
                    </div>
                    <Show when={revealed().type && fieldHasOverride("type")}>
                      <div
                        class="mt-2 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded p-2 space-y-1"
                        data-testid="override-reveal-type"
                      >
                        <div class="flex justify-between items-center">
                          <span class="font-medium">Public Value:</span>
                          <button
                            type="button"
                            onClick={() => void revertField("type")}
                            class="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            data-testid="override-revert-type"
                          >
                            Revert <Undo2 class="w-3 h-3" />
                          </button>
                        </div>
                        <p class="italic break-words">
                          {(() => {
                            const tId = baseTune()?.type;
                            const opts = tuneTypes() || [];
                            const tt = opts.find(
                              (x) => String(x.id) === String(tId)
                            );
                            return tt
                              ? `${tt.name}${tt.rhythm ? ` (${tt.rhythm})` : ""}`
                              : tId || "";
                          })()}
                        </p>
                      </div>
                    </Show>
                    <Show when={errors().type}>
                      <p class="text-xs text-red-500 mt-1">{errors().type}</p>
                    </Show>
                  </div>
                </div>

                {/* Structure */}
                <div class="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                  <label
                    for="structure"
                    class="h-9 flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right md:w-40 w-full md:justify-end"
                  >
                    Structure:
                  </label>
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <input
                        id="structure"
                        type="text"
                        value={structure()}
                        onInput={(e) => setStructure(e.currentTarget.value)}
                        placeholder="e.g., AABB, ABC"
                        disabled={isFormReadOnly()}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                        data-testid="tune-editor-input-structure"
                      />
                      <Show when={fieldHasOverride("structure")}>
                        <button
                          type="button"
                          onClick={() => toggleReveal("structure")}
                          data-testid="override-indicator-structure"
                          title="Reveal public value / revert"
                          class="shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Layers class="w-4 h-4 text-gray-400" />
                        </button>
                      </Show>
                    </div>
                    <Show
                      when={
                        revealed().structure && fieldHasOverride("structure")
                      }
                    >
                      <div
                        class="mt-2 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded p-2 space-y-1"
                        data-testid="override-reveal-structure"
                      >
                        <div class="flex justify-between items-center">
                          <span class="font-medium">Public Value:</span>
                          <button
                            type="button"
                            onClick={() => void revertField("structure")}
                            class="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            data-testid="override-revert-structure"
                          >
                            Revert <Undo2 class="w-3 h-3" />
                          </button>
                        </div>
                        <p class="italic break-words">
                          {baseTune()?.structure || ""}
                        </p>
                      </div>
                    </Show>
                  </div>
                </div>

                {/* Mode */}
                <div class="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                  <label
                    for="mode"
                    class="h-9 flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right md:w-40 w-full md:justify-end"
                  >
                    Mode:
                  </label>
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <input
                        id="mode"
                        type="text"
                        value={mode()}
                        onInput={(e) => setMode(e.currentTarget.value)}
                        placeholder="e.g., D Major, A Dorian"
                        disabled={isFormReadOnly()}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        data-testid="tune-editor-input-mode"
                      />
                      <Show when={fieldHasOverride("mode")}>
                        <button
                          type="button"
                          onClick={() => toggleReveal("mode")}
                          data-testid="override-indicator-mode"
                          title="Reveal public value / revert"
                          class="shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Layers class="w-4 h-4 text-gray-400" />
                        </button>
                      </Show>
                    </div>
                    <Show when={revealed().mode && fieldHasOverride("mode")}>
                      <div
                        class="mt-2 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded p-2 space-y-1"
                        data-testid="override-reveal-mode"
                      >
                        <div class="flex justify-between items-center">
                          <span class="font-medium">Public Value:</span>
                          <button
                            type="button"
                            onClick={() => void revertField("mode")}
                            class="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            data-testid="override-revert-mode"
                          >
                            Revert <Undo2 class="w-3 h-3" />
                          </button>
                        </div>
                        <p class="italic break-words">
                          {baseTune()?.mode || ""}
                        </p>
                      </div>
                    </Show>
                  </div>
                </div>

                {/* Incipit */}
                <div class="flex flex-col md:flex-row md:items-start gap-1 md:gap-2">
                  <label
                    for="incipit"
                    class="pt-2 flex text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right md:w-40 w-full md:justify-end"
                  >
                    Incipit:
                  </label>
                  <div class="flex-1 space-y-2">
                    <div class="flex items-center gap-2">
                      <textarea
                        id="incipit"
                        value={incipit()}
                        onInput={(e) => setIncipit(e.currentTarget.value)}
                        placeholder="ABC notation (e.g., |:DFA dAF|GBE gBE|...)"
                        rows={3}
                        disabled={isFormReadOnly()}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                        data-testid="tune-editor-textarea-incipit"
                      />
                      <Show when={fieldHasOverride("incipit")}>
                        <button
                          type="button"
                          onClick={() => toggleReveal("incipit")}
                          data-testid="override-indicator-incipit"
                          title="Reveal public value / revert"
                          class="shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Layers class="w-4 h-4 text-gray-400" />
                        </button>
                      </Show>
                    </div>
                    <Show
                      when={revealed().incipit && fieldHasOverride("incipit")}
                    >
                      <div
                        class="mt-2 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded p-2 space-y-1"
                        data-testid="override-reveal-incipit"
                      >
                        <div class="flex justify-between items-center">
                          <span class="font-medium">Public Value:</span>
                          <button
                            type="button"
                            onClick={() => void revertField("incipit")}
                            class="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            data-testid="override-revert-incipit"
                          >
                            Revert <Undo2 class="w-3 h-3" />
                          </button>
                        </div>
                        <p class="italic break-words whitespace-pre-wrap">
                          {baseTune()?.incipit || ""}
                        </p>
                      </div>
                    </Show>
                    {/* ABC Preview */}
                    <div class="border border-gray-200 dark:border-gray-700 rounded-md p-3 bg-gray-50 dark:bg-gray-900">
                      <div ref={abcPreviewRef} class="abc-preview" />
                    </div>
                  </div>
                </div>

                {/* Composer */}
                <div class="flex flex-col md:flex-row md:items-start gap-1 md:gap-2">
                  <label
                    for="composer"
                    class="pt-2 flex text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right md:w-40 w-full md:justify-end"
                  >
                    Composer:
                  </label>
                  <div class="flex-1 space-y-2">
                    <div class="flex items-center gap-2">
                      <input
                        type="text"
                        id="composer"
                        value={composer()}
                        onInput={(e) => setComposer(e.currentTarget.value)}
                        placeholder="e.g., Bach, Mozart (Classical/Choral)"
                        disabled={isFormReadOnly()}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        data-testid="tune-editor-input-composer"
                      />
                      <Show when={fieldHasOverride("composer")}>
                        <button
                          type="button"
                          onClick={() => toggleReveal("composer")}
                          data-testid="override-indicator-composer"
                          title="Reveal public value / revert"
                          class="shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Layers class="w-4 h-4 text-gray-400" />
                        </button>
                      </Show>
                    </div>
                    <Show
                      when={revealed().composer && fieldHasOverride("composer")}
                    >
                      <div
                        class="mt-2 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded p-2 space-y-1"
                        data-testid="override-reveal-composer"
                      >
                        <div class="flex justify-between items-center">
                          <span class="font-medium">Public Value:</span>
                          <button
                            type="button"
                            onClick={() => void revertField("composer")}
                            class="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            data-testid="override-revert-composer"
                          >
                            Revert <Undo2 class="w-3 h-3" />
                          </button>
                        </div>
                        <p class="italic break-words">
                          {baseTune()?.composer || ""}
                        </p>
                      </div>
                    </Show>
                  </div>
                </div>

                {/* Artist */}
                <div class="flex flex-col md:flex-row md:items-start gap-1 md:gap-2">
                  <label
                    for="artist"
                    class="pt-2 flex text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right md:w-40 w-full md:justify-end"
                  >
                    Artist:
                  </label>
                  <div class="flex-1 space-y-2">
                    <div class="flex items-center gap-2">
                      <input
                        type="text"
                        id="artist"
                        value={artist()}
                        onInput={(e) => setArtist(e.currentTarget.value)}
                        placeholder="e.g., Beatles, Miles Davis (Pop/Rock/Jazz)"
                        disabled={isFormReadOnly()}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        data-testid="tune-editor-input-artist"
                      />
                      <Show when={fieldHasOverride("artist")}>
                        <button
                          type="button"
                          onClick={() => toggleReveal("artist")}
                          data-testid="override-indicator-artist"
                          title="Reveal public value / revert"
                          class="shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Layers class="w-4 h-4 text-gray-400" />
                        </button>
                      </Show>
                    </div>
                    <Show
                      when={revealed().artist && fieldHasOverride("artist")}
                    >
                      <div
                        class="mt-2 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded p-2 space-y-1"
                        data-testid="override-reveal-artist"
                      >
                        <div class="flex justify-between items-center">
                          <span class="font-medium">Public Value:</span>
                          <button
                            type="button"
                            onClick={() => void revertField("artist")}
                            class="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            data-testid="override-revert-artist"
                          >
                            Revert <Undo2 class="w-3 h-3" />
                          </button>
                        </div>
                        <p class="italic break-words">
                          {baseTune()?.artist || ""}
                        </p>
                      </div>
                    </Show>
                  </div>
                </div>

                {/* Release Year */}
                <div class="flex flex-col md:flex-row md:items-start gap-1 md:gap-2">
                  <label
                    for="release_year"
                    class="pt-2 flex text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right md:w-40 w-full md:justify-end"
                  >
                    Release Year:
                  </label>
                  <div class="flex-1 space-y-2">
                    <div class="flex items-center gap-2">
                      <input
                        type="number"
                        id="release_year"
                        value={releaseYear()}
                        onInput={(e) => setReleaseYear(e.currentTarget.value)}
                        placeholder="e.g., 1969"
                        min="1000"
                        max="2100"
                        disabled={isFormReadOnly()}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        data-testid="tune-editor-input-release_year"
                      />
                      <Show when={fieldHasOverride("releaseYear")}>
                        <button
                          type="button"
                          onClick={() => toggleReveal("releaseYear")}
                          data-testid="override-indicator-release_year"
                          title="Reveal public value / revert"
                          class="shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Layers class="w-4 h-4 text-gray-400" />
                        </button>
                      </Show>
                    </div>
                    <Show
                      when={
                        revealed().releaseYear &&
                        fieldHasOverride("releaseYear")
                      }
                    >
                      <div
                        class="mt-2 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded p-2 space-y-1"
                        data-testid="override-reveal-release_year"
                      >
                        <div class="flex justify-between items-center">
                          <span class="font-medium">Public Value:</span>
                          <button
                            type="button"
                            onClick={() => void revertField("releaseYear")}
                            class="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            data-testid="override-revert-release_year"
                          >
                            Revert <Undo2 class="w-3 h-3" />
                          </button>
                        </div>
                        <p class="italic break-words">
                          {baseTune()?.releaseYear || ""}
                        </p>
                      </div>
                    </Show>
                  </div>
                </div>

                {/* External ID */}
                <div class="flex flex-col md:flex-row md:items-start gap-1 md:gap-2">
                  <label
                    for="id_foreign"
                    class="pt-2 flex text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right md:w-40 w-full md:justify-end"
                  >
                    External ID:
                  </label>
                  <div class="flex-1 space-y-2">
                    <div class="flex items-center gap-2">
                      <input
                        type="text"
                        id="id_foreign"
                        value={idForeign()}
                        onInput={(e) => setIdForeign(e.currentTarget.value)}
                        placeholder="Spotify ID, YouTube ID, etc."
                        disabled={isFormReadOnly()}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                        data-testid="tune-editor-input-id_foreign"
                      />
                      <Show when={fieldHasOverride("idForeign")}>
                        <button
                          type="button"
                          onClick={() => toggleReveal("idForeign")}
                          data-testid="override-indicator-id_foreign"
                          title="Reveal public value / revert"
                          class="shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Layers class="w-4 h-4 text-gray-400" />
                        </button>
                      </Show>
                    </div>
                    <Show
                      when={
                        revealed().idForeign && fieldHasOverride("idForeign")
                      }
                    >
                      <div
                        class="mt-2 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded p-2 space-y-1"
                        data-testid="override-reveal-id_foreign"
                      >
                        <div class="flex justify-between items-center">
                          <span class="font-medium">Public Value:</span>
                          <button
                            type="button"
                            onClick={() => void revertField("idForeign")}
                            class="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            data-testid="override-revert-id_foreign"
                          >
                            Revert <Undo2 class="w-3 h-3" />
                          </button>
                        </div>
                        <p class="italic break-words font-mono">
                          {baseTune()?.idForeign || ""}
                        </p>
                      </div>
                    </Show>
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
                      disabled={isSaving() || isFormReadOnly()}
                    />
                    <Show when={!isFormReadOnly()}>
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
                      disabled={isFormReadOnly()}
                      class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                      data-testid="tune-editor-checkbox-request-public"
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
                        disabled={isFormReadOnly()}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        data-testid="tune-editor-input-learned"
                      />
                    </div>
                  </div>

                  {/* Practice Goal */}
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <label
                      for="goal"
                      class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right"
                    >
                      Practice Goal:
                    </label>
                    <div class="md:col-span-2">
                      <select
                        id="goal"
                        value={goal()}
                        onChange={(e) => setGoal(e.currentTarget.value)}
                        disabled={isFormReadOnly()}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        data-testid="tune-editor-select-goal"
                      >
                        <option value="initial_learn">Initial Learn</option>
                        <option value="recall">Recall</option>
                        <option value="fluency">Fluency</option>
                        <option value="session_ready">Session Ready</option>
                        <option value="performance_polish">
                          Performance Polish
                        </option>
                      </select>
                    </div>
                  </div>

                  {/* Schedule Override */}
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <label
                      for="scheduled"
                      class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right"
                    >
                      Schedule Override:
                    </label>
                    <div class="md:col-span-2">
                      <input
                        id="scheduled"
                        type="datetime-local"
                        value={scheduled()}
                        onInput={(e) => setScheduled(e.currentTarget.value)}
                        disabled={isFormReadOnly()}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        data-testid="tune-editor-input-scheduled"
                      />
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Force this tune into your queue on this date. Cleared
                        after practice.
                      </p>
                    </div>
                  </div>

                  {/* Next Review (Computed - Read Only) */}
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <label
                      for="current"
                      class="text-sm font-medium text-gray-700 dark:text-gray-300 md:text-right"
                    >
                      Next Review (Computed):
                    </label>
                    <div class="md:col-span-2">
                      <input
                        id="current"
                        type="text"
                        value={
                          computedNextReview()
                            ? new Date(computedNextReview()).toLocaleString()
                            : "Not scheduled"
                        }
                        disabled={true}
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm cursor-not-allowed"
                        data-testid="tune-editor-input-current"
                      />
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        FSRS-calculated next review date. Updates automatically
                        after each practice.
                      </p>
                    </div>
                  </div>

                  {/* Practice History Link */}
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <div class="hidden md:block" />
                    <div class="md:col-span-2">
                      <A
                        href={`/tunes/${props.tune?.id}/practice-history`}
                        class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-300 dark:border-blue-600 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        data-testid="tune-editor-practice-history-link"
                      >
                        <History class="w-4 h-4" />
                        View Practice History
                      </A>
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
