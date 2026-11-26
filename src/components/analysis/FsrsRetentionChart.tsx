/**
 * FSRS Retention Chart
 *
 * Area chart showing an approximate forgetting curve for FSRS-reviewed tunes.
 * The current approximation uses stability but not elapsed time since review.
 *
 * @module components/analysis/FsrsRetentionChart
 */

import { type Component, createResource, For, Match, Switch } from "solid-js";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LineChart } from "@/components/ui/charts";
import { getDb } from "@/lib/db/client-sqlite";
import { getFsrsRetentionCurve } from "@/lib/db/queries/analysis";

interface Props {
  repertoireId: string;
}

export const FsrsRetentionChart: Component<Props> = (props) => {
  const [curve, { refetch }] = createResource(
    () => props.repertoireId,
    async (rid) => {
      const db = getDb();
      return await getFsrsRetentionCurve(db, rid);
    }
  );

  const chartData = () => {
    const data = curve();
    if (!data || data.length === 0) return null;
    return {
      labels: data.map((p) => (p.day % 10 === 0 ? `Day ${p.day}` : "")),
      datasets: [
        {
          label: "Estimated retention",
          data: data.map((p) => Math.round(p.retention * 100)),
          fill: true,
          tension: 0.4,
          borderColor: "hsl(221, 83%, 53%)",
          backgroundColor: "hsla(221, 83%, 53%, 0.15)",
          pointRadius: 0,
        },
      ],
    };
  };

  return (
    <Card data-testid="fsrs-retention-chart">
      <CardHeader class="pb-2">
        <CardTitle class="text-base font-semibold">
          FSRS retention estimate
        </CardTitle>
        <CardDescription>
          Approximate curve for FSRS-reviewed tunes, starting at review time.
          Excludes ladder/plugin events; does not account for time since
          practice.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Switch>
          <Match when={curve.loading}>
            <div class="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          </Match>
          <Match when={curve.error}>
            <div
              role="alert"
              class="flex min-h-48 flex-col items-center justify-center gap-3 text-sm text-destructive"
            >
              <p>Could not load the retention estimate.</p>
              <Button
                class="min-h-11"
                variant="outline"
                onClick={() => refetch()}
              >
                Retry
              </Button>
            </div>
          </Match>
          <Match when={chartData()}>
            {(data) => (
              <div>
                <div class="relative h-48 w-full" aria-hidden="true">
                  <LineChart
                    data={data()}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        x: {
                          border: { display: false },
                          grid: { display: false },
                          ticks: { maxTicksLimit: 7, font: { size: 11 } },
                        },
                        y: {
                          min: 0,
                          max: 100,
                          border: { display: false },
                          ticks: {
                            callback: (v) => `${v}%`,
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
                            label: (ctx) => ` ${ctx.parsed.y}% retention`,
                            title: (items) => `Day ${items[0]?.dataIndex ?? 0}`,
                          },
                        },
                      },
                    }}
                  />
                </div>
                <details class="mt-3 text-sm">
                  <summary class="min-h-11 cursor-pointer py-3">
                    View Retention Estimate Data
                  </summary>
                  <table class="w-full" data-testid="retention-estimate-data">
                    <caption class="text-left text-muted-foreground py-2">
                      The same approximation shown in the chart, by days after
                      review.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col" class="text-right p-2">
                          Days after review
                        </th>
                        <th scope="col" class="text-right p-2">
                          Estimated retention
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={curve() ?? []}>
                        {(point) => (
                          <tr class="border-t border-border">
                            <td class="p-2 text-right tabular-nums">
                              {point.day}
                            </td>
                            <td class="p-2 text-right tabular-nums">
                              {Math.round(point.retention * 100)}%
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </details>
              </div>
            )}
          </Match>
          <Match when={!curve.loading && !chartData()}>
            <div class="flex h-48 flex-col items-center justify-center gap-1 text-center text-sm text-muted-foreground">
              <span>No valid FSRS state for the latest reviews</span>
              <span class="text-sm">
                Only active tunes whose latest review has valid FSRS state
                contribute
              </span>
            </div>
          </Match>
        </Switch>
      </CardContent>
    </Card>
  );
};
