/**
 * Repertoire Coverage Chart
 *
 * Donut chart showing the breakdown of tunes in the user's repertoire by type
 * (Reel, Jig, Hornpipe, etc.).
 *
 * @module components/analysis/RepertoireCoverageChart
 */

import { type Component, createResource, For, Match, Switch } from "solid-js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DonutChart } from "@/components/ui/charts";
import { getDb } from "@/lib/db/client-sqlite";
import { getRepertoireCoverage } from "@/lib/db/queries/analysis";

interface Props {
  repertoireId: string;
}

/** Tailwind-compatible colour palette for donut slices (up to 12 slices). */
const SLICE_COLORS = [
  "hsla(221, 83%, 53%, 0.85)",
  "hsla(142, 71%, 45%, 0.85)",
  "hsla(38,  92%, 50%, 0.85)",
  "hsla(0,   84%, 60%, 0.85)",
  "hsla(271, 91%, 65%, 0.85)",
  "hsla(181, 60%, 48%, 0.85)",
  "hsla(330, 80%, 55%, 0.85)",
  "hsla(25,  95%, 53%, 0.85)",
  "hsla(200, 80%, 50%, 0.85)",
  "hsla(60,  90%, 45%, 0.85)",
  "hsla(280, 70%, 55%, 0.85)",
  "hsla(100, 65%, 45%, 0.85)",
];

export const RepertoireCoverageChart: Component<Props> = (props) => {
  const [coverage] = createResource(
    () => props.repertoireId,
    async (rid) => {
      const db = getDb();
      return await getRepertoireCoverage(db, rid);
    }
  );

  const totalTunes = () =>
    (coverage() ?? []).reduce((sum, s) => sum + s.count, 0);

  const chartData = () => {
    const data = coverage();
    if (!data || data.length === 0) return null;
    return {
      labels: data.map((s) => s.type),
      datasets: [
        {
          data: data.map((s) => s.count),
          backgroundColor: data.map(
            (_, i) => SLICE_COLORS[i % SLICE_COLORS.length]
          ),
          borderWidth: 1,
          borderColor: "hsl(var(--background, 0 0% 100%))",
        },
      ],
    };
  };

  return (
    <Card data-testid="repertoire-coverage-chart">
      <CardHeader class="pb-2">
        <CardTitle class="text-base font-semibold">
          Repertoire Coverage
        </CardTitle>
        <CardDescription>
          {totalTunes()} tunes by type in your repertoire
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Switch>
          <Match when={coverage.loading}>
            <div class="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          </Match>
          <Match when={coverage.error}>
            <div class="flex h-48 items-center justify-center text-sm text-destructive">
              Failed to load data
            </div>
          </Match>
          <Match when={!coverage.loading && totalTunes() === 0}>
            <div class="flex h-48 flex-col items-center justify-center gap-1 text-center text-sm text-muted-foreground">
              <span>No tunes in repertoire yet</span>
              <span class="text-xs">Add tunes from the Catalog tab</span>
            </div>
          </Match>
          <Match when={chartData()}>
            {(data) => (
              <div class="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                {/* Donut */}
                <div class="relative h-40 w-40 flex-shrink-0">
                  {/* Total label in the centre */}
                  <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span class="text-2xl font-bold">{totalTunes()}</span>
                    <span class="text-xs text-muted-foreground">tunes</span>
                  </div>
                  <DonutChart
                    data={data()}
                    options={
                      {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: "65%",
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            enabled: true,
                            callbacks: {
                              label: (ctx) =>
                                ` ${ctx.label}: ${ctx.parsed} tune${ctx.parsed !== 1 ? "s" : ""}`,
                            },
                          },
                        },
                      } as import("chart.js").ChartOptions<"doughnut">
                    }
                  />
                </div>

                {/* Legend */}
                <ul class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs sm:flex-col">
                  <For each={coverage()}>
                    {(slice, i) => (
                      <li class="flex items-center gap-1.5">
                        <span
                          class="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                          style={{
                            background: SLICE_COLORS[i() % SLICE_COLORS.length],
                          }}
                        />
                        <span class="text-muted-foreground">{slice.type}</span>
                        <span class="font-medium">{slice.count}</span>
                      </li>
                    )}
                  </For>
                </ul>
              </div>
            )}
          </Match>
        </Switch>
      </CardContent>
    </Card>
  );
};
