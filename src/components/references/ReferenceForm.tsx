/**
 * ReferenceForm Component
 *
 * Form for creating or editing tune references.
 * Includes URL validation and auto-detection of reference type.
 *
 * @module components/references/ReferenceForm
 */

import { Save, X } from "lucide-solid";
import { type Component, createEffect, createSignal, Show } from "solid-js";
import {
  getSidebarFontClasses,
  useUIPreferences,
} from "@/lib/context/UIPreferencesContext";
import type { Reference } from "@/lib/db/queries/references";
import {
  detectReferenceType,
  extractTitleFromUrl,
  isValidUrl,
} from "@/lib/db/queries/references";

interface ReferenceFormProps {
  reference?: Reference; // If editing existing reference
  onSubmit: (data: ReferenceFormData) => Promise<void> | void;
  onCancel: () => void;
}

export interface ReferenceFormData {
  url: string;
  title: string;
  refType: string;
  comment: string;
  favorite: boolean;
  sourceMode: "url" | "upload";
  uploadFile: File | null;
}

const REFERENCE_TYPES = [
  { value: "video", label: "🎥 Video" },
  { value: "audio", label: "🎵 Audio" },
  { value: "sheet-music", label: "🎼 Sheet Music" },
  { value: "website", label: "🌐 Website" },
  { value: "article", label: "📄 Article" },
  { value: "social", label: "👥 Social Media" },
  { value: "lesson", label: "🎓 Lesson" },
  { value: "other", label: "🔗 Other" },
];

