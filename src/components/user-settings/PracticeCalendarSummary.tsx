import { CalendarDays, Save } from "lucide-solid";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import {
  AlertDialog,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { createDraftExitGuard } from "@/components/ui/createDraftExitGuard";
import { useAuth } from "@/lib/auth/AuthContext";
import { persistDb } from "@/lib/db/client-sqlite";
import {
  getSchedulingOptions,
  type SchedulingOptions,
  updateSchedulingOptions,
} from "@/lib/db/queries/user-settings";

export interface CalendarEditorGuard {
  open: () => boolean;
  pending: () => boolean;
  requestExit: (action: () => void) => void;
}
const fields = (saved: SchedulingOptions | null) => ({
  days: saved?.daysPerWeek?.toString() ?? "",
  weekly: saved?.weeklyRules ?? "",
  exceptions: saved?.exceptions ?? "",
});
function calendarJson(
  text: string,
  array: boolean,
  label: string
): string | null {
  if (!text.trim()) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`${label} must contain valid JSON.`);
  }
  if (
    array
      ? !Array.isArray(value)
      : value === null || typeof value !== "object" || Array.isArray(value)
  )
    throw new Error(`${label} must be a JSON ${array ? "array" : "object"}.`);
  return JSON.stringify(value);
}
const inputClass =
  "min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-foreground";

