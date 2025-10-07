/**
 * TagList Component
 *
 * Display tags as small badge/chips.
 * Used in tune lists, tune detail pages, and anywhere tags need to be shown.
 */

import { type Component, For, Show } from "solid-js";

interface TagListProps {
  tags: string[];
  /** Maximum number of tags to show (rest hidden with "+N more") */
  maxVisible?: number;
  /** Size variant */
  size?: "sm" | "md";
  /** Color variant */
  variant?: "default" | "primary" | "secondary";
}

export const TagList: Component<TagListProps> = (props) => {
  const maxVisible = () => props.maxVisible ?? props.tags.length;
  const visibleTags = () => props.tags.slice(0, maxVisible());
  const remainingCount = () => Math.max(0, props.tags.length - maxVisible());

  const sizeClasses = () => {
    switch (props.size ?? "sm") {
      case "sm":
        return "text-xs px-2 py-0.5";
      case "md":
        return "text-sm px-2.5 py-1";
    }
  };

  const variantClasses = () => {
    switch (props.variant ?? "default") {
      case "default":
        return "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300";
      case "primary":
        return "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200";
      case "secondary":
        return "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200";
    }
  };

  return (
    <Show
      when={props.tags.length > 0}
      fallback={
        <span class="text-xs text-gray-400 dark:text-gray-500 italic">
          No tags
        </span>
      }
    >
      <div class="flex flex-wrap gap-1 items-center">
        <For each={visibleTags()}>
          {(tag) => (
            <span
              class={`inline-flex items-center rounded-full font-medium ${sizeClasses()} ${variantClasses()}`}
            >
              {tag}
            </span>
          )}
        </For>
        <Show when={remainingCount() > 0}>
          <span class="text-xs text-gray-500 dark:text-gray-400">
            +{remainingCount()} more
          </span>
        </Show>
      </div>
    </Show>
  );
};
