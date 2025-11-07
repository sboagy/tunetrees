/**
 * TagInput Component
 *
 * Multi-select tag input with autocomplete from existing user tags.
 * Displays selected tags as removable chips/badges.
 */

import type { Component } from "solid-js";
import { createResource, createSignal, For, Show } from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import { getDb } from "@/lib/db/client-sqlite";
import type { TagWithUsageCount } from "@/lib/db/queries/tags";
import { getUserTags } from "@/lib/db/queries/tags";

interface TagInputProps {
  selectedTags: string[]; // Array of tag text
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const TagInput: Component<TagInputProps> = (props) => {
  const { user } = useAuth();
  const [inputValue, setInputValue] = createSignal("");
  const [showSuggestions, setShowSuggestions] = createSignal(false);

  // Load user's existing tags
  const [userTags] = createResource(async () => {
    const currentUser = user();
    if (!currentUser?.id) return [];
    const db = getDb();
    return await getUserTags(db, currentUser.id); // currentUser.id is already a UUID string
  });

  // Filter suggestions based on input
  const filteredSuggestions = () => {
    const input = inputValue().trim().toLowerCase();
    if (!input || !userTags()) return [];

    const selectedSet = new Set(props.selectedTags.map((t) => t.toLowerCase()));

    return (
      userTags()
        ?.filter(
          (tag) => tag.tagText.includes(input) && !selectedSet.has(tag.tagText)
        )
        .slice(0, 10) ?? [] // Limit to 10 suggestions
    );
  };

  const handleInputChange = (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    setInputValue(value);
    setShowSuggestions(value.trim().length > 0);
  };

  const handleInputKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(inputValue().trim());
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    } else if (
      e.key === "Backspace" &&
      inputValue() === "" &&
      props.selectedTags.length > 0
    ) {
      // Remove last tag if input is empty
      removeTag(props.selectedTags[props.selectedTags.length - 1]);
    }
  };

  const addTag = (tagText: string) => {
    const normalized = tagText.trim().toLowerCase();
    if (
      !normalized ||
      props.selectedTags.some((t) => t.toLowerCase() === normalized)
    ) {
      return;
    }

    props.onTagsChange([...props.selectedTags, normalized]);
    setInputValue("");
    setShowSuggestions(false);
  };

  const removeTag = (tagText: string) => {
    props.onTagsChange(props.selectedTags.filter((t) => t !== tagText));
  };

  const handleSuggestionClick = (tag: TagWithUsageCount) => {
    addTag(tag.tagText);
  };

  const handleInputBlur = () => {
    // Delay to allow suggestion click to register
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  return (
    <div class="tag-input-container">
      <div class="flex flex-wrap gap-2 p-2 border border-gray-300 dark:border-gray-600 rounded-md min-h-[42px] bg-white dark:bg-gray-800">
        {/* Selected tags as chips */}
        <For each={props.selectedTags}>
          {(tag) => (
            <span class="inline-flex items-center gap-1 px-2 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                disabled={props.disabled}
                class="hover:text-blue-600 dark:hover:text-blue-300 focus:outline-none disabled:opacity-50"
                aria-label={`Remove tag ${tag}`}
              >
                <svg
                  class="w-3 h-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <title>Remove</title>
                  <path
                    fill-rule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </span>
          )}
        </For>

        {/* Input field */}
        <input
          type="text"
          value={inputValue()}
          onInput={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onFocus={() => inputValue().trim() && setShowSuggestions(true)}
          onBlur={handleInputBlur}
          disabled={props.disabled}
          placeholder={
            props.selectedTags.length === 0
              ? props.placeholder ?? "Add tags..."
              : ""
          }
          class="flex-1 min-w-[120px] outline-none bg-transparent text-gray-900 dark:text-gray-100 disabled:opacity-50"
        />
      </div>

      {/* Autocomplete suggestions */}
      <Show when={showSuggestions() && filteredSuggestions().length > 0}>
        <div class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
          <For each={filteredSuggestions()}>
            {(tag) => (
              <button
                type="button"
                onClick={() => handleSuggestionClick(tag)}
                class="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex justify-between items-center"
              >
                <span class="text-gray-900 dark:text-gray-100">
                  {tag.tagText}
                </span>
                <span class="text-xs text-gray-500 dark:text-gray-400">
                  {tag.usageCount} {tag.usageCount === 1 ? "tune" : "tunes"}
                </span>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};
