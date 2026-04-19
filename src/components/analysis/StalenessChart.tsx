/**
 * Staleness Chart
 *
 * Bar chart showing tunes bucketed by how many days overdue they are.
 * Each bar is clickable and opens a Popover listing the overdue tunes.
 *
 * @module components/analysis/StalenessChart
 */

import { type Component, createResource, For, Match, Switch } from "solid-js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart } from "@/components/ui/charts";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getDb } from "@/lib/db/client-sqlite";
import {
  getStalenessData,
  type StalenessBucket,
} from "@/lib/db/queries/analysis";

interface Props {
  repertoireId: string;
}

export const StalenessChart: Component<Props> = (props) => {
  const [buckets] = createResource(
    () => props.repertoireId,
    async (rid) => {
      const db = getDb();
      return await getStalenessData(db, rid);
    }
  );

  const chartData = () => {
    const data = buckets();
    if (!data) return null;
    return {
      labels: data.map((b) => b.label),
      datasets: [
        {
          label: "Overdue tunes",
          data: data.map((b) => b.count),
          backgroundColor: [
            "hsla(38, 92%, 50%, 0.8)", // 1 day — amber
            "hsla(25, 95%, 53%, 0.8)", // 2-7 days — orange
            "hsla(0, 84%, 60%, 0.8)", // 8-30 days — red
            "hsla(0, 72%, 51%, 0.85)", // 31-90 days — darker red
            "hsla(0, 63%, 31%, 0.9)", // >90 days — deep red
          ],
          borderRadius: 4,
        },
      ],
    };
  };

  const totalOverdue = () =>
    buckets()?.reduce((sum, b) => sum + b.count, 0) ?? 0;

  return (
    <Card data-testid="staleness-chart">
      <CardHeader class="pb-2">
        <CardTitle class="text-base font-semibold">
          Staleness Factor{" "}
          <Switch>
            <Match when={totalOverdue() > 0}>
              <span class="ml-1 text-sm font-normal text-muted-foreground">
                ({totalOverdue()} overdue)
              </span>
            </Match>
          </Switch>
        </CardTitle>
        <CardDescription>
          Tunes grouped by how many days past their due date
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Switch>
          <Match when={buckets.loading}>
            <div class="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          </Match>
          <Match when={buckets.error}>
            <div class="flex h-48 items-center justify-center text-sm text-destructive">
              Failed to load data
            </div>
          </Match>
          <Match when={totalOverdue() === 0 && !buckets.loading}>
            <div class="flex h-48 flex-col items-center justify-center gap-1 text-center text-sm text-muted-foreground">
              <span>🎉 No overdue tunes!</span>
              <span class="text-xs">All your tunes are up to date</span>
            </div>
          </Match>
          {/* Use when={chartData()} so the callback accessor returns the actual
              chart data object, not a boolean from the && expression. The zero-
              tunes case is already handled by the Match above. */}
          <Match when={chartData()}>
            {(data) => (
              <div class="space-y-3">
                {/* Chart */}
                <div class="relative h-40 w-full">
                  <BarChart
                    data={data()}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        x: {
                          border: { display: false },
                          grid: { display: false },
                          ticks: { font: { size: 11 } },
                        },
                        y: {
                          border: { display: false },
                          ticks: {
                            stepSize: 1,
                            font: { size: 11 },
                          },
                          grid: { color: "hsla(240, 3.8%, 46.1%, 0.3)" },
                        },
                      },
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          enabled: true,
                          callbacks: {
                            label: (ctx) =>
                              ` ${ctx.parsed.y} tune${ctx.parsed.y !== 1 ? "s" : ""}`,
                          },
                        },
                      },
                    }}
                  />
                </div>

                {/* Popover detail rows */}
                <div class="flex flex-wrap gap-1">
                  <For each={buckets()?.filter((b) => b.count > 0)}>
                    {(bucket: StalenessBucket) => (
                      <Popover>
                        <PopoverTrigger
                          as="button"
                          class="rounded border border-border bg-muted px-2 py-0.5 text-xs hover:bg-accent"
                        >
                          {bucket.label}: {bucket.count}
                        </PopoverTrigger>
                        <PopoverContent class="max-h-40 overflow-y-auto">
                          <p class="mb-1 font-semibold text-xs">
                            {bucket.label} overdue
                          </p>
                          <ul class="space-y-0.5">
                            <For each={bucket.tunes}>
                              {(title: string) => (
                                <li class="text-xs text-muted-foreground">
                                  {title}
                                </li>
                              )}
                            </For>
                          </ul>
                        </PopoverContent>
                      </Popover>
                    )}
                  </For>
                </div>
              </div>
            )}
          </Match>
        </Switch>
      </CardContent>
    </Card>
  );
};
