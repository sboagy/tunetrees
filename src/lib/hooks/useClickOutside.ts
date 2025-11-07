/**
 * useClickOutside Hook
 *
 * Detects clicks outside a referenced element and calls a handler function.
 * Useful for closing dropdowns, modals, and popovers when clicking outside.
 *
 * @module lib/hooks/useClickOutside
 */

import { type Accessor, onCleanup, onMount } from "solid-js";

/**
 * Hook to detect clicks outside an element
 *
 * @param ref - Accessor for the element ref to watch
 * @param handler - Callback function to execute when clicking outside
 *
 * @example
 * ```tsx
 * const MyDropdown: Component = () => {
 *   let dropdownRef: HTMLDivElement | undefined;
 *   const [isOpen, setIsOpen] = createSignal(false);
 *
 *   useClickOutside(() => dropdownRef, () => setIsOpen(false));
 *
 *   return (
 *     <div ref={dropdownRef}>
 *       <Show when={isOpen()}>
 *         <div>Dropdown content</div>
 *       </Show>
 *     </div>
 *   );
 * };
 * ```
 */
export function useClickOutside(
  ref: Accessor<HTMLElement | undefined>,
  handler: (event: MouseEvent | TouchEvent) => void
): void {
  const handleClickOutside = (event: MouseEvent | TouchEvent) => {
    const element = ref();
    const target = event.target as Node;

    // If element exists and the click was outside of it, call handler
    if (element && !element.contains(target)) {
      handler(event);
    }
  };

  onMount(() => {
    // Add event listeners after a short delay to prevent immediate trigger
    setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }, 0);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
    document.removeEventListener("touchstart", handleClickOutside);
  });
}
