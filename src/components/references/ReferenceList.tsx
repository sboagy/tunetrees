/**
 * ReferenceList Component
 *
 * Display references as clickable links with icons based on type.
 * Includes edit/delete actions.
 *
 * @module components/references/ReferenceList
 */

import { type Component, For, Show } from "solid-js";
import type { Reference } from "@/lib/db/queries/references";

interface ReferenceListProps {
  references: Reference[];
  onEdit?: (reference: Reference) => void;
  onDelete?: (referenceId: number) => void;
  showActions?: boolean;
  groupByType?: boolean;
}

/**
 * Get icon for reference type
 */
function getTypeIcon(refType: string | null): string {
  switch (refType) {
    case "video":
      return "🎥";
    case "sheet-music":
      return "🎼";
    case "article":
      return "📄";
    case "social":
      return "👥";
    default:
      return "🔗";
  }
}

/**
 * Get human-readable type label
 */
function getTypeLabel(refType: string | null): string {
  switch (refType) {
    case "video":
      return "Video";
    case "sheet-music":
      return "Sheet Music";
    case "article":
      return "Article";
    case "social":
      return "Social Media";
    default:
      return "Link";
  }
}

/**
 * Group references by type
 */
function groupReferencesByType(references: Reference[]): Map<string, Reference[]> {
  const groups = new Map<string, Reference[]>();

  for (const ref of references) {
    const type = ref.refType || "other";
    if (!groups.has(type)) {
      groups.set(type, []);
    }
    groups.get(type)!.push(ref);
  }

  return groups;
}

export const ReferenceList: Component<ReferenceListProps> = (props) => {
  const showActions = () => props.showActions ?? true;

  // Handle opening link in new tab
  const handleOpenLink = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Render a single reference item
  const ReferenceItem: Component<{ reference: Reference }> = (itemProps) => (
    <div class="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors group">
      {/* Icon */}
      <div class="text-2xl flex-shrink-0 mt-0.5">
        {getTypeIcon(itemProps.reference.refType)}
      </div>

      {/* Content */}
      <div class="flex-1 min-w-0">
        {/* Title or URL */}
        <button
          type="button"
          onClick={() => handleOpenLink(itemProps.reference.url)}
          class="text-left w-full text-blue-600 dark:text-blue-400 hover:underline font-medium break-words"
          title="Open in new tab"
        >
          {itemProps.reference.title || itemProps.reference.url}
        </button>

        {/* Type label */}
        <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {getTypeLabel(itemProps.reference.refType)}
        </div>

        {/* Comment */}
        <Show when={itemProps.reference.comment}>
          <p class="text-sm text-gray-600 dark:text-gray-300 mt-2">
            {itemProps.reference.comment}
          </p>
        </Show>

        {/* URL (if title exists and is different) */}
        <Show when={itemProps.reference.title && itemProps.reference.title !== itemProps.reference.url}>
          <a
            href={itemProps.reference.url}
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 break-all block mt-1"
          >
            {itemProps.reference.url}
          </a>
        </Show>
      </div>

      {/* Actions */}
      <Show when={showActions()}>
        <div class="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Show when={props.onEdit}>
            <button
              type="button"
              onClick={() => props.onEdit!(itemProps.reference)}
              class="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded transition-colors"
              title="Edit reference"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <title>Edit</title>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
          </Show>

          <Show when={props.onDelete}>
            <button
              type="button"
              onClick={() => props.onDelete!(itemProps.reference.id)}
              class="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded transition-colors"
              title="Delete reference"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <title>Delete</title>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );

  return (
    <div class="space-y-3">
      {/* Empty state */}
      <Show when={props.references.length === 0}>
        <div class="text-center py-8 text-gray-500 dark:text-gray-400">
          <p class="text-sm italic">No references yet</p>
          <p class="text-xs mt-1">Add links to videos, sheet music, or articles</p>
        </div>
      </Show>

      {/* Grouped by type */}
      <Show when={props.groupByType && props.references.length > 0}>
        <For each={Array.from(groupReferencesByType(props.references).entries())}>
          {([type, refs]) => (
            <div>
              <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <span>{getTypeIcon(type)}</span>
                <span>{getTypeLabel(type)}</span>
                <span class="text-xs font-normal text-gray-500">({refs.length})</span>
              </h4>
              <div class="space-y-2">
                <For each={refs}>
                  {(ref) => <ReferenceItem reference={ref} />}
                </For>
              </div>
            </div>
          )}
        </For>
      </Show>

      {/* Flat list */}
      <Show when={!props.groupByType && props.references.length > 0}>
        <For each={props.references}>
          {(ref) => <ReferenceItem reference={ref} />}
        </For>
      </Show>
    </div>
  );
};
