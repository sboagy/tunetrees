/**
 * Flashcard Field Visibility Menu Component
 *
 * Dropdown menu for showing/hiding flashcard fields.
 * Shows separate columns for Front and Back face visibility.
 *
 * @module components/practice/FlashcardFieldVisibilityMenu
 */

import {
  type Component,
  createSignal,
  For,
  onCleanup,
  onMount,
} from "solid-js";
import { Portal } from "solid-js/web";
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
  /**
   * Optional element to exclude from the outside-click close guard.
   * When not provided, defaults to `triggerRef`.
   * Pass `null` to disable the guard entirely so that any click outside the
   * menu — including on the overflow trigger — closes the menu.
   */
  closeGuardRef?: HTMLElement | null;
}

export const FlashcardFieldVisibilityMenu: Component<
  FlashcardFieldVisibilityMenuProps
> = (props) => {
  let menuRef: HTMLDivElement | undefined;
  const [menuStyle, setMenuStyle] = createSignal({
    top: "0px",
    left: "0px",
    width: "320px",
    maxHeight: "384px",
  });

  const updatePosition = () => {
    if (!props.triggerRef) return;

    const rect = props.triggerRef.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const gap = 8;
    const viewportPadding = 8;
    const width = Math.min(320, viewportWidth - viewportPadding * 2);
    const left = Math.min(
      Math.max(viewportPadding, rect.right - width),
      viewportWidth - width - viewportPadding
    );
    const top = Math.min(
      rect.bottom + gap,
      Math.max(viewportPadding, viewportHeight - gap - 192)
    );
    const maxHeight = Math.max(192, viewportHeight - top - viewportPadding);

    setMenuStyle({
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
      maxHeight: `${maxHeight}px`,
    });
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (!menuRef) return; // menu element not yet mounted
    if (!menuRef.contains(e.target as Node)) {
      // Determine which element guards against outside-click dismissal.
      // Three-state logic for closeGuardRef:
      //   undefined  → not provided; fall back to triggerRef (backward-compatible default)
      //   null       → explicitly disabled; any click outside the menu closes it
      //   HTMLElement → use that element as the guard
      const guardRef =
        props.closeGuardRef !== undefined
          ? props.closeGuardRef
          : props.triggerRef;
      if (!guardRef?.contains(e.target as Node)) {
        e.stopPropagation(); // Prevent click from propagating to lower elements
        props.onClose();
      }
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
    updatePosition();
    requestAnimationFrame(updatePosition);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscapeKey);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
    document.removeEventListener("keydown", handleEscapeKey);
    window.removeEventListener("resize", updatePosition);
    window.removeEventListener("scroll", updatePosition, true);
  });

  return (
    <Portal>
      <div
        ref={menuRef}
        class="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-[9999] overflow-y-auto"
        style={{
          top: menuStyle().top,
          left: menuStyle().left,
          width: menuStyle().width,
          "max-height": menuStyle().maxHeight,
        }}
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
    </Portal>
  );
};
