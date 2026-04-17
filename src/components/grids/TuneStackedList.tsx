/**
 * TuneStackedList
 *
 * Mobile-optimised stacked list view for tune data.
 * Rendered instead of the full TanStack table on viewports narrower than the
 * Tailwind `md` breakpoint (< 768 px).
 *
 * Each item shows a prioritised subset of fields stacked vertically (title,
 * type/mode badges, and purpose-specific secondary info) with a minimum 44 px
 * touch target, dark-mode support, and current-row highlight.
 *
 * This is intentionally NOT a card grid – items are full-width single-column
 * list rows that maintain the "list" mental model of the desktop table while
 * fitting narrow viewports without horizontal scrolling.
 */

import { For, type JSX, Show } from "solid-js";
import { GoalBadge } from "./GoalBadge";
import { RecallEvalComboBox } from "./RecallEvalComboBox";
import { ScheduledOverridePicker } from "./ScheduledOverridePicker";
import type { ICellEditorCallbacks, TablePurpose } from "./types";

// ── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_GOAL = "recall";

function formatJustDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

function getRelativeLabel(value: string | null | undefined): {
  label: string;
  colorClass: string;
} {
  if (!value) return { label: "—", colorClass: "text-gray-400" };
  const date = new Date(value);
  const now = new Date();
  const dateOnly = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round(
    (dateOnly.getTime() - nowOnly.getTime()) / (1000 * 60 * 60 * 24)
  );
  let colorClass = "text-gray-600 dark:text-gray-400";
  if (diffDays < 0) colorClass = "text-red-600 dark:text-red-400";
  else if (diffDays === 0) colorClass = "text-orange-600 dark:text-orange-400";
  else if (diffDays <= 7) colorClass = "text-yellow-600 dark:text-yellow-400";
  else colorClass = "text-green-600 dark:text-green-400";

  const label =
    diffDays === 0
      ? "Today"
      : diffDays === -1
        ? "Yesterday"
        : diffDays < 0
          ? `${Math.abs(diffDays)}d overdue`
          : diffDays === 1
            ? "Tomorrow"
            : `In ${diffDays}d`;

  return { label, colorClass };
}

