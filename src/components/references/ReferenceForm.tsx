/**
 * ReferenceForm Component
 *
 * Form for creating or editing tune references.
 * Includes URL validation and auto-detection of reference type.
 *
 * @module components/references/ReferenceForm
 */

import { Save, X } from "lucide-solid";
import { type Component, createEffect, createSignal } from "solid-js";
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
  onSubmit: (data: ReferenceFormData) => void;
  onCancel: () => void;
}

export interface ReferenceFormData {
  url: string;
  title: string;
  refType: string;
  comment: string;
  favorite: boolean;
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

  // Validation state
  const [urlError, setUrlError] = createSignal<string | null>(null);
  const fontClasses = () => getSidebarFontClasses(sidebarFontSize());

  // Auto-detect reference type and suggest title when URL changes
  createEffect(() => {
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

      {/* URL Input */}
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
          placeholder="Auto-detected from URL"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="reference-title-input"
        />
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Optional - auto-filled from URL if left blank
        </p>
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
