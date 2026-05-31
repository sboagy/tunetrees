/**
 * Rhythm Dialog Component
 *
 * Mounts <RhythmPlayer /> inside a centered dialog with overlay backdrop.
 * Triggered by clicking a "type" badge in any tune grid or stacked list.
 *
 * On close, the dialog stops playback so audio doesn't continue in the
 * background.
 *
 * @module components/rhythm/RhythmDialog
 */

import { Dialog as DialogPrimitive } from "@kobalte/core/dialog";
import { type Component, Show } from "solid-js";
import { cn } from "@/lib/utils";
import { RhythmPlayer } from "./RhythmPlayer";

export interface RhythmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tuneTypeName: string | null;
  tuneId: string | null;
  structure?: string | null;
  genreId?: string | null;
  genreName?: string | null;
}

/**
 * Rhythm Dialog
 *
 * Wraps RhythmPlayer in a Kobalte-powered dialog with overlay and close
 * button.  Closes cleanly (stopping playback) when the user clicks the
 * close button or presses Escape.
 */
export const RhythmDialog: Component<RhythmDialogProps> = (props) => {
  let contentRef: HTMLDivElement | undefined;

  const handleOpenChange = (isOpen: boolean) => {
    props.onOpenChange(isOpen);
  };

  const title = (() => {
    const parts: string[] = [];
    if (props.tuneTypeName) parts.push(props.tuneTypeName);
    if (props.genreName) parts.push(`(${props.genreName})`);
    if (parts.length === 0) parts.push("Rhythm Player");
    return parts.join(" ");
  })();

  return (
    <DialogPrimitive open={props.open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay class="fixed inset-0 z-40 bg-black/50 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0" />
        <DialogPrimitive.Content
          ref={contentRef}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            requestAnimationFrame(() => {
              contentRef
                ?.querySelector<HTMLButtonElement>(
                  "[data-testid='rhythm-player-close-button']"
                )
                ?.focus();
            });
          }}
          class={cn(
            "fixed left-[50%] top-[50%] z-50 h-[min(98vh,1120px)] w-[min(99vw,1800px)] -translate-x-1/2 -translate-y-1/2 outline-none md:min-h-[800px] md:min-w-[820px]",
            "data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95",
            "data-[closed]:slide-out-to-left-1/2 data-[closed]:slide-out-to-top-[48%] data-[expanded]:slide-in-from-left-1/2 data-[expanded]:slide-in-from-top-[48%]",
            ""
          )}
          data-testid="rhythm-player-dialog"
        >
          <DialogPrimitive.Title class="sr-only">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description class="sr-only">
            Rhythm practice player dialog
          </DialogPrimitive.Description>

          <div class="h-full w-full">
            <Show when={props.open}>
              <RhythmPlayer
                tuneTypeName={props.tuneTypeName}
                tuneId={props.tuneId}
                structure={props.structure}
                genreId={props.genreId}
                genreName={props.genreName}
                onClose={() => handleOpenChange(false)}
                class="h-full w-full shadow-xl"
              />
            </Show>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive>
  );
};
