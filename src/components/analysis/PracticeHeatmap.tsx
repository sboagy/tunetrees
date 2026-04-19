/**
 * Practice Heatmap
 *
 * Calendar heatmap showing daily practice sessions over the last 365 days.
 * Built with SolidJS <For> loops + @kobalte/core Tooltip (via shadcn-solid).
 *
 * @module components/analysis/PracticeHeatmap
 */

import { type Component, createResource, For, Match, Switch } from "solid-js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDb } from "@/lib/db/client-sqlite";
import {
  getPracticeHistory,
  type PracticeDay,
} from "@/lib/db/queries/analysis";

interface Props {
  repertoireId: string;
}

/** Build a 365-element array of cells, filling gaps with count=0. */
function buildGrid(data: PracticeDay[]): Array<{ day: string; count: number }> {
  const map = new Map(data.map((d) => [d.day, d.count]));
  const today = new Date();
  const cells: Array<{ day: string; count: number }> = [];

  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    cells.push({ day: key, count: map.get(key) ?? 0 });
  }

  return cells;
}

/** Map session count to an explicit background colour (avoids Tailwind JIT issues
 *  with dynamically-constructed class strings in a dense grid). */
function countToColor(count: number): string {
  if (count === 0) return "hsl(var(--muted))";
  if (count <= 2) return "hsl(var(--primary) / 0.25)";
  if (count <= 5) return "hsl(var(--primary) / 0.50)";
  if (count <= 10) return "hsl(var(--primary) / 0.75)";
  return "hsl(var(--primary))";
}

/** Format YYYY-MM-DD for display. */
function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-");
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const PracticeHeatmap: Component<Props> = (props) => {
  const [history] = createResource(
    () => props.repertoireId,
    async (rid) => {
      const db = getDb();
      return await getPracticeHistory(db, rid);
    }
  );

  const grid = () => buildGrid(history() ?? []);

  const totalSessions = () =>
    (history() ?? []).reduce((sum, d) => sum + d.count, 0);

  return (
    <Card data-testid="practice-heatmap">
      <CardHeader class="pb-2">
        <CardTitle class="text-base font-semibold">
          Practice Frequency
        </CardTitle>
        <CardDescription>
          {totalSessions()} sessions in the last 365 days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Switch>
          <Match when={history.loading}>
            <div class="flex h-24 items-center justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          </Match>
          <Match when={history.error}>
            <div class="flex h-24 items-center justify-center text-sm text-destructive">
              Failed to load data
            </div>
          </Match>
          <Match when={!history.loading}>
            <div class="overflow-x-auto">
              {/* 53 columns × 7 rows = 371 cells (≥ 365).
                  Fixed 10px tracks match the h-2.5/w-2.5 cell size.
                  1fr rows require a definite container height (which
                  we don't have here), so they collapse to 0 — fixed
                  pixel tracks avoid that. */}
              <div
                class="grid gap-[2px]"
                style={{
                  "grid-template-columns": "repeat(53, 10px)",
                  "grid-template-rows": "repeat(7, 10px)",
                  "grid-auto-flow": "column",
                }}
                role="img"
                aria-label="Practice activity heatmap"
              >
                <For each={grid()}>
                  {(cell) => (
                    <div
                      title={`${formatDay(cell.day)}: ${cell.count === 0 ? "No sessions" : `${cell.count} session${cell.count !== 1 ? "s" : ""}`}`}
                      style={{
                        width: "10px",
                        height: "10px",
                        "border-radius": "2px",
                        background: countToColor(cell.count),
                        cursor: "default",
                      }}
                    />
                  )}
                </For>
              </div>

              {/* Legend */}
              <div class="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <span>Less</span>
                {(["0", "0.25", "0.50", "0.75", "1"] as const).map((op) => (
                  <div
                    style={{
                      width: "10px",
                      height: "10px",
                      "border-radius": "2px",
                      background:
                        op === "0"
                          ? "hsl(var(--muted))"
                          : `hsl(var(--primary) / ${op})`,
                    }}
                  />
                ))}
                <span>More</span>
              </div>
            </div>
          </Match>
        </Switch>
      </CardContent>
    </Card>
  );
};
