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

        // Render ABC notation
        abcjs.renderAbc(containerRef, props.notation, {
          responsive: props.responsive ? "resize" : undefined,
          add_classes: true,
          staffwidth: props.responsive ? undefined : 740,
          scale: 1.0,
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