export const ReferenceForm: Component<ReferenceFormProps> = (props) => {
  const { sidebarFontSize } = useUIPreferences();
  const heading = () =>
    props.reference ? "Edit Reference" : "Add New Reference";
  const defaultAudioTitle = (filename: string) =>
    filename.replace(/\.[^.]+$/, "");

  // Form state
  const [url, setUrl] = createSignal(props.reference?.url || "");
  const [title, setTitle] = createSignal(props.reference?.title || "");
  const [refType, setRefType] = createSignal(
    props.reference?.refType || "other"
  );
  const [comment, setComment] = createSignal(props.reference?.comment || "");
  const [favorite, setFavorite] = createSignal(
    props.reference?.favorite === 1 || false
  );
  const [sourceMode, setSourceMode] = createSignal<"url" | "upload">("url");
  const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
  const [fileError, setFileError] = createSignal<string | null>(null);
  const [isDragActive, setIsDragActive] = createSignal(false);

  // Validation state
  const [urlError, setUrlError] = createSignal<string | null>(null);
  const fontClasses = () => getSidebarFontClasses(sidebarFontSize());
  const isAudioUploadMode = () =>
    !props.reference && refType() === "audio" && sourceMode() === "upload";

  const handleSelectedFiles = (files: FileList | null) => {
    const nextFile = files?.[0] || null;
    if (!nextFile) {
      return;
    }

    if (!nextFile.type.startsWith("audio/")) {
      setFileError("Please choose an audio file.");
      return;
    }

    setSelectedFile(nextFile);
    setFileError(null);
    setRefType("audio");
    if (!title()) {
      setTitle(defaultAudioTitle(nextFile.name));
    }
  };

  // Auto-detect reference type and suggest title when URL changes
  createEffect(() => {
    if (isAudioUploadMode()) {
      setUrlError(null);
      return;
    }

    const currentUrl = url();

    if (currentUrl && isValidUrl(currentUrl)) {
      setUrlError(null);

      // Auto-detect type if not manually changed
      if (!props.reference || !refType()) {
        const detectedType = detectReferenceType(currentUrl);
        setRefType(detectedType);
      }

      // Auto-suggest title if empty
      if (!title()) {
        const suggestedTitle = extractTitleFromUrl(currentUrl);
        setTitle(suggestedTitle);
      }
    } else if (currentUrl) {
      setUrlError(
        "Please enter a valid URL (must start with http:// or https://)"
      );
    }
  });

  // Handle form submission
  const handleSubmit = (e: Event) => {
    e.preventDefault();

    if (isAudioUploadMode()) {
      if (!selectedFile()) {
        setFileError("Audio file is required");
        return;
      }

      props.onSubmit({
        url: "",
        title: title() || defaultAudioTitle(selectedFile()!.name),
        refType: "audio",
        comment: comment(),
        favorite: favorite(),
        sourceMode: "upload",
        uploadFile: selectedFile(),
      });
      return;
    }

    // Validate URL
    if (!url()) {
      setUrlError("URL is required");
      return;
    }

    if (!isValidUrl(url())) {
      setUrlError("Please enter a valid URL");
      return;
    }

    // Submit form data
    props.onSubmit({
      url: url(),
      title: title(),
      refType: refType(),
      comment: comment(),
      favorite: favorite(),
      sourceMode: "url",
      uploadFile: null,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      class="space-y-4"
      data-testid="reference-form"
    >
      <div class="flex items-center justify-between mb-1">
        <span
          class={`${fontClasses().text} font-semibold text-gray-700 dark:text-gray-300`}
        >
          {heading()}
        </span>
        <div class="flex gap-1.5">
          <button
            type="button"
            onClick={props.onCancel}
            class={`inline-flex items-center gap-0.5 ${fontClasses().textSmall} px-1.5 py-0.5 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm transition-colors border border-gray-200/50 dark:border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2`}
            data-testid="reference-cancel-button"
          >
            Cancel
            <X class={fontClasses().iconSmall} />
          </button>
          <button
            type="submit"
            class={`inline-flex items-center gap-0.5 ${fontClasses().textSmall} px-1.5 py-0.5 text-green-700 dark:text-green-400 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm transition-colors border border-gray-200/50 dark:border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
            data-testid="reference-submit-button"
          >
            Save
            <Save class={fontClasses().iconSmall} />
          </button>
        </div>
      </div>

      {/* Type Dropdown */}
      <div>
        <label
          for="ref-type"
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Type
        </label>
        <select
          id="ref-type"
          value={refType()}
          onChange={(e) => setRefType(e.currentTarget.value)}
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="reference-type-select"
        >
          {REFERENCE_TYPES.map((type) => (
            <option value={type.value}>{type.label}</option>
          ))}
        </select>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Auto-detected based on URL
        </p>
      </div>

      <Show when={refType() === "audio" && !props.reference}>
        <fieldset>
          <legend class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Audio Source
          </legend>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setSourceMode("upload");
                setUrlError(null);
              }}
              class="rounded-md border px-3 py-2 text-sm font-medium transition-colors"
              classList={{
                "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-200":
                  sourceMode() === "upload",
                "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800":
                  sourceMode() !== "upload",
              }}
              data-testid="reference-audio-source-upload-button"
            >
              Upload File
            </button>
            <button
              type="button"
              onClick={() => {
                setSourceMode("url");
                setFileError(null);
              }}
              class="rounded-md border px-3 py-2 text-sm font-medium transition-colors"
              classList={{
                "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-200":
                  sourceMode() === "url",
                "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800":
                  sourceMode() !== "url",
              }}
              data-testid="reference-audio-source-url-button"
            >
              External URL
            </button>
          </div>
        </fieldset>
      </Show>

      <Show when={!isAudioUploadMode()}>
        <div>
          <label
            for="ref-url"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            URL <span class="text-red-500">*</span>
          </label>
          <input
            id="ref-url"
            type="url"
            value={url()}
            onInput={(e) => setUrl(e.currentTarget.value)}
            placeholder="https://youtube.com/watch?v=..."
            class={`w-full px-3 py-2 border rounded-md ${
              urlError()
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
            } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2`}
            required
            data-testid="reference-url-input"
          />
          {urlError() && (
            <p class="text-sm text-red-600 dark:text-red-400 mt-1">
              {urlError()}
            </p>
          )}
        </div>
      </Show>

      <Show when={isAudioUploadMode()}>
        <fieldset>
          <legend class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Audio File <span class="text-red-500">*</span>
          </legend>
          <input
            id="reference-audio-file-input"
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
            class="hidden"
            onChange={(event) => handleSelectedFiles(event.currentTarget.files)}
            data-testid="reference-audio-file-input"
          />
          <label
            for="reference-audio-file-input"
            class="rounded-md border-2 border-dashed px-4 py-5 text-center transition-colors"
            classList={{
              "border-blue-400 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-950/30":
                isDragActive(),
              "border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40":
                !isDragActive(),
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDragActive(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragActive(false);
              handleSelectedFiles(event.dataTransfer?.files || null);
            }}
            data-testid="reference-audio-dropzone"
          >
            <p class="text-sm font-medium text-gray-800 dark:text-gray-200">
              Drop an audio file here, or choose one from disk.
            </p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Single-file upload for worker-backed practice audio.
            </p>
            <span class="mt-3 inline-flex cursor-pointer items-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
              Choose Audio File
            </span>
            <Show when={selectedFile()}>
              <p
                class="mt-3 text-sm text-gray-700 dark:text-gray-300"
                data-testid="reference-audio-selected-file"
              >
                {selectedFile()!.name}
              </p>
            </Show>
            <Show when={fileError()}>
              <p class="mt-2 text-sm text-red-600 dark:text-red-400">
                {fileError()}
              </p>
            </Show>
          </label>
        </fieldset>
      </Show>

      {/* Title Input */}
      <div>
        <label
          for="ref-title"
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Title
        </label>
        <input
          id="ref-title"
          type="text"
          value={title()}
          onInput={(e) => setTitle(e.currentTarget.value)}
          placeholder={
            isAudioUploadMode()
              ? "Auto-detected from filename"
              : "Auto-detected from URL"
          }
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="reference-title-input"
        />
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {isAudioUploadMode()
            ? "Optional - auto-filled from filename if left blank"
            : "Optional - auto-filled from URL if left blank"}
        </p>
      </div>

      {/* Comment Textarea */}
      <div>
        <label
          for="ref-comment"
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Comment
        </label>
        <textarea
          id="ref-comment"
          value={comment()}
          onInput={(e) => setComment(e.currentTarget.value)}
          placeholder="Add notes about this reference..."
          rows={3}
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="reference-comment-input"
        />
      </div>

      {/* Favorite Checkbox */}
      <div class="flex items-center gap-2">
        <input
          id="ref-favorite"
          type="checkbox"
          checked={favorite()}
          onChange={(e) => setFavorite(e.currentTarget.checked)}
          class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          data-testid="reference-favorite-checkbox"
        />
        <label
          for="ref-favorite"
          class="text-sm text-gray-700 dark:text-gray-300"
        >
          ⭐ Mark as favorite
        </label>
      </div>
    </form>
  );
};
