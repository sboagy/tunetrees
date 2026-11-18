import { createResource, Show } from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import { getSchedulingOptions } from "@/lib/db/queries/user-settings";

/** Shared calendar preferences are preserved, but no calendar engine consumes them yet. */
export function PracticeCalendarSummary() {
  const { user, localDb } = useAuth();
  const [preferences] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      return db && userId ? { db, userId } : null;
    },
    ({ db, userId }) => getSchedulingOptions(db, userId)
  );
  return (
    <details
      class="rounded border border-border p-3 text-sm"
      data-testid="shared-practice-calendar"
    >
      <summary class="cursor-pointer font-medium">
        Shared practice calendar
      </summary>
      <div class="mt-3 space-y-2 text-muted-foreground">
        <p>All goals share the practice date selected on the Practice page.</p>
        <p>
          Weekly rules and date exceptions are not currently applied to queue
          selection. Previously saved preferences are retained below.
        </p>
        <Show when={preferences.error}>
          <p role="alert">Saved calendar preferences could not be loaded.</p>
        </Show>
        <Show when={!preferences.error && preferences()}>
          {(saved) => (
            <dl class="space-y-1">
              <dt>Days per week</dt>
              <dd>{saved().daysPerWeek ?? "Not set"}</dd>
              <dt>Weekly rules</dt>
              <dd class="whitespace-pre-wrap break-words">
                {saved().weeklyRules ?? "Not set"}
              </dd>
              <dt>Date exceptions</dt>
              <dd class="whitespace-pre-wrap break-words">
                {saved().exceptions ?? "Not set"}
              </dd>
            </dl>
          )}
        </Show>
      </div>
    </details>
  );
}
