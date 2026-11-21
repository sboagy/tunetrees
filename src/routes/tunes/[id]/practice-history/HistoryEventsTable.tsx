import { createTable, flexRender } from "@tanstack/solid-table";
import { ChevronDown, Trash2 } from "lucide-solid";
import { createMemo, createSignal, For, Show } from "solid-js";
import {
  type ColumnDef,
  gridTableFeatures,
} from "@/components/grids/tanstack-table";
import { Button } from "@/components/ui/button";
import { BarChart, LineChart } from "@/components/ui/charts";
import type { HistoryEvent } from "@/lib/goals/practice-history";
import {
  historyStabilitySeries,
  summarizeHistoryEvents,
} from "@/lib/goals/practice-history";
import {
  formatPracticeHistoryDate,
  getPracticeHistoryStateLabel,
} from "./practice-history-utils";

const numericColumns = new Set([
  "interval",
  "stability",
  "difficulty",
  "reps",
  "lapses",
  "ladder",
]);

/** The same chronological event table is available at every viewport width.
 * Filtering affects presentation only; episode identities were computed upstream. */
export function HistoryEventsTable(props: {
  events: HistoryEvent[];
  goalKey: string;
  onGoalChange: (key: string) => void;
  deletingIds: Set<string>;
  onDelete: (id: string) => void;
}) {
  const [expandedIds, setExpandedIds] = createSignal<ReadonlySet<string>>(
    new Set()
  );
  const toggleDetails = (id: string) =>
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const goalKey = () => props.goalKey;
  const setGoalKey = (key: string) => props.onGoalChange(key);
  const options = createMemo(() => {
    const labels = new Map<string, string>();
    for (const event of props.events) {
      if (!labels.has(event.goalKey))
        labels.set(event.goalKey, event.goalLabel);
    }
    const names = [...labels.values()];
    return [...labels].map(([key, label], index) => ({
      key,
      label:
        names.filter((name) => name === label).length > 1
          ? `${label} (${index + 1})`
          : label,
    }));
  });
  const events = createMemo(() =>
    props.events.filter((event) => !goalKey() || event.goalKey === goalKey())
  );
  const summary = createMemo(() => summarizeHistoryEvents(events()));
  const stability = createMemo(() => {
    const data = historyStabilitySeries(events());
    return {
      labels: data.records.map((record) =>
        formatPracticeHistoryDate(record.practiced)
      ),
      datasets: data.series.map((series) => ({
        label: `State sequence ${series.episode}`,
        data: series.points,
        spanGaps: false,
        tension: 0,
      })),
    };
  });
  const ratings = createMemo(() => {
    const chronological = [...events()].reverse();
    return {
      labels: chronological.map((event) =>
        formatPracticeHistoryDate(event.record.practiced)
      ),
      datasets: [
        {
          label: "FSRS rating",
          data: chronological.map((event) => event.rating),
        },
      ],
    };
  });
  const columns: ColumnDef<HistoryEvent>[] = [
    {
      id: "practiced",
      header: "Date practiced",
      cell: (context) =>
        formatPracticeHistoryDate(context.row.original.record.practiced),
    },
    {
      id: "goal",
      header: "Goal",
      cell: (context) => context.row.original.goalLabel,
    },
    {
      id: "evaluation",
      header: "Evaluation",
      cell: (context) => (
        <span title={context.row.original.description}>
          {context.row.original.evaluationLabel}
        </span>
      ),
    },
    {
      id: "due",
      header: "Recorded due date",
      cell: (context) =>
        formatPracticeHistoryDate(context.row.original.record.due),
    },
    {
      id: "interval",
      header: "Interval (days)",
      cell: (context) =>
        context.row.original.intervalDays?.toLocaleString(undefined, {
          maximumFractionDigits: 6,
        }) ?? "Not available",
    },
    {
      id: "details",
      header: "Scheduler details",
      cell: (context) => (
        <Button
          variant="ghost"
          class="min-h-11 gap-1"
          aria-expanded={expandedIds().has(context.row.id)}
          aria-controls={`history-details-${context.row.id}`}
          onClick={() => toggleDetails(context.row.id)}
        >
          <ChevronDown class="size-4" aria-hidden="true" /> Details
        </Button>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: (context) => (
        <Button
          type="button"
          variant="destructive-ghost"
          class="min-h-11"
          disabled={props.deletingIds.has(context.row.original.record.id)}
          onClick={() => props.onDelete(context.row.original.record.id)}
        >
          <Trash2 class="size-4" aria-hidden="true" /> Delete entry
        </Button>
      ),
    },
  ];
  const visibleColumns = createMemo(() => {
    if (!goalKey() || !events().length) return columns;
    const extra: ColumnDef<HistoryEvent>[] = [];
    if (events().some((event) => event.state.kind === "fsrs6")) {
      for (const [key, label] of [
        ["stability", "Stability"],
        ["difficulty", "Difficulty"],
        ["reps", "Reps"],
        ["lapses", "Lapses"],
        ["status", "State"],
      ] as const) {
        extra.push({
          id: key,
          header: label,
          cell: (context) => {
            const state = context.row.original.state;
            if (state.kind !== "fsrs6") return "Not available";
            return key === "status"
              ? getPracticeHistoryStateLabel(state.state.status)
              : state.state[key].toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                });
          },
        });
      }
    }
    if (events().some((event) => event.state.kind === "ladder")) {
      extra.push({
        id: "ladder",
        header: "Ladder position",
        cell: (context) => {
          const state = context.row.original.state;
          return state.kind === "ladder"
            ? state.state.ladderIndex + 1
            : "Not available";
        },
      });
    }
    return [...columns.slice(0, 5), ...extra, ...columns.slice(5)];
  });
  const table = createTable({
    features: gridTableFeatures,
    get data() {
      return events();
    },
    get columns() {
      return visibleColumns();
    },
    getRowId: (event) => event.record.id,
  });
  return (
    <section class="space-y-4 text-foreground" aria-label="Practice events">
      <div class="flex flex-wrap items-end gap-4">
        <label class="grid min-w-0 max-w-full gap-1 text-sm">
          <span>Goal</span>
          <select
            class="min-h-11 max-w-full rounded-md border border-input bg-background px-3 text-foreground"
            value={goalKey()}
            onChange={(event) => setGoalKey(event.currentTarget.value)}
            data-testid="practice-history-goal-filter"
          >
            <option value="">All goals</option>
            <For each={options()}>
              {(option) => <option value={option.key}>{option.label}</option>}
            </For>
          </select>
        </label>
        <Show when={goalKey()}>
          <Button
            class="min-h-11"
            variant="ghost"
            onClick={() => setGoalKey("")}
          >
            Clear filters
          </Button>
        </Show>
        <output class="text-sm text-muted-foreground">
          {events().length} of {props.events.length} sessions
        </output>
      </div>
      <p class="text-sm text-muted-foreground">
        Recorded labels and due dates describe each submitted event. Filtering
        does not change this tune’s goal or schedule.
      </p>
      <section
        class="overflow-x-auto rounded-md border border-border"
        aria-label="Practice history table"
      >
        <table
          class="w-full text-sm"
          data-testid="practice-history-events-table"
        >
          <thead class="sticky top-0 bg-background">
            <For each={table.getHeaderGroups()}>
              {(group) => (
                <tr>
                  <For each={group.headers}>
                    {(header) => (
                      <th
                        scope="col"
                        class={`px-2 py-1.5 font-medium ${numericColumns.has(header.id) ? "text-right" : "text-left"}`}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </th>
                    )}
                  </For>
                </tr>
              )}
            </For>
          </thead>
          <tbody>
            <For each={table.getRowModel().rows}>
              {(row) => (
                <>
                  <tr
                    class="border-t border-border hover:bg-accent"
                    data-testid={`practice-history-event-${row.id}`}
                  >
                    <For each={row.getVisibleCells()}>
                      {(cell) => (
                        <td
                          class={`px-2 py-1.5 align-top ${numericColumns.has(cell.column.id) ? "text-right tabular-nums" : "text-left"}`}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      )}
                    </For>
                  </tr>
                  <Show when={expandedIds().has(row.id)}>
                    <tr
                      id={`history-details-${row.id}`}
                      class="border-t border-border bg-muted/30"
                    >
                      <td colSpan={row.getVisibleCells().length} class="p-4">
                        <EventDetails event={row.original} />
                      </td>
                    </tr>
                  </Show>
                </>
              )}
            </For>
          </tbody>
        </table>
        <Show when={!events().length}>
          <p class="p-4 text-sm text-muted-foreground">
            No practice events match this goal.
          </p>
        </Show>
      </section>
      <dl
        class="flex flex-wrap gap-6 text-sm"
        data-testid="practice-history-summary"
      >
        <div>
          <dt>Sessions in view</dt>
          <dd class="tabular-nums">{summary().totalSessions}</dd>
        </div>
        <Show when={goalKey()}>
          <div>
            <dt>Average known interval (days)</dt>
            <dd class="tabular-nums">
              {summary().averageInterval?.toLocaleString(undefined, {
                maximumFractionDigits: 3,
              }) ?? "Not available"}
            </dd>
          </div>
        </Show>
        <Show when={goalKey() && summary().successRate !== null}>
          <div>
            <dt>Good/Easy FSRS evaluations</dt>
            <dd>{summary().successRate}%</dd>
          </div>
          <div>
            <dt>Consecutive Good/Easy in latest state sequence</dt>
            <dd>{summary().currentStreak}</dd>
          </div>
        </Show>
      </dl>
      <div
        class="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2"
        data-testid="practice-history-analytics"
      >
        <Show when={goalKey() && summary().successRate !== null}>
          <section class="min-w-0" data-testid="practice-history-quality-chart">
            <h3 class="text-base font-semibold">FSRS rating trend</h3>
            <p class="text-sm text-muted-foreground">
              Recorded FSRS actions: 1 Again, 2 Hard, 3 Good, 4 Easy. Recorded
              evaluation labels remain in the table.
            </p>
            <div class="relative h-48 min-w-0" aria-hidden="true">
              <BarChart
                data={ratings()}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: { y: { min: 1, max: 4, ticks: { stepSize: 1 } } },
                }}
              />
            </div>
          </section>
        </Show>
        <Show when={goalKey() && stability().datasets.length}>
          <section
            class="min-w-0"
            data-testid="practice-history-stability-chart"
          >
            <h3 class="text-base font-semibold">FSRS stability (days)</h3>
            <p class="text-sm text-muted-foreground">
              Lines stop at goal changes and fresh starts. Each value is also
              available in event details.
            </p>
            <div class="relative h-48 min-w-0" aria-hidden="true">
              <LineChart
                data={stability()}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: { y: { beginAtZero: true } },
                }}
              />
            </div>
          </section>
        </Show>
      </div>
      <p class="text-sm text-muted-foreground">
        Scheduler metrics are available in each event’s details. Different goals
        and fresh starts are separate state sequences; unsupported values are
        never treated as zero.
      </p>
    </section>
  );
}

