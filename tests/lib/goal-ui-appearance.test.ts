import { describe, expect, it } from "vitest";
import { getChartScaleNames } from "../../src/components/ui/charts";
import { goalIdentityColors } from "../../src/lib/goal-colors";

describe("goal identity colors", () => {
  it.each(["constructor", "toString", "__proto__"])(
    "assigns a palette to the custom name %s",
    (name) => {
      expect(goalIdentityColors(name)).toMatch(
        /^bg-\w+-100 dark:bg-\w+-900 text-\w+-800 dark:text-\w+-200$/
      );
    }
  );
});

describe("chart theme scale selection", () => {
  it("preserves explicit custom dataset axes without adding x/y", () => {
    expect(
      getChartScaleNames(
        "line",
        {
          datasets: [
            { data: [1, 2], xAxisID: "horizontal", yAxisID: "vertical" },
          ],
        },
        { horizontal: { axis: "x" }, vertical: { axis: "y" } }
      )
    ).toEqual(["horizontal", "vertical"]);
  });

  it("uses configured axes when datasets omit explicit bindings", () => {
    expect(
      getChartScaleNames(
        "line",
        { datasets: [{ data: [1] }] },
        {
          horizontal: { axis: "x" },
          vertical: { axis: "y" },
        }
      )
    ).toEqual(["horizontal", "vertical"]);
  });

  it("includes automatic axes for ordinary line charts", () => {
    expect(
      getChartScaleNames("line", { datasets: [{ data: [1] }] }, {})
    ).toEqual(["x", "y"]);
  });

  it("does not introduce cartesian scales into a pie chart", () => {
    expect(
      getChartScaleNames("pie", { datasets: [{ data: [1] }] }, {})
    ).toEqual([]);
  });
});
