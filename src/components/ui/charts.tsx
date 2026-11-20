/**
 * Charts Component
 *
 * Chart.js wrappers for SolidJS, ported from solid-ui
 * (https://www.solid-ui.com/docs/components/charts).
 *
 * Available chart types:
 * - BarChart, BubbleChart, DonutChart, LineChart, PieChart,
 *   PolarAreaChart, RadarChart, ScatterChart
 *
 * @module components/ui/charts
 */

import type { Ref } from "@solid-primitives/refs";
import { mergeRefs } from "@solid-primitives/refs";
import type {
  ChartComponent,
  ChartData,
  ChartOptions,
  Plugin as ChartPlugin,
  ChartType,
  ChartTypeRegistry,
  TooltipModel,
} from "chart.js";
import {
  ArcElement,
  BarController,
  BarElement,
  BubbleController,
  CategoryScale,
  Chart,
  Colors,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  PointElement,
  PolarAreaController,
  RadarController,
  RadialLinearScale,
  ScatterController,
  Tooltip,
} from "chart.js";
import type { Component } from "solid-js";
import {
  createEffect,
  createSignal,
  mergeProps,
  on,
  onCleanup,
  onMount,
} from "solid-js";
import { unwrap } from "solid-js/store";

type TypedChartProps = {
  data: ChartData;
  options?: ChartOptions;
  plugins?: ChartPlugin[];
  ref?: Ref<HTMLCanvasElement | null>;
  width?: number;
  height?: number;
};

type ChartProps = TypedChartProps & {
  type: ChartType;
};

type ChartContext = {
  chart: Chart;
  tooltip: TooltipModel<keyof ChartTypeRegistry>;
};

/** Theme only scales the chart uses; custom axis bindings must not gain extra axes. */
export function getChartScaleNames(
  type: ChartType,
  data: ChartData,
  scales: NonNullable<ChartOptions["scales"]>
): string[] {
  const names = new Set(Object.keys(scales));
  if (!["bar", "line", "scatter", "bubble"].includes(type)) return [...names];
  const defaultAxis = (axis: "x" | "y") =>
    Object.keys(scales).find((name) => {
      const scale = scales[name];
      if (scale && "axis" in scale && scale.axis) return scale.axis === axis;
      return name.startsWith(axis);
    }) ?? axis;
  for (const dataset of data.datasets) {
    const x = "xAxisID" in dataset ? dataset.xAxisID : undefined;
    const y = "yAxisID" in dataset ? dataset.yAxisID : undefined;
    names.add(typeof x === "string" ? x : defaultAxis("x"));
    names.add(typeof y === "string" ? y : defaultAxis("y"));
  }
  return [...names];
}

const BaseChart: Component<ChartProps> = (rawProps) => {
  const [canvasRef, setCanvasRef] = createSignal<HTMLCanvasElement | null>(
    null
  );
  const [chart, setChart] = createSignal<Chart | undefined>(undefined);

  const props = mergeProps(
    {
      width: 512,
      height: 512,
      options: { responsive: true } satisfies ChartOptions,
      plugins: [] satisfies ChartPlugin[],
    },
    rawProps
  );
  const setRefs = mergeRefs(props.ref, (el) => setCanvasRef(el));
  const motion = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
  const themedOptions = (): ChartOptions => {
    const options: ChartOptions = props.options;
    const canvas = canvasRef();
    const color = canvas ? getComputedStyle(canvas).color : undefined;
    const legend = options.plugins?.legend;
    const scales = options.scales ?? {};
    const scaleNames = getChartScaleNames(props.type, props.data, scales);
    return {
      ...options,
      color,
      animation: motion.matches ? false : options.animation,
      scales: Object.fromEntries(
        scaleNames.map((name) => [
          name,
          { ...scales[name], ticks: { ...scales[name]?.ticks, color } },
        ])
      ),
      plugins: {
        ...options.plugins,
        legend: {
          ...legend,
          labels: { ...legend?.labels, color },
        },
      },
    };
  };
  const refreshAppearance = () => {
    const current = chart();
    if (!current) return;
    current.options = themedOptions();
    current.update("none");
  };

  const init = () => {
    const canvas = canvasRef();
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const config = unwrap(props);
    const instance = new Chart(ctx, {
      type: config.type,
      data: config.data,
      options: themedOptions(),
      plugins: config.plugins,
    });
    setChart(instance);
  };

  onMount(() => {
    init();
    // Canvas pixels do not inherit later theme changes like ordinary text does.
    const observer = new MutationObserver(refreshAppearance);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    motion.addEventListener("change", refreshAppearance);
    onCleanup(() => {
      observer.disconnect();
      motion.removeEventListener("change", refreshAppearance);
    });
  });

  createEffect(
    on(
      () => props.data,
      () => {
        const c = chart();
        if (!c) return;
        c.data = props.data;
        c.update();
      },
      { defer: true }
    )
  );

  createEffect(
    on(
      () => props.options,
      () => {
        const c = chart();
        if (!c) return;
        c.options = themedOptions();
        c.update();
      },
      { defer: true }
    )
  );

  createEffect(
    on(
      [() => props.width, () => props.height],
      () => {
        chart()?.resize(props.width, props.height);
      },
      { defer: true }
    )
  );

  createEffect(
    on(
      () => props.type,
      () => {
        const c = chart();
        if (!c) return;
        const dimensions: [number, number] = [c.width, c.height];
        c.destroy();
        init();
        chart()?.resize(...dimensions);
      },
      { defer: true }
    )
  );

  onCleanup(() => {
    chart()?.destroy();
    setRefs(null);
  });

  Chart.register(Colors, Filler, Legend, Tooltip);

  return <canvas ref={setRefs} height={props.height} width={props.width} />;
};

