import { CalendarDays } from "lucide-solid";
import { createResource, Show } from "solid-js";
import {
  AlertDialog,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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
    <AlertDialog>
      <AlertDialogTrigger
        as={Button}
        variant="outline"
        class="min-h-11 gap-1"
        data-testid="shared-practice-calendar"
      >
        <CalendarDays class="size-4" aria-hidden="true" /> Shared practice
        calendar
      </AlertDialogTrigger>
      <AlertDialogContent class="w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto text-foreground">
        <AlertDialogTitle class="pr-12">
          Shared practice calendar
        </AlertDialogTitle>
        <AlertDialogCloseButton class="min-h-11 min-w-11" title="Close" />
        <AlertDialogDescription>
          Saved calendar information shared by all goals.
        </AlertDialogDescription>
        <div class="space-y-2 text-sm text-muted-foreground">
          <p>
            All goals share the practice date selected on the Practice page.
          </p>
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
      </AlertDialogContent>
    </AlertDialog>
  );
}
