import abcjs from "abcjs";
import type { Component } from "solid-js";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";

interface AbcNotationProps {
  /** ABC notation string to render */
  notation: string;
  /** Whether to resize responsively */
  responsive?: boolean;
  /** abcjs render scale */
  scale?: number;
  /** Custom class name for container */
  class?: string;
  /** Show error messages */
  showErrors?: boolean;
  /** abcjs top padding */
  paddingTop?: number;
  /** abcjs bottom padding */
  paddingBottom?: number;
  /** abcjs left padding */
  paddingLeft?: number;
  /** abcjs right padding */
  paddingRight?: number;
  /** Scale rendered notation to stay visible within the nearest notation viewport */
  fitToContainer?: boolean;
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

  const clearFittedLayout = () => {
    if (!containerRef) {
      return;
    }

    const svg = containerRef.querySelector<SVGSVGElement>("svg");
    if (svg) {
      svg.style.transform = "";
      svg.style.transformOrigin = "";
    }
  };

  const fitRenderedNotation = () => {
    if (!containerRef || !props.fitToContainer) {
      clearFittedLayout();
      return;
    }

    const viewport = containerRef.closest(".rhythm-player-notation");
    const svg = containerRef.querySelector<SVGSVGElement>("svg");

    if (!(viewport instanceof HTMLDivElement) || !svg) {
      clearFittedLayout();
      return;
    }

    clearFittedLayout();

    const viewportRect = viewport.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    const contentWidth = Math.max(containerRef.scrollWidth, svgRect.width);
    const contentHeight = Math.max(containerRef.scrollHeight, svgRect.height);

    if (
      viewportRect.width <= 0 ||
      viewportRect.height <= 0 ||
      contentWidth <= 0 ||
      contentHeight <= 0
    ) {
      return;
    }

    const nextScale = Math.min(
      viewportRect.width / contentWidth,
      viewportRect.height / contentHeight,
      1
    );

    svg.style.transformOrigin = "top left";
    svg.style.transform = `scale(${nextScale})`;
  };

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
          scale: props.scale,

          // Adds helpful CSS classes to the SVG elements (staff, notes, etc.)
          // in case you want to style them with Tailwind later.
          add_classes: true,

          // Tightens up the blank space around the sheet music
          paddingtop: props.paddingTop ?? 15,
          paddingbottom: props.paddingBottom ?? 15,
          paddingleft: props.paddingLeft ?? 0,
          paddingright: props.paddingRight ?? 0,
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to render ABC notation";
        setError(errorMessage);
        console.error("ABC rendering error:", err);
      }
    }
  });

  createEffect(() => {
    const notation = props.notation;
    const fitToContainer = props.fitToContainer ?? false;

    if (!containerRef || !notation) {
      clearFittedLayout();
      return;
    }

    if (!fitToContainer) {
      clearFittedLayout();
      return;
    }

    let frameId: number | null = null;
    const scheduleFit = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(() => {
        fitRenderedNotation();
        frameId = null;
      });
    };

    scheduleFit();

    const viewport = containerRef.closest(".rhythm-player-notation");
    const resizeObserver =
      typeof ResizeObserver !== "undefined" &&
      viewport instanceof HTMLDivElement
        ? new ResizeObserver(() => {
            scheduleFit();
          })
        : null;

    if (resizeObserver && viewport instanceof HTMLDivElement) {
      resizeObserver.observe(viewport);
    }

    onCleanup(() => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      resizeObserver?.disconnect();
      clearFittedLayout();
    });
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
