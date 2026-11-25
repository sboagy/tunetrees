import { ChevronLeft, ChevronRight } from "lucide-solid";
import { createMemo, createSignal, For } from "solid-js";
import { Button } from "@/components/ui/button";

export const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function readWeekdays(raw: string, days: string): string[] | undefined {
  try {
    const rules: unknown = JSON.parse(raw || "{}");
    if (!rules || typeof rules !== "object" || Array.isArray(rules))
      return undefined;
    const entries = Object.entries(rules);
    if (
      !entries.every(
        ([key, active]) =>
          weekdays.some((day) => day.toLowerCase() === key) &&
          typeof active === "boolean"
      )
    )
      return undefined;
    if (!entries.length && days === "7") return [...weekdays];
    return weekdays.filter((day) =>
      entries.some(([key, active]) => active && key === day.toLowerCase())
    );
  } catch {
    return undefined;
  }
}

function dateKey(date: Date) {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function compareDateKeys(left: string, right: string) {
  return left.localeCompare(right);
}

export function readDates(raw: string): string[] | undefined {
  try {
    const dates: unknown = JSON.parse(raw || "[]");
    if (
      !Array.isArray(dates) ||
      !dates.every(
        (key: unknown): key is string =>
          typeof key === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(key) &&
          dateKey(new Date(`${key}T12:00:00`)) === key
      )
    )
      return undefined;
    return [...new Set(dates)].sort(compareDateKeys);
  } catch {
    return undefined;
  }
}

export function SkippedDatesPicker(props: {
  dates: string[];
  onChange: (dates: string[]) => void;
}) {
  const today = new Date();
  const [cursor, setCursor] = createSignal(today);
  let calendar: HTMLDivElement | undefined;
  const monthDays = createMemo(() => {
    const year = cursor().getFullYear();
    const month = cursor().getMonth();
    return Array.from(
      { length: new Date(year, month + 1, 0).getDate() },
      (_, index) => dateKey(new Date(year, month, index + 1, 12))
    );
  });
  const navigate = (offset: number) =>
    setCursor(
      new Date(cursor().getFullYear(), cursor().getMonth() + offset, 1, 12)
    );
  const moveFocus = (event: KeyboardEvent, date: Date) => {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      Home: -date.getDay(),
      End: 6 - date.getDay(),
    };
    if (!Object.hasOwn(steps, event.key)) return;
    event.preventDefault();
    const next = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + steps[event.key],
      12
    );
    setCursor(next);
    calendar
      ?.querySelector<HTMLButtonElement>(`[data-date="${dateKey(next)}"]`)
      ?.focus();
  };
  return (
    <fieldset class="min-w-0 space-y-2" data-testid="calendar-exceptions">
      <legend class="text-sm font-medium">Dates to Skip</legend>
      <p class="text-sm text-muted-foreground">
        Select dates to skip practice. Select a date again to remove it.
      </p>
      <div class="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="icon"
          class="size-11"
          aria-label="Previous month"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft aria-hidden="true" class="size-4" />
        </Button>
        <span aria-live="polite" class="text-sm font-medium">
          {cursor().toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          class="size-11"
          aria-label="Next month"
          onClick={() => navigate(1)}
        >
          <ChevronRight aria-hidden="true" class="size-4" />
        </Button>
      </div>
      <div
        ref={calendar}
        class="grid grid-cols-[repeat(7,minmax(44px,1fr))] overflow-x-auto p-0.5 text-center"
      >
        <For each={weekdays}>
          {(day) => (
            <span aria-hidden="true" class="text-xs text-muted-foreground">
              {day.slice(0, 2)}
            </span>
          )}
        </For>
        <For each={monthDays()}>
          {(key) => {
            const date = new Date(`${key}T12:00:00`);
            const selected = () => props.dates.includes(key);
            return (
              <Button
                type="button"
                variant={selected() ? "default" : "ghost"}
                class="h-11 px-0"
                style={{ "grid-column-start": date.getDay() + 1 }}
                data-date={key}
                tabIndex={dateKey(cursor()) === key ? 0 : -1}
                aria-label={date.toLocaleDateString(undefined, {
                  dateStyle: "full",
                })}
                aria-current={key === dateKey(today) ? "date" : undefined}
                aria-pressed={selected()}
                onKeyDown={(event) => moveFocus(event, date)}
                onClick={() => {
                  setCursor(date);
                  props.onChange(
                    selected()
                      ? props.dates.filter((value) => value !== key)
                      : [...props.dates, key].sort(compareDateKeys)
                  );
                }}
              >
                {date.getDate()}
              </Button>
            );
          }}
        </For>
      </div>
      <p class="text-sm text-muted-foreground" aria-live="polite">
        {props.dates.length
          ? `Skipped dates: ${props.dates.join(", ")}`
          : "No dates skipped."}
      </p>
    </fieldset>
  );
}
