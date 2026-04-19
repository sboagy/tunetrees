/**
 * FSRS Retention Chart
 *
 * Area chart showing predicted average memory retention over the next 60 days
 * across all tunes in the repertoire, using the FSRS forgetting curve R(t,S)=0.9^(t/S).
 *
 * @module components/analysis/FsrsRetentionChart
 */

import { type Component, createResource, Match, Switch } from "solid-js";
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
  const [curve] = createResource(
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
          label: "Predicted Retention",
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
          FSRS Retention Curve
        </CardTitle>
        <CardDescription>
          Predicted average retention over the next 60 days
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
            <div class="flex h-48 items-center justify-center text-sm text-destructive">
              Failed to load data
            </div>
          </Match>
          <Match when={chartData()}>
            {(data) => (
              <div class="relative h-48 w-full">
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
            )}
          </Match>
          <Match when={!curve.loading && !chartData()}>
            <div class="flex h-48 flex-col items-center justify-center gap-1 text-center text-sm text-muted-foreground">
              <span>No FSRS data yet</span>
              <span class="text-xs">
                Practice some tunes with FSRS to see the curve
              </span>
            </div>
          </Match>
        </Switch>
      </CardContent>
    </Card>
  );
};