/** Calendar editing preserves the existing fields; scheduler integration is #959. */
export function PracticeCalendarSummary(props: {
  onRegister?: (guard: CalendarEditorGuard) => void;
}) {
  const { user, localDb } = useAuth();
  const [open, setOpen] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [retryPersistence, setRetryPersistence] = createSignal(false);
  const [error, setError] = createSignal("");
  const [ready, setReady] = createSignal(false);
  const [baseline, setBaseline] = createSignal(fields(null));
  const [draft, setDraft] = createSignal(fields(null));
  let session:
    | { db: NonNullable<ReturnType<typeof localDb>>; userId: string }
    | undefined;
  let form: HTMLFormElement | undefined;
  let weeklyInput: HTMLTextAreaElement | undefined;
  let exceptionsInput: HTMLTextAreaElement | undefined;
  const [invalidField, setInvalidField] = createSignal<
    "weekly" | "exceptions"
  >();
  createEffect(() => {
    const db = localDb();
    const userId = user()?.id;
    if (session && (session.db !== db || session.userId !== userId)) {
      session = undefined;
      setRetryPersistence(false);
      setBusy(false);
      setLoading(false);
      setReady(false);
      setDraft(fields(null));
      setBaseline(fields(null));
      setError("");
      setOpen(false);
    }
  });
  onCleanup(() => {
    session = undefined;
  });
  const isCurrent = () =>
    session?.db && localDb() === session.db && user()?.id === session.userId;
  const dirty = () =>
    open() && JSON.stringify(draft()) !== JSON.stringify(baseline());
  const pending = () => busy() || retryPersistence();
  const close = () => {
    setOpen(false);
    setError("");
  };
  const { requestExit, Confirmation } = createDraftExitGuard({
    dirty,
    pending,
    discard: close,
    description: "Unsaved calendar changes will be lost.",
  });
  props.onRegister?.({ open, pending, requestExit });
  const load = async () => {
    const db = localDb();
    const userId = user()?.id;
    if (!db || !userId) return;
    const current = { db, userId };
    session = current;
    setLoading(true);
    setReady(false);
    setError("");
    try {
      const saved = await getSchedulingOptions(db, userId);
      if (session !== current || !isCurrent() || !open()) return;
      setBaseline(fields(saved));
      setDraft(fields(saved));
      setReady(true);
    } catch {
      if (session === current)
        setError("Calendar preferences could not be loaded. Try again.");
    } finally {
      if (session === current) setLoading(false);
    }
  };
  const save = async () => {
    if (busy() || !ready() || !session || !isCurrent()) return;
    const savingSession = session;
    setError("");
    setInvalidField(undefined);
    if (!form?.reportValidity()) return;
    setBusy(true);
    try {
      if (!retryPersistence()) {
        const value = draft();
        const daysPerWeek = value.days === "" ? null : Number(value.days);
        const validateJson = (
          field: "weekly" | "exceptions",
          label: string
        ) => {
          try {
            return calendarJson(value[field], field === "exceptions", label);
          } catch (cause) {
            setInvalidField(field);
            throw cause;
          }
        };
        const weeklyRules = validateJson("weekly", "Weekly Rules");
        const exceptions = validateJson("exceptions", "Date Exceptions");
        const current = await getSchedulingOptions(session.db, session.userId);
        if (session !== savingSession || !isCurrent())
          throw new Error("The settings session changed. Reopen the calendar.");
        if (JSON.stringify(fields(current)) !== JSON.stringify(baseline()))
          throw new Error(
            "Calendar settings changed elsewhere. Cancel and reopen to load them."
          );
        await updateSchedulingOptions(session.db, {
          userId: session.userId,
          daysPerWeek,
          weeklyRules,
          exceptions,
        });
        if (session !== savingSession || !isCurrent()) return;
        // The local mutation is complete. A disk retry must not repeat it.
        setRetryPersistence(true);
      }
      if (!isCurrent())
        throw new Error("The settings session changed. Reopen the calendar.");
      await persistDb();
      if (session !== savingSession || !isCurrent()) return;
      setRetryPersistence(false);
      setBaseline(draft());
      close();
    } catch (cause) {
      if (session !== savingSession || !isCurrent()) return;
      if (retryPersistence())
        setError(
          "Calendar changes are in memory but could not be saved to this device. Retry saving."
        );
      else
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not save the calendar. Try again."
        );
    } finally {
      if (session === savingSession) {
        setBusy(false);
        if (invalidField() === "weekly") weeklyInput?.focus();
        if (invalidField() === "exceptions") exceptionsInput?.focus();
      }
    }
  };
  return (
    <AlertDialog
      open={open()}
      onOpenChange={(next) => {
        if (next) {
          setOpen(true);
          load();
        } else requestExit(close);
      }}
    >
      <AlertDialogTrigger
        as={Button}
        variant="outline"
        class="min-h-11 gap-1"
        data-testid="shared-practice-calendar"
      >
        <CalendarDays class="size-4" aria-hidden="true" /> Shared Practice
        Calendar
      </AlertDialogTrigger>
      <AlertDialogContent
        class="settings-task-dialog w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto text-foreground"
        onInteractOutside={(event) => event.preventDefault()}
        data-testid="practice-calendar-dialog"
      >
        <AlertDialogTitle class="pr-12">
          Shared Practice Calendar
        </AlertDialogTitle>
        <AlertDialogCloseButton disabled={pending()} />
        <AlertDialogDescription>
          Calendar preferences are shared by all goals and repertoires.
        </AlertDialogDescription>
        <p class="text-sm text-muted-foreground">
          These values are saved, but are not yet applied to practice
          scheduling. All goals currently use the practice date selected on the
          Practice page.
        </p>
        <Show when={loading()}>
          <output>Loading calendar…</output>
        </Show>
        <Show when={ready()}>
          <form
            ref={form}
            class="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <fieldset disabled={pending()} class="space-y-4">
              <label class="block space-y-1 text-sm">
                <span>Days per Week (Optional)</span>
                <input
                  type="number"
                  min="1"
                  max="7"
                  step="1"
                  class={inputClass}
                  data-testid="calendar-days"
                  value={draft().days}
                  onInput={(event) =>
                    setDraft({ ...draft(), days: event.currentTarget.value })
                  }
                />
              </label>
              <label class="block space-y-1 text-sm">
                <span>Weekly Rules (Optional JSON Object)</span>
                <textarea
                  rows={4}
                  class={inputClass}
                  data-testid="calendar-weekly"
                  ref={weeklyInput}
                  aria-invalid={invalidField() === "weekly"}
                  aria-describedby={
                    invalidField() === "weekly" ? "calendar-error" : undefined
                  }
                  value={draft().weekly}
                  onInput={(event) =>
                    setDraft({ ...draft(), weekly: event.currentTarget.value })
                  }
                />
              </label>
              <label class="block space-y-1 text-sm">
                <span>Date Exceptions (Optional JSON Array)</span>
                <textarea
                  rows={4}
                  class={inputClass}
                  data-testid="calendar-exceptions"
                  ref={exceptionsInput}
                  aria-invalid={invalidField() === "exceptions"}
                  aria-describedby={
                    invalidField() === "exceptions"
                      ? "calendar-error"
                      : undefined
                  }
                  value={draft().exceptions}
                  onInput={(event) =>
                    setDraft({
                      ...draft(),
                      exceptions: event.currentTarget.value,
                    })
                  }
                />
              </label>
            </fieldset>
            <div class="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending()}
                onClick={() => requestExit(close)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={busy() || (!dirty() && !retryPersistence())}
                data-testid="calendar-save"
              >
                <Save class="size-4" aria-hidden="true" />
                {busy() ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </Show>
        <Show when={error()}>
          <p id="calendar-error" role="alert" class="text-sm text-destructive">
            {error()}
          </p>
          <Show when={!ready()}>
            <Button variant="outline" disabled={loading()} onClick={load}>
              Retry
            </Button>
          </Show>
        </Show>
        <Confirmation />
      </AlertDialogContent>
    </AlertDialog>
  );
}
