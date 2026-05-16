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
import { X } from "lucide-solid";
import { type Component, Show } from "solid-js";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { RhythmPlayer } from "./RhythmPlayer";

export interface RhythmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tuneTypeName: string | null;
  tuneId: string | null;
  structure?: string | null;
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
          class={cn(
            "fixed left-[50%] top-[50%] z-50 flex h-[min(88vh,960px)] w-[min(94vw,1400px)] md:min-w-[820px] md:min-h-[680px] translate-x-[-50%] translate-y-[-50%] flex-col gap-4 overflow-auto resize border bg-[hsl(var(--background))] p-6 shadow-lg duration-200",
            "data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95",
            "data-[closed]:slide-out-to-left-1/2 data-[closed]:slide-out-to-top-[48%] data-[expanded]:slide-in-from-left-1/2 data-[expanded]:slide-in-from-top-[48%]",
            "rounded-lg"
          )}
        >
          {/* Header */}
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold leading-none tracking-tight">
              {title}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8 rounded-md"
              aria-label="Close rhythm player"
              onClick={() => handleOpenChange(false)}
            >
              <X class="h-4 w-4" />
            </Button>
          </div>

          {/* Player */}
          <div class="min-h-0 flex-1">
            <Show when={props.open}>
              <RhythmPlayer
                tuneTypeName={props.tuneTypeName}
                tuneId={props.tuneId}
                structure={props.structure}
                genreName={props.genreName}
              />
            </Show>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive>
  );
};
