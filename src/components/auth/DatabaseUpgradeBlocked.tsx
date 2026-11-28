import type { BrowserSqliteMigrationBlockReason } from "oosync/runtime/browser-sqlite";
import { createEffect, createSignal, on, onCleanup, Show } from "solid-js";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

const explanations: Record<BrowserSqliteMigrationBlockReason, string> = {
  outbox: "This device has changes that have not finished syncing.",
  backup:
    "This device has a saved recovery backup that still needs to be restored.",
  local_data:
    "This device has local data that has not been confirmed safe to download again, such as anonymous practice or pending media uploads.",
  inspection_failed:
    "TuneTrees could not verify that this device’s local data is safe to upgrade.",
};

export function DatabaseUpgradeBlocked(props: {
  reason: BrowserSqliteMigrationBlockReason;
  account?: string;
  userId?: string;
  onDiscard?: () => Promise<void>;
}) {
  const [confirming, setConfirming] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [online, setOnline] = createSignal(navigator.onLine);
  const updateOnline = () => setOnline(navigator.onLine);
  globalThis.addEventListener("online", updateOnline);
  globalThis.addEventListener("offline", updateOnline);
  onCleanup(() => {
    globalThis.removeEventListener("online", updateOnline);
    globalThis.removeEventListener("offline", updateOnline);
  });
  // Confirmation never carries over to a replacement account.
  createEffect(
    on(
      () => props.userId,
      () => setConfirming(false)
    )
  );
  let cancelButton: HTMLButtonElement | undefined;
  const discard = async () => {
    if (busy() || !navigator.onLine || !props.onDiscard) return;
    setBusy(true);
    setError("");
    try {
      await props.onDiscard();
      // Successful blocked-startup recovery reloads into a full download.
    } catch {
      setBusy(false);
      setError(
        "Local reset could not finish. Close other TuneTrees tabs and try again. If the problem continues, keep this browser’s data and contact the developer."
      );
    }
  };
  return (
    <main
      class="mx-auto max-w-2xl space-y-4 p-6 text-foreground"
      data-testid="database-upgrade-blocked"
    >
      <div role="alert" class="space-y-4">
        <h1 class="text-xl font-semibold">
          Your local data needs attention before upgrading
        </h1>
        <p>{explanations[props.reason]}</p>
      </div>
      <p>
        Your stored database has been kept. Preserve any work you want to keep
        before discarding local data. Do not clear site data or sign out to
        bypass this message.
      </p>
      <p>
        Use the previous compatible TuneTrees version on this device to finish
        syncing and pending uploads, or arrange a verified export and recovery
        of local-only work. Close other TuneTrees tabs before retrying. Syncing
        another device does not preserve this device’s changes.
      </p>
      <p>
        If the previous version is unavailable, keep this browser’s data and
        contact the developer for recovery help. If you do not need the local
        work, you can explicitly discard it below.
      </p>
      <Button
        variant="outline"
        class="min-h-11 h-auto whitespace-normal"
        disabled={busy()}
        data-testid="retry-database-upgrade"
        onClick={() => globalThis.location.reload()}
      >
        Retry After Preserving Local Work
      </Button>
      <Show when={props.onDiscard}>
        <AlertDialog
          open={confirming()}
          onOpenChange={(open) => {
            if (!busy()) setConfirming(open);
          }}
        >
          <AlertDialogTrigger
            as={Button}
            variant="destructive-ghost"
            class="min-h-11 h-auto whitespace-normal"
            disabled={!online() || busy()}
            data-testid="discard-blocked-database"
          >
            Discard Local Data and Download Again…
          </AlertDialogTrigger>
          <AlertDialogContent
            class="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              cancelButton?.focus();
            }}
            onPointerDownOutside={(event) => event.preventDefault()}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>
                Discard This Account’s Local Data?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes the saved TuneTrees database and
                recovery backup for {props.account ?? "this account"} on{" "}
                {globalThis.location.host} in this browser, including unsynced
                practice, edits, and upload drafts stored in that database. This
                cannot be undone. Server data remains intact and will be
                downloaded again. Other accounts, sign-in, and separate media
                storage are not cleared. Close other TuneTrees tabs first.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Show when={error()}>
              <p role="alert" class="text-destructive">
                {error()}
              </p>
            </Show>
            <Show when={busy()}>
              <output aria-live="polite">
                Discarding local data. The app will reload to download server
                data.
              </output>
            </Show>
            <AlertDialogFooter class="flex-col gap-2">
              <Button
                ref={cancelButton}
                variant="outline"
                class="min-h-11"
                disabled={busy()}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                class="min-h-11 h-auto whitespace-normal"
                disabled={busy() || !online()}
                onClick={discard}
                data-testid="confirm-discard-blocked-database"
              >
                Discard Local Data
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Show when={!online()}>
          <output class="block" aria-live="polite">
            Connect to the internet before discarding local data and downloading
            again.
          </output>
        </Show>
      </Show>
    </main>
  );
}
