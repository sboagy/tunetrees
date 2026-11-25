import { createSignal, onCleanup } from "solid-js";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/** Shared E2 exit guard. Call within a Solid owner; route integration stays with the caller. */
export function createDraftExitGuard(options: {
  dirty: () => boolean;
  pending: () => boolean;
  discard: () => void;
  description: string;
}) {
  const [exitAction, setExitAction] = createSignal<() => void>();
  const requestExit = (action: () => void) => {
    if (options.pending()) return;
    if (options.dirty()) setExitAction(() => action);
    else action();
  };
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (options.dirty() || options.pending()) event.preventDefault();
  };
  globalThis.addEventListener("beforeunload", beforeUnload);
  onCleanup(() => globalThis.removeEventListener("beforeunload", beforeUnload));

  // Keep Editing is first so the primitive focuses it after nested focus scopes settle.
  const Confirmation = () => {
    return (
      <AlertDialog
        open={Boolean(exitAction())}
        onOpenChange={(open) => {
          if (!open) setExitAction(undefined);
        }}
      >
        <AlertDialogContent
          class="max-w-md w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
          <AlertDialogDescription>{options.description}</AlertDialogDescription>
          <div class="flex flex-wrap justify-end gap-2">
            <Button
              class="min-h-11"
              variant="outline"
              onClick={() => setExitAction(undefined)}
            >
              Keep Editing
            </Button>
            <Button
              class="min-h-11"
              variant="outline"
              disabled={options.pending()}
              onClick={() => {
                if (options.pending()) return;
                const action = exitAction();
                setExitAction(undefined);
                options.discard();
                action?.();
              }}
            >
              Discard Changes
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    );
  };
  return { requestExit, Confirmation };
}
