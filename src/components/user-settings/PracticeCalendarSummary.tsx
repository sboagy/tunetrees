import { CalendarDays, LoaderCircle, Save } from "lucide-solid";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
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

import {
  readDates,
  readWeekdays,
  SkippedDatesPicker,
  weekdays,
} from "./PracticeCalendarPicker";

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

function weeklyPracticeSummary(selectedCount: number, savedDays: string) {
  if (selectedCount === 1) return "1 day per week";
  if (selectedCount > 1) return `${selectedCount} days per week`;
  if (savedDays)
    return `Previously saved: ${savedDays} days per week. Select weekdays to replace this target.`;
  return "No weekly practice days selected.";
}

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
  const selectedDays = createMemo(() =>
    readWeekdays(draft().weekly, draft().days)
  );
  const selectedDates = createMemo(() => readDates(draft().exceptions));
  const toggleDay = (day: string) => {
    const selected = selectedDays();
    if (!selected) return;
    const next = weekdays.filter((value) =>
      value === day ? !selected.includes(day) : selected.includes(value)
    );
    const original = baseline();
    const reverted =
      JSON.stringify(next) ===
      JSON.stringify(readWeekdays(original.weekly, original.days));
    const selectedCount = next.length ? String(next.length) : "";
    setDraft({
      ...draft(),
      days: reverted ? original.days : selectedCount,
      weekly: reverted
        ? original.weekly
        : JSON.stringify(
            Object.fromEntries(next.map((value) => [value.toLowerCase(), true]))
          ),
    });
  };
  const changeDates = (next: string[]) =>
    setDraft({
      ...draft(),
      exceptions:
        JSON.stringify(next) ===
        JSON.stringify(readDates(baseline().exceptions))
          ? baseline().exceptions
          : JSON.stringify(next),
    });
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
    setBusy(true);
    try {
      if (!retryPersistence()) {
        const value = draft();
        const daysPerWeek = value.days === "" ? null : Number(value.days);
        const weeklyRules = value.weekly || null;
        const exceptions = value.exceptions || null;
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
      if (session === savingSession) setBusy(false);
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
        disabled={!user()?.id || !localDb()}
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
            class="min-w-0 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <fieldset disabled={pending()} class="min-w-0 space-y-4">
              <fieldset class="space-y-2" data-testid="calendar-weekly">
                <legend class="text-sm font-medium">
                  Weekly Practice Days
                </legend>
                <Show
                  when={selectedDays()}
                  fallback={
                    <p class="text-sm text-muted-foreground">
                      Your existing weekly rule is preserved but cannot be
                      edited with this picker.
                    </p>
                  }
                >
                  {(days) => (
                    <>
                      <div class="flex flex-wrap gap-1">
                        <For each={weekdays}>
                          {(day) => (
                            <Button
                              type="button"
                              class="h-11 min-w-11 px-2"
                              variant={
                                days().includes(day) ? "default" : "outline"
                              }
                              aria-label={day}
                              aria-pressed={days().includes(day)}
                              onClick={() => toggleDay(day)}
                            >
                              {day.slice(0, 3)}
                            </Button>
                          )}
                        </For>
                      </div>
                      <p
                        class="text-sm text-muted-foreground"
                        data-testid="calendar-days"
                      >
                        {weeklyPracticeSummary(days().length, draft().days)}
                      </p>
                    </>
                  )}
                </Show>
              </fieldset>
              <Show
                when={selectedDates()}
                fallback={
                  <p class="text-sm text-muted-foreground">
                    Your existing date exceptions are preserved but cannot be
                    edited with this picker.
                  </p>
                }
              >
                {(dates) => (
                  <SkippedDatesPicker dates={dates()} onChange={changeDates} />
                )}
              </Show>
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
                class="min-w-36"
                aria-busy={busy()}
              >
                <Show
                  when={busy()}
                  fallback={<Save class="size-4" aria-hidden="true" />}
                >
                  <LoaderCircle
                    class="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                </Show>
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
