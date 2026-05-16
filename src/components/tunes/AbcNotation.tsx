import abcjs from "abcjs";
import type { Component } from "solid-js";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";

interface AbcNotationProps {
  /** ABC notation string to render */
  notation: string;
  /** Whether to resize responsively */
  responsive?: boolean;
  /** Custom class name for container */
  class?: string;
  /** Show error messages */
  showErrors?: boolean;
}

/**
 * AbcNotation Component
 *
 * Renders ABC notation as music notation using abcjs library.
 * Automatically updates when notation changes.
 *
 * @example
 * ```tsx
 * <AbcNotation
 *   notation="X:1\nT:Example\nM:4/4\nL:1/8\nK:C\nCDEF GABc|"
 *   responsive={true}
 * />
 * ```
 */
export const AbcNotation: Component<AbcNotationProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    if (containerRef && props.notation) {
      try {
        setError(null);

        // Clear previous rendering
        containerRef.innerHTML = "";

        // Keep the call close to abcjs defaults so the layout matches
        // external ABC tools instead of being stretched by app-specific options.
        abcjs.renderAbc(containerRef, props.notation, {
          // This is the magic bullet for modals. It tells the SVG to fluidly
          // stretch/shrink to fill the container instead of locking to a hardcoded width.
          responsive: "resize",

          // Adds helpful CSS classes to the SVG elements (staff, notes, etc.)
          // in case you want to style them with Tailwind later.
          add_classes: true,

          // Tightens up the blank space around the sheet music
          paddingtop: 15,
          paddingbottom: 15,
          paddingleft: 0,
          paddingright: 0,
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to render ABC notation";
        setError(errorMessage);
        console.error("ABC rendering error:", err);
      }
    }
  });

  onCleanup(() => {
    // Clean up abcjs instance
    if (containerRef) {
      containerRef.innerHTML = "";
    }
  });

  return (
    <div class={props.class}>
      <Show when={error() && props.showErrors}>
        <div class="rounded-md bg-red-50 p-3 mb-2 border border-red-200">
          <p class="text-sm text-red-800">
            <strong>Error rendering notation:</strong> {error()}
          </p>
        </div>
      </Show>
      <Show when={!props.notation}>
        <div class="rounded-md bg-gray-50 p-4 text-center text-gray-500">
          No notation available
        </div>
      </Show>
      <div
        ref={containerRef}
        class="abc-notation overflow-x-auto"
        data-testid="abc-notation-container"
      />
    </div>
  );
};