function EventDetails(props: { event: HistoryEvent }) {
  const details = createMemo(() => {
    const state = props.event.state;
    if (state.kind === "fsrs6")
      return [
        ["Scheduler", "FSRS-6"],
        ["Stability (days)", String(state.state.stability)],
        ["Difficulty", String(state.state.difficulty)],
        ["Repetitions", String(state.state.reps)],
        ["Lapses", String(state.state.lapses)],
        ["State", getPracticeHistoryStateLabel(state.state.status)],
      ];
    if (state.kind === "ladder")
      return [
        ["Scheduler", "Interval ladder"],
        ["Ladder position", String(state.state.ladderIndex + 1)],
        ["Recorded action", props.event.action ?? "Not available"],
      ];
    if (state.kind === "plugin")
      return [
        ["Scheduler", "Custom scheduler"],
        ["Plugin version", String(state.state.pluginVersion)],
        ["State version", String(state.state.stateVersion)],
      ];
    return [["Scheduler details", "Not available"]];
  });
  return (
    <section
      class="space-y-3"
      aria-label={`Details for ${formatPracticeHistoryDate(props.event.record.practiced)}`}
    >
      <dl class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
        <For
          each={[...details(), ["State sequence", String(props.event.episode)]]}
        >
          {([label, value]) => (
            <div>
              <dt class="text-muted-foreground">{label}</dt>
              <dd class="break-words tabular-nums">{value}</dd>
            </div>
          )}
        </For>
      </dl>
      <Show when={props.event.description}>
        <p>{props.event.description}</p>
      </Show>
      <Show when={props.event.legacy}>
        <p>Legacy event</p>
      </Show>
      <For each={props.event.notices}>
        {(notice) => <p class="text-muted-foreground">{notice}</p>}
      </For>
    </section>
  );
}