function showTooltip(context: ChartContext) {
  let el = document.getElementById("chartjs-tooltip");
  if (!el) {
    el = document.createElement("div");
    el.id = "chartjs-tooltip";
    document.body.appendChild(el);
  }

  const model = context.tooltip;
  if (model.opacity === 0 || !model.body) {
    el.style.opacity = "0";
    return;
  }

  el.className = `p-2 bg-card text-card-foreground rounded-lg border shadow-sm text-sm ${
    model.yAlign ?? "no-transform"
  }`;

  const children: Node[] = [];

  model.title.forEach((title) => {
    const titleEl = document.createElement("h3");
    titleEl.className = "font-semibold leading-none tracking-tight";
    titleEl.textContent = title;
    children.push(titleEl);
  });

  const bodyContainer = document.createElement("div");
  bodyContainer.className = "mt-1 text-muted-foreground";

  const body = model.body.flatMap((b) => b.lines);
  body.forEach((line, i) => {
    const row = document.createElement("div");
    row.className = "flex items-center";

    const indicator = document.createElement("span");
    indicator.className = "inline-block h-2 w-2 mr-1 rounded-full border";

    const colors = model.labelColors[i];
    if (colors) {
      if (typeof colors.backgroundColor === "string") {
        indicator.style.backgroundColor = colors.backgroundColor;
      }
      if (typeof colors.borderColor === "string") {
        indicator.style.borderColor = colors.borderColor;
      }
    }

    row.appendChild(indicator);
    row.appendChild(document.createTextNode(line));
    bodyContainer.appendChild(row);
  });

  children.push(bodyContainer);
  el.replaceChildren(...children);

  const pos = context.chart.canvas.getBoundingClientRect();
  el.style.opacity = "1";
  el.style.position = "absolute";
  el.style.left = `${pos.left + window.scrollX + model.caretX}px`;
  el.style.top = `${pos.top + window.scrollY + model.caretY}px`;
  el.style.pointerEvents = "none";
}

function createTypedChart(
  type: ChartType,
  components: ChartComponent[]
): Component<TypedChartProps> {
  const chartsWithScales: ChartType[] = ["bar", "line", "scatter"];
  const chartsWithLegends: ChartType[] = ["bar", "line"];

  const options: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: chartsWithScales.includes(type)
      ? {
          x: {
            border: { display: false },
            grid: { display: false },
          },
          y: {
            border: {
              dash: [3],
              dashOffset: 3,
              display: false,
            },
            grid: {
              color: "hsla(240, 3.8%, 46.1%, 0.4)",
            },
          },
        }
      : {},
    plugins: {
      legend: chartsWithLegends.includes(type)
        ? {
            display: true,
            align: "end",
            labels: {
              usePointStyle: true,
              boxWidth: 6,
              boxHeight: 6,
              color: "hsl(240, 3.8%, 46.1%)",
              font: { size: 14 },
            },
          }
        : { display: false },
      tooltip: {
        enabled: false,
        external: (context) => showTooltip(context),
      },
    },
  };

  Chart.register(...components);
  return (props) => <BaseChart type={type} options={options} {...props} />;
}

const BarChart = /* #__PURE__ */ createTypedChart("bar", [
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
]);

const BubbleChart = /* #__PURE__ */ createTypedChart("bubble", [
  BubbleController,
  PointElement,
  LinearScale,
]);

const DonutChart = /* #__PURE__ */ createTypedChart("doughnut", [
  DoughnutController,
  ArcElement,
]);

const LineChart = /* #__PURE__ */ createTypedChart("line", [
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
]);

const PieChart = /* #__PURE__ */ createTypedChart("pie", [
  PieController,
  ArcElement,
]);

const PolarAreaChart = /* #__PURE__ */ createTypedChart("polarArea", [
  PolarAreaController,
  ArcElement,
  RadialLinearScale,
]);

const RadarChart = /* #__PURE__ */ createTypedChart("radar", [
  RadarController,
  LineElement,
  PointElement,
  RadialLinearScale,
]);

const ScatterChart = /* #__PURE__ */ createTypedChart("scatter", [
  ScatterController,
  PointElement,
  LinearScale,
]);

export {
  BarChart,
  BaseChart as Chart,
  BubbleChart,
  DonutChart,
  LineChart,
  PieChart,
  PolarAreaChart,
  RadarChart,
  ScatterChart,
};
