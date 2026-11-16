import type { BrowserSqliteMigrationBlockReason } from "oosync/runtime/browser-sqlite";
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
}) {
  return (
    <main
      class="mx-auto max-w-2xl space-y-4 p-6"
      data-testid="database-upgrade-blocked"
    >
      <div role="alert" class="space-y-4">
        <h1 class="text-xl font-semibold">
          Your local data needs attention before upgrading
        </h1>
        <p>{explanations[props.reason]}</p>
      </div>
      <p>
        Your stored database has been kept. Do not clear site data, reset the
        database, or sign out to bypass this message.
      </p>
      <p>
        Use the previous compatible TuneTrees version on this device to finish
        syncing and pending uploads, or arrange a verified export and recovery
        of local-only work. Close other TuneTrees tabs before retrying. Syncing
        another device does not preserve this device’s changes.
      </p>
      <p>
        If the previous version is unavailable, keep this browser’s data and
        contact the developer for recovery help.
      </p>
      <Button
        variant="outline"
        class="min-h-11"
        data-testid="retry-database-upgrade"
        onClick={() => globalThis.location.reload()}
      >
        Retry after preserving local work
      </Button>
    </main>
  );
}
