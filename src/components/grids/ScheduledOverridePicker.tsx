/**
 * ScheduledOverridePicker
 *
 * In-grid cell editor for the "Sched Override" (scheduled) column.
 * Displays the current override date/time or a "—" placeholder when empty.
 * When `onChange` is provided the cell becomes a clickable trigger that opens
 * a Kobalte Popover with a native `datetime-local` input, a Clear button, and
 * an Apply button — matching the datetime picker already in TuneEditor.
 *
 * Handles TanStack Virtual's cell-reuse pattern by auto-closing the popover
 * and syncing local state whenever `tuneId` or `value` changes.
 */
import { Popover as PopoverPrimitive } from "@kobalte/core/popover";
import { Calendar } from "lucide-solid";
import {
  type Component,
  createEffect,
  createSignal,
  Show,
  untrack,
} from "solid-js";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert an ISO timestamp to the `YYYY-MM-DDTHH:mm` format expected by
 * `<input type="datetime-local">`.  Returns "" for null / invalid values.
 */
function toDatetimeLocal(isoStr: string | null | undefined): string {
  if (!isoStr) return "";
  try {
    const date = new Date(isoStr);
    if (Number.isNaN(date.getTime())) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const h = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${d}T${h}:${min}`;
  } catch {
    return "";
  }
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
  const [localValue, setLocalValue] = createSignal(
    toDatetimeLocal(props.value)
  );

  // Auto-close and re-sync when the virtual list reuses this cell for a
  // different row (tuneId changes) or the underlying data refreshes.
  createEffect(() => {
    const _tuneId = props.tuneId;
    const _value = props.value;
    setOpen(false);
    untrack(() => setLocalValue(toDatetimeLocal(_value)));
  });

  const handleApply = () => {
    const v = localValue();
    const isoValue = v ? new Date(v).toISOString() : null;
    props.onChange?.(isoValue);
    setOpen(false);
  };

  const handleClear = () => {
    setLocalValue("");
    props.onChange?.(null);
    setOpen(false);
  };

  // ── Read-only fallback ────────────────────────────────────────────────────
  const ReadOnly = () => (
    <Show
      when={props.value}
      fallback={<span class="text-gray-400">—</span>}
    >
      <span class="text-sm text-gray-600 dark:text-gray-400">
        {formatDisplay(props.value)}
      </span>
    </Show>
  );

  // ── Editable (popover) ─────────────────────────────────────────────────────
  return (
    <Show when={props.onChange} fallback={<ReadOnly />}>
      <PopoverPrimitive open={open()} onOpenChange={setOpen}>
        <PopoverPrimitive.Trigger
          data-testid={`scheduled-override-trigger-${props.tuneId}`}
          class="flex items-center gap-1 text-sm cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
        >
          <Show
            when={props.value}
            fallback={
              <span class="text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300 flex items-center gap-1">
                <span>—</span>
                <Calendar class="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity" />
              </span>
            }
          >
            <span class="text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200">
              {formatDisplay(props.value)}
            </span>
            <Calendar class="w-3.5 h-3.5 text-gray-400 opacity-50 group-hover:opacity-80 transition-opacity flex-shrink-0" />
          </Show>
        </PopoverPrimitive.Trigger>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            data-testid={`scheduled-override-popover-${props.tuneId}`}
            class="z-50 w-72 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-lg outline-none"
          >
            <div class="space-y-3">
              <p class="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Schedule Override
              </p>
              <input
                type="datetime-local"
                value={localValue()}
                onInput={(e) => setLocalValue(e.currentTarget.value)}
                data-testid={`scheduled-override-input-${props.tuneId}`}
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Force this tune into your queue on this date. Cleared after
                practice.
              </p>
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
                    onClick={() => setOpen(false)}
                    class="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    data-testid={`scheduled-override-apply-${props.tuneId}`}
                    class="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
