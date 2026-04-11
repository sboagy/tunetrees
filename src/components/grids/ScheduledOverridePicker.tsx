/**
 * ScheduledOverridePicker
 *
 * In-grid cell editor for the "Sched Override" (scheduled) column.
 * Uses a single popover surface with an inline calendar, local time controls,
 * and Apply/Clear/Cancel actions so the browser does not open a second native
 * date picker panel.
 */
import { Popover as PopoverPrimitive } from "@kobalte/core/popover";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-solid";
import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  For,
  Show,
  untrack,
} from "solid-js";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const DEFAULT_HOUR = "12";
const DEFAULT_MINUTE = "00";
const DEFAULT_PERIOD = "PM" as const;

type Meridiem = "AM" | "PM";

function padNumber(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function addDays(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta);
}

function startOfWeek(date: Date): Date {
  return addDays(date, -date.getDay());
}

function buildCalendarDays(month: Date): Date[] {
  const firstDay = startOfMonth(month);
  const gridStart = startOfWeek(firstDay);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function formatMonthYear(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function getDefaultLocalParts() {
  return {
    date: "",
    hour: DEFAULT_HOUR,
    minute: DEFAULT_MINUTE,
    period: DEFAULT_PERIOD,
  };
}

function toLocalParts(isoStr: string | null | undefined) {
  if (!isoStr) return getDefaultLocalParts();

  try {
    const date = new Date(isoStr);
    if (Number.isNaN(date.getTime())) return getDefaultLocalParts();

    const hours24 = date.getHours();
    const hour12 = hours24 % 12 || 12;

    return {
      date: formatDateKey(date),
      hour: padNumber(hour12),
      minute: padNumber(date.getMinutes()),
      period: hours24 >= 12 ? ("PM" as const) : ("AM" as const),
    };
  } catch {
    return getDefaultLocalParts();
  }
}

function clampDigits(value: string, maxLength: number): string {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function normalizeHour(value: string): string {
  if (!value) return DEFAULT_HOUR;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return DEFAULT_HOUR;
  return padNumber(Math.min(12, Math.max(1, parsed)));
}

function normalizeMinute(value: string): string {
  if (!value) return DEFAULT_MINUTE;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return DEFAULT_MINUTE;
  return padNumber(Math.min(59, Math.max(0, parsed)));
}

function isValidTime(hour: string, minute: string): boolean {
  if (hour.length === 0 || minute.length === 0) return false;

  const parsedHour = Number.parseInt(hour, 10);
  const parsedMinute = Number.parseInt(minute, 10);

  return (
    !Number.isNaN(parsedHour) &&
    !Number.isNaN(parsedMinute) &&
    parsedHour >= 1 &&
    parsedHour <= 12 &&
    parsedMinute >= 0 &&
    parsedMinute <= 59
  );
}

function toIsoTimestamp(
  dateValue: string,
  hourValue: string,
  minuteValue: string,
  period: Meridiem
): string | null {
  if (!dateValue || !isValidTime(hourValue, minuteValue)) return null;

  const [year, month, day] = dateValue.split("-").map(Number);
  if (!year || !month || !day) return null;

  const hour12 = Number.parseInt(hourValue, 10);
  const minute = Number.parseInt(minuteValue, 10);
  let hour24 = hour12 % 12;
  if (period === "PM") hour24 += 12;

  const date = new Date(year, month - 1, day, hour24, minute, 0, 0);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

/** Format an ISO timestamp as a human-readable short date+time string. */
function formatDisplay(isoStr: string): string {
  try {
    const date = new Date(isoStr);
    if (Number.isNaN(date.getTime())) return isoStr;
    return date.toLocaleString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoStr;
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ScheduledOverridePickerProps {
  /** Tune ID – used to detect cell reuse in virtual lists. */
  tuneId: string;
  /** Current ISO timestamp value (or empty string / null when unset). */
  value: string;
  /** Optional trigger label shown instead of the raw override timestamp. */
  triggerLabel?: string;
  /** Optional title attribute applied to the trigger. */
  triggerTitle?: string;
  /** Optional text color classes for the trigger label. */
  triggerTextClass?: string;
  /** Optional emphasis classes applied when an override is set. */
  triggerActiveClass?: string;
  /**
   * Called when the user applies or clears the override.
   * Pass `null` to clear the override.
   * When `undefined` the component renders as read-only.
   */
  onChange?: (newValue: string | null) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ScheduledOverridePicker: Component<
  ScheduledOverridePickerProps
> = (props) => {
  const [open, setOpen] = createSignal(false);
  const [draftDate, setDraftDate] = createSignal("");
  const [draftHour, setDraftHour] = createSignal(DEFAULT_HOUR);
  const [draftMinute, setDraftMinute] = createSignal(DEFAULT_MINUTE);
  const [draftPeriod, setDraftPeriod] = createSignal<Meridiem>(DEFAULT_PERIOD);
  const [visibleMonth, setVisibleMonth] = createSignal(
    startOfMonth(new Date())
  );

  const syncFromProps = () => {
    const parts = toLocalParts(props.value);
    setDraftDate(parts.date);
    setDraftHour(parts.hour);
    setDraftMinute(parts.minute);
    setDraftPeriod(parts.period);
    setVisibleMonth(
      startOfMonth(parts.date ? new Date(`${parts.date}T12:00:00`) : new Date())
    );
  };

  // Auto-close and re-sync when the virtual list reuses this cell for a
  // different row (tuneId changes) or the underlying data refreshes.
  createEffect(() => {
    const _value = props.value;
    setOpen(false);
    untrack(() => {
      void _value;
      syncFromProps();
    });
  });

  const calendarDays = createMemo(() => buildCalendarDays(visibleMonth()));
  const todayKey = createMemo(() => formatDateKey(new Date()));
  const draftIso = createMemo(() =>
    toIsoTimestamp(
      draftDate(),
      normalizeHour(draftHour()),
      normalizeMinute(draftMinute()),
      draftPeriod()
    )
  );
  const canApply = createMemo(() => Boolean(draftIso()));
  const hasOverride = createMemo(() => Boolean(props.value));
  // Binary: purple = a schedule override is set (user-specified); gray = no override.
  // Color is independent of whether the override date is past, today, or future.
  const triggerIconClass = createMemo(() =>
    hasOverride()
      ? "text-purple-600 dark:text-purple-400"
      : "text-gray-400 dark:text-gray-500"
  );
  const triggerIconWrapperClass = createMemo(() =>
    hasOverride()
      ? "border-b-2 border-current pb-0.5"
      : "border-b-2 border-transparent pb-0.5"
  );
  const draftSummary = createMemo(() => {
    const iso = draftIso();
    return iso ? formatDisplay(iso) : "Select date and time";
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen || open()) {
      syncFromProps();
    }
    setOpen(nextOpen);
  };

  const handleDaySelect = (date: Date) => {
    setDraftDate(formatDateKey(date));
    setVisibleMonth(startOfMonth(date));
  };

  const handleApply = () => {
    const isoValue = draftIso();
    if (!isoValue) return;

    props.onChange?.(isoValue);
    setOpen(false);
  };

  const handleClear = () => {
    syncFromProps();
    props.onChange?.(null);
    setOpen(false);
  };

  // ── Read-only fallback ────────────────────────────────────────────────────
  const ReadOnly = () => (
    <Show when={props.value} fallback={<span class="text-gray-400">—</span>}>
      <span class="text-sm text-gray-600 dark:text-gray-400">
        {props.triggerLabel ?? formatDisplay(props.value)}
      </span>
    </Show>
  );

  // ── Editable (popover) ─────────────────────────────────────────────────────
  return (
    <Show when={props.onChange} fallback={<ReadOnly />}>
      <PopoverPrimitive
        open={open()}
        onOpenChange={handleOpenChange}
        placement="bottom-end"
        gutter={6}
        shift={12}
        flip="top-end top-start bottom-start"
        fitViewport={true}
        overflowPadding={12}
      >
        <PopoverPrimitive.Trigger
          data-testid={`scheduled-override-trigger-${props.tuneId}`}
          aria-label={
            props.triggerLabel
              ? undefined
              : props.value
                ? "Edit schedule override"
                : "Set schedule override"
          }
          title={props.triggerTitle}
          class="flex min-h-6 w-full min-w-0 items-center justify-between gap-2 rounded px-1 text-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Show
            when={props.triggerLabel ?? props.value}
            fallback={
              <>
                <span class="min-w-0 flex-1 text-left text-gray-400">
                  &nbsp;
                </span>
                <span
                  data-testid={`scheduled-override-icon-${props.tuneId}`}
                  class={`inline-flex flex-shrink-0 items-end ${triggerIconClass()} ${triggerIconWrapperClass()}`}
                >
                  <Calendar class="h-4 w-4" />
                </span>
                <span class="sr-only">Set schedule override</span>
              </>
            }
          >
            <span
              class={`min-w-0 flex-1 truncate text-left ${props.triggerTextClass ?? "text-gray-600 dark:text-gray-400"} ${hasOverride() ? (props.triggerActiveClass ?? "font-semibold underline decoration-dotted underline-offset-2") : ""}`}
            >
              {props.triggerLabel ?? formatDisplay(props.value)}
            </span>
            <span
              data-testid={`scheduled-override-icon-${props.tuneId}`}
              class={`inline-flex flex-shrink-0 items-end ${triggerIconClass()} ${triggerIconWrapperClass()}`}
            >
              <Calendar class="h-4 w-4" />
            </span>
          </Show>
        </PopoverPrimitive.Trigger>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            data-testid={`scheduled-override-popover-${props.tuneId}`}
            class="z-50 w-[min(22rem,calc(100vw-1.5rem))] max-h-[min(42rem,calc(100vh-1.5rem))] overflow-y-auto rounded-md border border-gray-200 bg-white p-4 shadow-lg outline-none dark:border-gray-700 dark:bg-gray-900"
          >
            <div class="space-y-4">
              <div class="space-y-1">
                <p class="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Schedule Override
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  Set a manual override for this tune's next review date.
                </p>
              </div>

              <div class="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/80">
                <span class="min-w-0 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {draftSummary()}
                </span>
                <Calendar class="h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
              </div>

              <div class="space-y-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
                <div class="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleMonth(addMonths(visibleMonth(), -1))
                    }
                    class="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    aria-label="Previous month"
                  >
                    <ChevronLeft class="h-4 w-4" />
                  </button>

                  <div class="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {formatMonthYear(visibleMonth())}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setVisibleMonth(addMonths(visibleMonth(), 1))
                    }
                    class="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    aria-label="Next month"
                  >
                    <ChevronRight class="h-4 w-4" />
                  </button>
                </div>

                <div class="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <For each={WEEKDAY_LABELS}>
                    {(label) => <div>{label}</div>}
                  </For>
                </div>

                <div class="grid grid-cols-7 gap-1">
                  <For each={calendarDays()}>
                    {(day) => {
                      const dayKey = formatDateKey(day);
                      const inCurrentMonth =
                        day.getMonth() === visibleMonth().getMonth() &&
                        day.getFullYear() === visibleMonth().getFullYear();
                      const isSelected = dayKey === draftDate();
                      const isToday = dayKey === todayKey();

                      return (
                        <button
                          type="button"
                          onClick={() => handleDaySelect(day)}
                          data-testid={
                            isSelected
                              ? `scheduled-override-selected-day-${props.tuneId}`
                              : undefined
                          }
                          class="inline-flex h-9 items-center justify-center rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          classList={{
                            "bg-blue-600 text-white": isSelected,
                            "border border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300":
                              !isSelected && isToday,
                            "text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800":
                              !isSelected && inCurrentMonth && !isToday,
                            "text-gray-400 hover:bg-gray-100 dark:text-gray-600 dark:hover:bg-gray-800":
                              !isSelected && !inCurrentMonth && !isToday,
                          }}
                        >
                          {day.getDate()}
                        </button>
                      );
                    }}
                  </For>
                </div>

                <button
                  type="button"
                  onClick={() => handleDaySelect(new Date())}
                  class="text-xs font-medium text-blue-600 hover:underline focus:outline-none dark:text-blue-400"
                >
                  Today
                </button>
              </div>

              <div class="space-y-2">
                <div class="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Time
                </div>
                <div class="flex items-center gap-2">
                  <input
                    type="text"
                    inputmode="numeric"
                    value={draftHour()}
                    onInput={(e) =>
                      setDraftHour(clampDigits(e.currentTarget.value, 2))
                    }
                    onBlur={() => setDraftHour(normalizeHour(draftHour()))}
                    data-testid={`scheduled-override-hour-${props.tuneId}`}
                    class="w-14 rounded-md border border-gray-300 px-3 py-2 text-center text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    aria-label="Hour"
                  />
                  <span class="text-sm font-semibold text-gray-500 dark:text-gray-400">
                    :
                  </span>
                  <input
                    type="text"
                    inputmode="numeric"
                    value={draftMinute()}
                    onInput={(e) =>
                      setDraftMinute(clampDigits(e.currentTarget.value, 2))
                    }
                    onBlur={() =>
                      setDraftMinute(normalizeMinute(draftMinute()))
                    }
                    data-testid={`scheduled-override-minute-${props.tuneId}`}
                    class="w-14 rounded-md border border-gray-300 px-3 py-2 text-center text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    aria-label="Minute"
                  />
                  <div class="ml-1 inline-flex rounded-md border border-gray-300 dark:border-gray-600">
                    <button
                      type="button"
                      onClick={() => setDraftPeriod("AM")}
                      class="px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      classList={{
                        "bg-blue-600 text-white": draftPeriod() === "AM",
                        "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800":
                          draftPeriod() !== "AM",
                      }}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraftPeriod("PM")}
                      class="px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      classList={{
                        "bg-blue-600 text-white": draftPeriod() === "PM",
                        "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800":
                          draftPeriod() !== "PM",
                      }}
                    >
                      PM
                    </button>
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleClear}
                  class="px-3 py-1 text-xs text-blue-600 dark:text-blue-400 hover:underline focus:outline-none"
                >
                  Clear
                </button>
                <div class="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenChange(false)}
                    class="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={!canApply()}
                    data-testid={`scheduled-override-apply-${props.tuneId}`}
                    class="px-3 py-1 text-xs rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
                    classList={{
                      "bg-blue-600 text-white hover:bg-blue-700": canApply(),
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive>
    </Show>
  );
};
