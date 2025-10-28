/**
 * Flashcard Field Visibility Menu Component
 *
 * Dropdown menu for showing/hiding flashcard fields.
 * Shows separate columns for Front and Back face visibility.
 *
 * @module components/practice/FlashcardFieldVisibilityMenu
 */

import { type Component, For, onCleanup, onMount } from "solid-js";
import {
  FLASHCARD_FIELDS,
  type FlashcardFieldVisibilityByFace,
} from "./flashcard-fields";

export interface FlashcardFieldVisibilityMenuProps {
  isOpen: boolean;
  fieldVisibility: FlashcardFieldVisibilityByFace;
  onFieldVisibilityChange: (visibility: FlashcardFieldVisibilityByFace) => void;
  onClose: () => void;
  triggerRef?: HTMLButtonElement;
}

export const FlashcardFieldVisibilityMenu: Component<
  FlashcardFieldVisibilityMenuProps
> = (props) => {
  let menuRef: HTMLDivElement | undefined;

  const handleClickOutside = (e: MouseEvent) => {
    if (
      menuRef &&
      props.triggerRef &&
      !menuRef.contains(e.target as Node) &&
      !props.triggerRef.contains(e.target as Node)
    ) {
      e.stopPropagation(); // Prevent click from propagating to lower elements
      props.onClose();
    }
  };

  const handleEscapeKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      props.onClose();
    }
  };

  const handleToggleFront = (fieldId: string) => {
    const newVisibility: FlashcardFieldVisibilityByFace = {
      ...props.fieldVisibility,
      front: {
        ...props.fieldVisibility.front,
        [fieldId]:
          !props.fieldVisibility.front[
            fieldId as keyof typeof props.fieldVisibility.front
          ],
      },
    };
    props.onFieldVisibilityChange(newVisibility);
  };

  const handleToggleBack = (fieldId: string) => {
    const newVisibility: FlashcardFieldVisibilityByFace = {
      ...props.fieldVisibility,
      back: {
        ...props.fieldVisibility.back,
        [fieldId]:
          !props.fieldVisibility.back[
            fieldId as keyof typeof props.fieldVisibility.back
          ],
      },
    };
    props.onFieldVisibilityChange(newVisibility);
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscapeKey);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
    document.removeEventListener("keydown", handleEscapeKey);
  });

  return (
    <div
      ref={menuRef}
      class="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
      data-testid="flashcard-fields-menu"
    >
      <div class="p-2">
        <div class="px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700">
          Field Visibility
        </div>
        <div class="mt-2">
          {/* Header row */}
          <div class="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-1 text-xs font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            <div>Field</div>
            <div class="w-16 text-center">Front</div>
            <div class="w-16 text-center">Back</div>
          </div>
          {/* Field rows */}
          <For each={FLASHCARD_FIELDS}>
            {(field) => (
              <div
                class="grid grid-cols-[1fr_auto_auto] gap-2 items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                data-testid={`ffv-row-${field.id}`}
              >
                <span class="text-sm text-gray-700 dark:text-gray-300">
                  {field.label}
                </span>
                <div class="w-16 flex justify-center">
                  <input
                    type="checkbox"
                    checked={props.fieldVisibility.front[field.id]}
                    onChange={() => handleToggleFront(field.id)}
                    class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                    title={`Show ${field.label} on front`}
                    aria-label={`Show ${field.label} on front`}
                    data-testid={`ffv-front-${field.id}`}
                  />
                </div>
                <div class="w-16 flex justify-center">
                  <input
                    type="checkbox"
                    checked={props.fieldVisibility.back[field.id]}
                    onChange={() => handleToggleBack(field.id)}
                    class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                    title={`Show ${field.label} on back`}
                    aria-label={`Show ${field.label} on back`}
                    data-testid={`ffv-back-${field.id}`}
                  />
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
};
