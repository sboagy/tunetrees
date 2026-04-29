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
import { toast } from "solid-sonner";
import {
  Select,
  SelectContent,
  SelectHiddenSelect,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  initialData?: Partial<ReferenceFormData>;
  autoOpenTypeSelect?: boolean;
}

export interface ReferenceFormData {
  url: string;
  title: string;
  refType: string;
  comment: string;
  favorite: boolean;
  public: boolean;
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

function getReferenceTypeLabel(value: string): string {
  return (
    REFERENCE_TYPES.find((type) => type.value === value)?.label ||
    "Select type..."
  );
}

function getDefaultSourceMode(
  reference: Reference | undefined,
  initialData: Partial<ReferenceFormData> | undefined
): "url" | "upload" {
  if (initialData?.sourceMode) {
    return initialData.sourceMode;
  }

  return reference ? "url" : "upload";
}

export const ReferenceForm: Component<ReferenceFormProps> = (props) => {
  const { sidebarFontSize } = useUIPreferences();
  const heading = () =>
    props.reference ? "Edit Reference" : "Add New Reference";
  const defaultAudioTitle = (filename: string) =>
    filename.replace(/\.[^.]+$/, "");
  const debugPickerBlockedMessage =
    "File choosers are blocked in debugger-controlled Chrome sessions. Open TuneTrees in a normal Chrome window, or drag an audio file onto the references panel.";
  let audioFileInputRef: HTMLInputElement | undefined;

  // Form state
  const [url, setUrl] = createSignal(
    props.reference?.url || props.initialData?.url || ""
  );
  const [title, setTitle] = createSignal(
    props.reference?.title || props.initialData?.title || ""
  );
  const [refType, setRefType] = createSignal(
    props.reference?.refType || props.initialData?.refType || "other"
  );
  const [comment, setComment] = createSignal(
    props.reference?.comment || props.initialData?.comment || ""
  );
  const [favorite, setFavorite] = createSignal(
    props.reference?.favorite === 1 || props.initialData?.favorite || false
  );
  const [isPublic, setIsPublic] = createSignal(
    props.reference?.public === 1 || props.initialData?.public || false
  );
  const [sourceMode, setSourceMode] = createSignal<"url" | "upload">(
    getDefaultSourceMode(props.reference, props.initialData)
  );
  const [selectedFile, setSelectedFile] = createSignal<File | null>(
    props.initialData?.uploadFile || null
  );
  const [fileError, setFileError] = createSignal<string | null>(null);
  const [isDragActive, setIsDragActive] = createSignal(false);
  const [isTypeMenuOpen, setIsTypeMenuOpen] = createSignal(
    props.autoOpenTypeSelect ?? !props.reference
  );
  const setAudioSourceMode = (mode: "url" | "upload") => {
    setSourceMode(mode);

    if (mode === "upload") {
      setUrlError(null);
      return;
    }

    setFileError(null);
  };

  // Validation state
  const [urlError, setUrlError] = createSignal<string | null>(null);
  const fontClasses = () => getSidebarFontClasses(sidebarFontSize());
  const isAudioUploadMode = () =>
    !props.reference && refType() === "audio" && sourceMode() === "upload";
  const canSubmit = () => {
    if (isAudioUploadMode()) {
      return selectedFile() !== null;
    }

    const currentUrl = url().trim();
    return currentUrl.length > 0 && isValidUrl(currentUrl);
  };

  createEffect(() => {
    const initialData = props.initialData;
    if (props.reference || !initialData) {
      return;
    }

    setUrl(initialData.url || "");
    setTitle(initialData.title || "");
    setRefType(initialData.refType || "other");
    setComment(initialData.comment || "");
    setFavorite(initialData.favorite || false);
    setIsPublic(initialData.public || false);
    setSourceMode(getDefaultSourceMode(props.reference, initialData));
    setSelectedFile(initialData.uploadFile || null);
    setUrlError(null);
    setFileError(null);
    setIsTypeMenuOpen(props.autoOpenTypeSelect ?? false);
  });

  const handleSelectedFile = (nextFile: File | null) => {
    console.log("Audio file selection changed", nextFile?.name ?? "(none)");

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

  const handleSelectedFiles = (files: FileList | null) => {
    handleSelectedFile(files?.[0] || null);
  };

  const handleChooseAudioFile = async () => {
    console.log("Choose Audio File button clicked");

    const browserWindow = window as Window & {
      showOpenFilePicker?: (options?: {
        multiple?: boolean;
        excludeAcceptAllOption?: boolean;
        types?: Array<{
          description?: string;
          accept: Record<string, string[]>;
        }>;
      }) => Promise<Array<{ getFile: () => Promise<File> }>>;
      __TT_ALLOW_DEBUG_FILE_PICKER__?: boolean;
    };
    const isDebugControlledBrowser = navigator.webdriver === true;
    const allowDebugFilePicker =
      browserWindow.__TT_ALLOW_DEBUG_FILE_PICKER__ === true;

    console.log("Choose Audio File capabilities", {
      showOpenFilePicker: typeof browserWindow.showOpenFilePicker,
      webdriver: navigator.webdriver,
      allowDebugFilePicker,
    });

    if (isDebugControlledBrowser && !allowDebugFilePicker) {
      console.log(
        "Blocking file chooser in debugger-controlled browser session"
      );
      toast.error(debugPickerBlockedMessage);
      return;
    }

    if (typeof browserWindow.showOpenFilePicker === "function") {
      try {
        console.log("Using window.showOpenFilePicker");
        const [fileHandle] = await browserWindow.showOpenFilePicker({
          multiple: false,
          excludeAcceptAllOption: false,
          types: [
            {
              description: "Audio Files",
              accept: {
                "audio/mpeg": [".mp3"],
                "audio/wav": [".wav"],
                "audio/ogg": [".ogg"],
                "audio/mp4": [".m4a"],
                "audio/x-m4a": [".m4a"],
                "audio/aac": [".aac"],
                "audio/flac": [".flac"],
              },
            },
          ],
        });
        const file = await fileHandle.getFile();
        console.log("showOpenFilePicker resolved", file.name);
        handleSelectedFile(file);
        return;
      } catch (error) {
        console.log("showOpenFilePicker failed", error);
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        toast.error(debugPickerBlockedMessage);
        return;
      }
    }

    console.log("Falling back to native input click");
    audioFileInputRef?.click();
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
        public: isPublic(),
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
      public: isPublic(),
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
            disabled={!canSubmit()}
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
        <Select
          id="ref-type"
          value={refType()}
          onChange={(value) => {
            setRefType(String(value));
            setIsTypeMenuOpen(false);
          }}
          options={REFERENCE_TYPES.map((type) => type.value)}
          open={isTypeMenuOpen()}
          onOpenChange={setIsTypeMenuOpen}
          sameWidth
          itemComponent={(itemProps) => {
            const optionValue = String(itemProps.item.rawValue);

            return (
              <SelectItem
                item={itemProps.item}
                data-testid={`reference-type-option-${optionValue}`}
              >
                {getReferenceTypeLabel(optionValue)}
              </SelectItem>
            );
          }}
        >
          <SelectHiddenSelect name="refType" />
          <SelectTrigger
            data-testid="reference-type-select"
            aria-label="Reference type"
          >
            <SelectValue<string>>
              {(state) => getReferenceTypeLabel(state.selectedOption() || "")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent />
        </Select>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Auto-detected based on URL
        </p>
      </div>

      <Show when={refType() === "audio" && !props.reference}>
        <fieldset>
          <legend class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Audio Source
          </legend>
          <div
            class="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900/60"
            role="radiogroup"
            aria-label="Audio source"
          >
            <label
              for="reference-audio-source-upload"
              class="cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-all"
              classList={{
                "bg-white text-gray-800 shadow-sm dark:bg-gray-800/80 dark:text-gray-100":
                  sourceMode() === "upload",
                "text-gray-700 hover:bg-white/80 dark:text-gray-200 dark:hover:bg-gray-800/70":
                  sourceMode() !== "upload",
              }}
              data-testid="reference-audio-source-upload-button"
            >
              <input
                id="reference-audio-source-upload"
                type="radio"
                name="reference-audio-source"
                value="upload"
                checked={sourceMode() === "upload"}
                onChange={() => setAudioSourceMode("upload")}
                class="sr-only"
              />
              <span class="flex items-center justify-center gap-2">
                <span
                  class="h-3.5 w-3.5 rounded-full border transition-colors"
                  classList={{
                    "border-blue-600 bg-blue-600 ring-2 ring-blue-200 dark:border-blue-300 dark:bg-blue-300 dark:ring-blue-900/60":
                      sourceMode() === "upload",
                    "border-gray-400 bg-transparent dark:border-gray-500":
                      sourceMode() !== "upload",
                  }}
                  aria-hidden="true"
                />
                <span>Upload File</span>
              </span>
            </label>
            <label
              for="reference-audio-source-url"
              class="cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-all"
              classList={{
                "bg-white text-gray-800 shadow-sm dark:bg-gray-800/80 dark:text-gray-100":
                  sourceMode() === "url",
                "text-gray-700 hover:bg-white/80 dark:text-gray-200 dark:hover:bg-gray-800/70":
                  sourceMode() !== "url",
              }}
              data-testid="reference-audio-source-url-button"
            >
              <input
                id="reference-audio-source-url"
                type="radio"
                name="reference-audio-source"
                value="url"
                checked={sourceMode() === "url"}
                onChange={() => setAudioSourceMode("url")}
                class="sr-only"
              />
              <span class="flex items-center justify-center gap-2">
                <span
                  class="h-3.5 w-3.5 rounded-full border transition-colors"
                  classList={{
                    "border-blue-600 bg-blue-600 ring-2 ring-blue-200 dark:border-blue-300 dark:bg-blue-300 dark:ring-blue-900/60":
                      sourceMode() === "url",
                    "border-gray-400 bg-transparent dark:border-gray-500":
                      sourceMode() !== "url",
                  }}
                  aria-hidden="true"
                />
                <span>External URL</span>
              </span>
            </label>
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
        <div>
          <div class="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            Audio File <span class="text-red-500">*</span>
          </div>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop stays on the container while file selection is handled by the explicit button */}
          <div
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
            <button
              type="button"
              onClick={() => {
                void handleChooseAudioFile();
              }}
              class="mt-3 inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              data-testid="reference-audio-choose-file-button"
            >
              Choose Audio File
            </button>
            <div class="mt-3">
              <input
                id="reference-audio-file-input"
                ref={audioFileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
                class="hidden"
                onClick={() => {
                  console.log("Choose Audio File input clicked");
                }}
                onChange={(event) => {
                  console.log("Choose Audio File input onChange fired");
                  handleSelectedFiles(event.currentTarget.files);
                }}
                aria-label="Choose audio file"
                data-testid="reference-audio-file-input"
              />
            </div>
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
          </div>
        </div>
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

      <div class="space-y-2">
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

        <div class="flex items-center gap-2">
          <input
            id="ref-public"
            type="checkbox"
            checked={isPublic()}
            onChange={(e) => setIsPublic(e.currentTarget.checked)}
            class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            data-testid="reference-public-checkbox"
          />
          <label
            for="ref-public"
            class="text-sm text-gray-700 dark:text-gray-300"
          >
            Share with other users
          </label>
        </div>
      </div>
    </form>
  );
};
