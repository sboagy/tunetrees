import { type Accessor, createEffect } from "solid-js";

/** Shared presentation and pointer safety for evaluation and submitted-action menus. */
export const evaluationMenuClass =
  "z-50 w-80 max-w-[calc(100vw-2rem)] max-h-[min(var(--kb-popper-content-available-height,100dvh),calc(100dvh-2rem))] bg-popover-raised text-popover-foreground border border-border rounded-md shadow-lg overflow-y-auto overscroll-contain break-words whitespace-normal";

export const evaluationMenuItemClass =
  "w-full min-h-11 text-left px-3 py-2 text-sm hover:bg-accent data-[highlighted]:bg-accent cursor-pointer";

export function createEvaluationMenuPositioning(
  open: Accessor<boolean>,
  alignedItem: Accessor<HTMLElement | undefined>,
  ready: Accessor<boolean> = () => true
) {
  let content: HTMLElement | undefined;
  let openingOffset: number | undefined;
  let openingPointerDown = false;
  createEffect(() => {
    if (!open()) openingOffset = undefined;
  });
  return {
    setContent: (element: HTMLElement) => {
      content = element;
    },
    anchor: (anchor?: HTMLElement) => {
      if (!anchor) return undefined;
      const rect = anchor.getBoundingClientRect();
      const choice = alignedItem();
      // Measure wrapped rows once ready; disclosure keeps the opening alignment.
      // Kobalte still shifts the popup to keep it within the viewport.
      let offset = openingOffset ?? 0;
      if (openingOffset === undefined && content && choice) {
        const contentRect = content.getBoundingClientRect();
        const choiceRect = choice.getBoundingClientRect();
        if (choiceRect.height > 0) {
          offset =
            choiceRect.top -
            contentRect.top +
            (choiceRect.height - rect.height) / 2;
          if (ready()) openingOffset = offset;
        }
      }
      return { x: rect.x, y: rect.y - offset, width: rect.width, height: 0 };
    },
    onTriggerPointerDown: (event: PointerEvent) => {
      openingPointerDown = event.button === 0 && !open();
    },
    onContentPointerDown: () => {
      openingPointerDown = false;
    },
    onContentPointerUp: (event: PointerEvent) => {
      // Opening on pointerdown must not select the newly overlaid item on release.
      if (openingPointerDown) {
        openingPointerDown = false;
        event.stopPropagation();
      }
    },
  };
}