function getRecallEvalDisplay(value: string | null | undefined): {
  label: string;
  colorClass: string;
} | null {
  if (!value) return null;

  const labels: Record<string, string> = {
    again: "Again",
    hard: "Hard",
    good: "Good",
    easy: "Easy",
  };
  const colors: Record<string, string> = {
    again: "text-red-600 dark:text-red-400",
    hard: "text-orange-600 dark:text-orange-400",
    good: "text-green-600 dark:text-green-400",
    easy: "text-blue-600 dark:text-blue-400",
  };

  return {
    label: labels[value] ?? value,
    colorClass: colors[value] ?? "text-gray-600 dark:text-gray-400",
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

const TypeBadge = (props: { value: string | null | undefined }) => (
  <Show when={props.value}>
    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
      {props.value}
    </span>
  </Show>
);

const ModeBadge = (props: { value: string | null | undefined }) => (
  <Show when={props.value}>
    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
      {props.value}
    </span>
  </Show>
);

const BucketBadge = (props: { value: string | null | undefined }) => {
  const colors: Record<string, string> = {
    "Due Today":
      "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
    Lapsed:
      "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
    New: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
    "Old Lapsed":
      "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
  };
  const label = props.value ?? "Due Today";
  const colorClass =
    colors[label] ??
    "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400";
  return (
    <span
      class={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${colorClass}`}
    >
      {label}
    </span>
  );
};

const StateBadge = (props: { value: number | null | undefined }) => {
  const statuses: Record<number, { label: string; class: string }> = {
    0: {
      label: "New",
      class:
        "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs px-1.5 py-0.5 rounded",
    },
    1: {
      label: "Learning",
      class:
        "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs px-1.5 py-0.5 rounded",
    },
    2: {
      label: "Review",
      class:
        "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs px-1.5 py-0.5 rounded",
    },
    3: {
      label: "Relearning",
      class:
        "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 text-xs px-1.5 py-0.5 rounded",
    },
  };
  const status =
    props.value != null ? (statuses[props.value] ?? statuses[0]) : null;
  return (
    <Show when={status}>
      <span class={status!.class}>{status!.label}</span>
    </Show>
  );
};

const OwnershipBadge = (props: { value: string | null | undefined }) => {
  const isPrivate = Boolean(props.value);
  const label = isPrivate ? "Private" : "Public";
  const colorClass = isPrivate
    ? "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200"
    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400";

  return (
    <span
      class={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${colorClass}`}
    >
      {label}
    </span>
  );
};

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Minimum data shape expected by TuneStackedList.
 * The component accesses these fields from tune rows across all three grid
 * purposes (scheduled / repertoire / catalog).  Fields beyond `id` are
 * optional because not all purposes populate every column.
 */
export interface IStackedListRow {
  id: string | number;
  /** Aliased tune id used in scheduled rows (from daily_practice_queue join) */
  tune_id?: string | number;
  title?: string | null;
  type?: string | null;
  mode?: string | null;
  structure?: string | null;
  incipit?: string | null;
  artist?: string | null;
  release_year?: string | number | null;
  composer?: string | null;
  genre?: string | null;
  favorite_url?: string | null;
  favoriteUrl?: string | null;
  primary_origin?: string | null;
  primaryOrigin?: string | null;
  id_foreign?: string | null;
  idForeign?: string | null;
  private_for?: string | null;
  privateFor?: string | null;
  // Scheduled-specific
  bucket?: string | null;
  recall_eval?: string | null;
  completed_at?: string | null; // Timestamp when evaluation was submitted
  learned?: string | null;
  latest_practiced?: string | null;
  latest_quality?: number | null;
  latest_easiness?: number | null;
  latest_stability?: number | null;
  latest_interval?: number | null;
  latest_technique?: string | null;
  // latest_due is used in both scheduled (FSRS next-review date) and repertoire (due date display)
  latest_due?: string | null;
  // Repertoire-specific
  latest_state?: number | null;
  goal?: string | null;
  latest_goal?: string | null;
  tags?: string | null;
  purpose?: string | null;
  note_private?: string | null;
  note_public?: string | null;
  has_override?: number | null;
  has_staged?: number | null;
  // scheduled is used in both scheduled and repertoire (manual override date)
  scheduled?: string | null;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ITuneStackedListProps {
  data: IStackedListRow[];
  tablePurpose: TablePurpose;
  currentRowId?: string | number;
  onRowClick?: (row: IStackedListRow) => void;
  onRowDoubleClick?: (row: IStackedListRow) => void;
  enableRowSelection?: boolean;
  selectedRowIds?: Record<string, boolean>;
  onRowSelectionChange?: (row: IStackedListRow, checked: boolean) => void;
  cellCallbacks?: ICellEditorCallbacks;
  /**
   * Column visibility state from the TanStack table instance.
   * Controls which fields are rendered in each stacked list item.
   * A column is visible when its value is `true` or not present in the map.
   * Mirrors the same visibility object used by the desktop table.
   */
  columnVisibility?: Record<string, boolean>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const TuneStackedList = (props: ITuneStackedListProps) => {
  /**
   * Returns true when the given column should be rendered.
   * A column is considered visible unless it is explicitly set to `false` in
   * the `columnVisibility` map.  When the map is absent or empty every field
   * defaults to visible (backward-compatible behaviour).
   */
  const isColVisible = (columnId: string): boolean => {
    const vis = props.columnVisibility;
    if (!vis || Object.keys(vis).length === 0) return true;
    return vis[columnId] !== false;
  };

  const renderLabeledValue = (
    label: string,
    value: string | number,
    valueClass = "text-gray-700 dark:text-gray-300"
  ): JSX.Element => (
    <span>
      {label}: <span class={valueClass}>{String(value)}</span>
    </span>
  );

  const renderRelativeValue = (
    label: string,
    value: string | null | undefined
  ): JSX.Element => {
    const rel = getRelativeLabel(value);
    return renderLabeledValue(label, rel.label, rel.colorClass);
  };

  return (
    <div
      class="flex-1 overflow-y-auto"
      data-testid={`tunes-grid-${props.tablePurpose}`}
    >
      <ul
        class="divide-y divide-gray-200 dark:divide-gray-700"
        aria-label="Tunes list"
      >
        <For each={props.data}>
          {(item) => {
            const itemId = item.tune_id ?? item.id;
            const rowId = String(item.id);
            const isSelected = () =>
              props.currentRowId != null &&
              String(props.currentRowId) === String(itemId);
            const isRowChecked = () => props.selectedRowIds?.[rowId] === true;
            const showsRowSelection = () => props.enableRowSelection === true;

            const title = item.title ?? "(Untitled)";
            const favoriteUrl = item.favorite_url ?? item.favoriteUrl ?? null;
            const primaryOrigin =
              item.primary_origin ?? item.primaryOrigin ?? null;
            const idForeign = item.id_foreign ?? item.idForeign ?? null;
            const privateFor = item.private_for ?? item.privateFor ?? null;
            const href =
              favoriteUrl ??
              (primaryOrigin === "irishtune.info" && idForeign
                ? `https://www.irishtune.info/tune/${idForeign}/`
                : null);
            const titleVisible = () => isColVisible("title");
            const idVisible = () => isColVisible("id") && item.id != null;
            const showIdInMetadata = () => titleVisible() && idVisible();
            const goalValue = item.goal ?? item.latest_goal;
            const goalDisplayValue = goalValue || DEFAULT_GOAL;
            const onGoalChange = props.cellCallbacks?.onGoalChange;
            const recallEval = getRecallEvalDisplay(item.recall_eval);
            const displayedScheduled =
              item.scheduled ?? item.latest_due ?? null;
            const scheduledDisplay = displayedScheduled
              ? getRelativeLabel(displayedScheduled)
              : null;

            const tuneMetadata = (): JSX.Element[] => [
              ...(isColVisible("structure") && item.structure
                ? [
                    renderLabeledValue(
                      "Structure",
                      item.structure,
                      "font-mono text-gray-700 dark:text-gray-300"
                    ),
                  ]
                : []),
              ...(isColVisible("incipit") && item.incipit
                ? [
                    renderLabeledValue(
                      "Incipit",
                      item.incipit,
                      "font-mono text-gray-700 dark:text-gray-300"
                    ),
                  ]
                : []),
              ...(isColVisible("genre") && item.genre
                ? [renderLabeledValue("Genre", item.genre)]
                : []),
              ...(isColVisible("composer") && item.composer
                ? [renderLabeledValue("Composer", item.composer)]
                : []),
              ...(isColVisible("artist") && item.artist
                ? [renderLabeledValue("Artist", item.artist)]
                : []),
              ...(isColVisible("release_year") && item.release_year != null
                ? [renderLabeledValue("Year", item.release_year)]
                : []),
            ];

            const practiceMetadata = (): JSX.Element[] =>
              props.tablePurpose === "catalog"
                ? []
                : [
                    ...(isColVisible("learned") && item.learned
                      ? [
                          renderLabeledValue(
                            "Learned",
                            formatJustDate(item.learned)
                          ),
                        ]
                      : []),
                    ...(isColVisible("latest_due") && item.latest_due
                      ? [renderRelativeValue("Due", item.latest_due)]
                      : []),
                    ...(isColVisible("latest_practiced") &&
                    item.latest_practiced
                      ? [
                          renderLabeledValue(
                            "Practiced",
                            formatJustDate(item.latest_practiced)
                          ),
                        ]
                      : []),
                    ...(isColVisible("recall_eval") && recallEval
                      ? [
                          renderLabeledValue(
                            "Recall Eval",
                            recallEval.label,
                            recallEval.colorClass
                          ),
                        ]
                      : []),
                    ...(isColVisible("latest_quality") &&
                    item.latest_quality != null
                      ? [renderLabeledValue("Quality", item.latest_quality)]
                      : []),
                    ...(isColVisible("latest_easiness") &&
                    item.latest_easiness != null
                      ? [
                          renderLabeledValue(
                            "Easiness",
                            item.latest_easiness.toFixed(2)
                          ),
                        ]
                      : []),
                    ...(isColVisible("latest_stability") &&
                    item.latest_stability != null
                      ? [
                          renderLabeledValue(
                            "Stability",
                            item.latest_stability.toFixed(1)
                          ),
                        ]
                      : []),
                    ...(isColVisible("latest_interval") &&
                    item.latest_interval != null
                      ? [
                          renderLabeledValue(
                            "Interval",
                            `${item.latest_interval}d`
                          ),
                        ]
                      : []),
                  ];

            const auxiliaryMetadata = (): JSX.Element[] => [
              ...(isColVisible("tags") && item.tags
                ? [renderLabeledValue("Tags", item.tags)]
                : []),
              ...(isColVisible("purpose") && item.purpose
                ? [renderLabeledValue("Purpose", item.purpose)]
                : []),
              ...(isColVisible("note_private") && item.note_private
                ? [renderLabeledValue("Private Note", item.note_private)]
                : []),
              ...(isColVisible("note_public") && item.note_public
                ? [renderLabeledValue("Public Note", item.note_public)]
                : []),
              ...(isColVisible("has_override") && item.has_override === 1
                ? [
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                      Override
                    </span>,
                  ]
                : []),
              ...(isColVisible("has_staged") && item.has_staged === 1
                ? [
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                      Staged
                    </span>,
                  ]
                : []),
              ...(isColVisible("private_for")
                ? [
                    <span>
                      Ownership: <OwnershipBadge value={privateFor} />
                    </span>,
                  ]
                : []),
              ...(isColVisible("id_foreign") && idForeign
                ? [
                    renderLabeledValue(
                      "External ID",
                      idForeign,
                      "font-mono text-gray-700 dark:text-gray-300"
                    ),
                  ]
                : []),
              ...(showIdInMetadata()
                ? [
                    renderLabeledValue(
                      "ID",
                      item.id,
                      "font-mono text-gray-700 dark:text-gray-300"
                    ),
                  ]
                : []),
            ];

            const metadataEntries = (): JSX.Element[] => [
              ...tuneMetadata(),
              ...practiceMetadata(),
              ...auxiliaryMetadata(),
            ];

            return (
              <li
                class={`px-4 py-3 min-h-[44px] cursor-pointer transition-colors ${
                  isSelected()
                    ? "bg-blue-50 dark:bg-blue-900/25 border-l-2 border-blue-400 dark:border-blue-500"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                }`}
                onClick={() => props.onRowClick?.(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    props.onRowClick?.(item);
                  }
                }}
                onDblClick={() => props.onRowDoubleClick?.(item)}
                data-testid={`stacked-item-${itemId}`}
                data-selected={isSelected() ? "true" : undefined}
              >
                <div class="flex items-start gap-2.5">
                  <Show when={showsRowSelection()}>
                    {/* biome-ignore lint/a11y/noStaticElementInteractions: stop-propagation wrapper isolates checkbox interaction from row tap selection */}
                    {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction is handled by the checkbox itself */}
                    <div
                      class="flex h-10 w-10 flex-shrink-0 items-start justify-center pt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isRowChecked()}
                        onChange={(e) =>
                          props.onRowSelectionChange?.(
                            item,
                            e.currentTarget.checked
                          )
                        }
                        class="h-4 w-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={`Select row ${rowId}`}
                        data-testid={`stacked-row-checkbox-${rowId}`}
                      />
                    </div>
                  </Show>

                  <div class="min-w-0 flex-1">
                    {/* Row 1: Title + primary badge (always shown) */}
                    <div class="flex items-start justify-between gap-2 min-h-[24px]">
                      <div class="font-medium text-sm text-gray-900 dark:text-gray-100 leading-snug flex-1 min-w-0">
                        <Show
                          when={titleVisible()}
                          fallback={
                            <Show
                              when={idVisible()}
                              fallback={
                                <span class="text-gray-400 dark:text-gray-500 italic">
                                  Title hidden
                                </span>
                              }
                            >
                              <span class="font-mono text-xs text-gray-600 dark:text-gray-400">
                                {String(item.id)}
                              </span>
                            </Show>
                          }
                        >
                          <Show when={href} fallback={<span>{title}</span>}>
                            <a
                              href={href!}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="text-blue-600 dark:text-blue-400 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {title}
                            </a>
                          </Show>
                        </Show>
                      </div>
                      {/* Purpose-specific right badge, controlled by column visibility */}
                      <Show
                        when={
                          props.tablePurpose === "scheduled" &&
                          isColVisible("bucket")
                        }
                      >
                        <BucketBadge value={item.bucket} />
                      </Show>
                      <Show
                        when={
                          props.tablePurpose === "repertoire" &&
                          isColVisible("latest_state")
                        }
                      >
                        <StateBadge value={item.latest_state} />
                      </Show>
                    </div>

                    {/* Row 2: Type + Mode badges + purpose-specific interactive control */}
                    <div class="mt-1 flex flex-wrap items-center gap-1.5">
                      <Show when={isColVisible("type")}>
                        <TypeBadge value={item.type} />
                      </Show>
                      <Show when={isColVisible("mode")}>
                        <ModeBadge value={item.mode} />
                      </Show>
                      <Show
                        when={
                          props.tablePurpose === "scheduled" &&
                          isColVisible("latest_state")
                        }
                      >
                        <StateBadge value={item.latest_state} />
                      </Show>

                      {/* Scheduled: Recall Eval dropdown or static text (controlled by "evaluation" column) */}
                      <Show
                        when={
                          props.tablePurpose !== "catalog" &&
                          isColVisible("goal")
                        }
                      >
                        {/* biome-ignore lint/a11y/noStaticElementInteractions: stop-propagation wrapper prevents row selection while interacting with goal controls */}
                        {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction is handled by the contained dropdown trigger */}
                        <div
                          class="flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <GoalBadge
                            value={goalDisplayValue}
                            goals={props.cellCallbacks?.goals}
                            onGoalChange={
                              onGoalChange
                                ? (newGoal) =>
                                    onGoalChange(String(itemId), newGoal)
                                : undefined
                            }
                          />
                        </div>
                      </Show>

                      <Show
                        when={
                          props.tablePurpose !== "catalog" &&
                          isColVisible("scheduled")
                        }
                      >
                        {/* biome-ignore lint/a11y/noStaticElementInteractions: stop-propagation wrapper prevents row selection while interacting with schedule controls */}
                        {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction is handled by the contained picker trigger */}
                        <div
                          class="min-w-0 flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Show
                            when={props.cellCallbacks?.onScheduledChange}
                            fallback={
                              <Show
                                when={scheduledDisplay}
                                fallback={
                                  <span class="text-gray-400 dark:text-gray-500">
                                    —
                                  </span>
                                }
                              >
                                <span
                                  class={`text-sm font-medium ${scheduledDisplay?.colorClass ?? ""}`}
                                >
                                  {scheduledDisplay?.label}
                                </span>
                              </Show>
                            }
                          >
                            <ScheduledOverridePicker
                              tuneId={String(itemId)}
                              value={item.scheduled ?? ""}
                              triggerLabel={scheduledDisplay?.label}
                              triggerTextClass={
                                scheduledDisplay
                                  ? `text-sm font-medium ${scheduledDisplay.colorClass}`
                                  : undefined
                              }
                              onChange={(newValue) => {
                                props.cellCallbacks?.onScheduledChange?.(
                                  String(itemId),
                                  newValue
                                );
                              }}
                            />
                          </Show>
                        </div>
                      </Show>

                      <Show
                        when={
                          props.tablePurpose === "scheduled" &&
                          isColVisible("evaluation")
                        }
                      >
                        <Show
                          when={item.completed_at}
                          fallback={
                            /* biome-ignore lint/a11y/noStaticElementInteractions: stop-propagation wrapper to prevent row selection when interacting with dropdown */
                            /* biome-ignore lint/a11y/useKeyWithClickEvents: stop-propagation wrapper only; keyboard events are handled by the contained combobox */
                            <div
                              class="ml-auto w-40 flex-shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <RecallEvalComboBox
                                tuneId={String(itemId)}
                                value={item.recall_eval ?? ""}
                                open={props.cellCallbacks?.getRecallEvalOpen?.(
                                  String(itemId)
                                )}
                                onOpenChange={(isOpen) =>
                                  props.cellCallbacks?.setRecallEvalOpen?.(
                                    String(itemId),
                                    isOpen
                                  )
                                }
                                onChange={(val) => {
                                  props.cellCallbacks?.onRecallEvalChange?.(
                                    String(itemId),
                                    val
                                  );
                                }}
                              />
                            </div>
                          }
                        >
                          {/* Tune already submitted: show static evaluation text */}
                          {(() => {
                            let label = "(Not Set)";
                            let colorClass = "text-gray-600 dark:text-gray-400";
                            if (
                              item.latest_quality !== null &&
                              item.latest_quality !== undefined
                            ) {
                              const quality = item.latest_quality;
                              const technique = item.latest_technique || "fsrs";
                              if (technique === "sm2") {
                                const sm2Labels: Record<number, string> = {
                                  0: "Complete blackout",
                                  1: "Incorrect response",
                                  2: "Incorrect (easy to recall)",
                                  3: "Correct (serious difficulty)",
                                  4: "Correct (hesitation)",
                                  5: "Perfect response",
                                };
                                const sm2Colors: Record<number, string> = {
                                  0: "text-red-600 dark:text-red-400",
                                  1: "text-red-600 dark:text-red-400",
                                  2: "text-orange-600 dark:text-orange-400",
                                  3: "text-yellow-600 dark:text-yellow-400",
                                  4: "text-green-600 dark:text-green-400",
                                  5: "text-blue-600 dark:text-blue-400",
                                };
                                label =
                                  sm2Labels[quality] || `Quality ${quality}`;
                                colorClass = sm2Colors[quality] || colorClass;
                              } else {
                                const fsrsLabels: Record<number, string> = {
                                  1: "Again",
                                  2: "Hard",
                                  3: "Good",
                                  4: "Easy",
                                };
                                const fsrsColors: Record<number, string> = {
                                  1: "text-red-600 dark:text-red-400",
                                  2: "text-orange-600 dark:text-orange-400",
                                  3: "text-green-600 dark:text-green-400",
                                  4: "text-blue-600 dark:text-blue-400",
                                };
                                label =
                                  fsrsLabels[quality] || `Quality ${quality}`;
                                colorClass = fsrsColors[quality] || colorClass;
                              }
                            } else if (item.recall_eval) {
                              const evalDisplay = getRecallEvalDisplay(
                                item.recall_eval
                              );
                              if (evalDisplay) {
                                label = evalDisplay.label;
                                colorClass = evalDisplay.colorClass;
                              }
                            }
                            return (
                              <span
                                class={`ml-auto text-sm italic font-medium ${colorClass}`}
                              >
                                {label}
                              </span>
                            );
                          })()}
                        </Show>
                      </Show>
                    </div>

                    {/* Row 3: Purpose-specific secondary info */}
                    <Show when={metadataEntries().length > 0}>
                      <div class="mt-1 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-3 gap-y-0.5">
                        <For each={metadataEntries()}>{(entry) => entry}</For>
                      </div>
                    </Show>
                  </div>
                </div>
              </li>
            );
          }}
        </For>
      </ul>
    </div>
  );
};
