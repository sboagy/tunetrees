import { describe, expect, it } from "vitest";
import {
  getDefaultTableState,
  mergeWithDefaults,
} from "@/components/grids/table-state-persistence";

describe("getDefaultTableState", () => {
  it("keeps core workflow columns visible in the repertoire grid", () => {
    const state = getDefaultTableState("repertoire");

    expect(state.columnVisibility).toMatchObject({
      select: true,
      type: true,
      goal: true,
      genre: true,
      latest_practiced: true,
      latest_due: true,
    });
  });

  it("keeps selection and type visible in the catalog grid", () => {
    const state = getDefaultTableState("catalog");

    expect(state.columnVisibility).toMatchObject({
      select: true,
      type: true,
      composer: true,
    });
  });

  it("keeps the goal column visible in the scheduled grid", () => {
    const state = getDefaultTableState("scheduled");

    expect(state.columnVisibility).toMatchObject({
      bucket: true,
      evaluation: true,
      goal: true,
      scheduled: true,
      latest_practiced: true,
    });
  });

  it("defaults to viewport-driven layout mode selection", () => {
    const state = getDefaultTableState("catalog");

    expect(state.viewMode).toBeUndefined();
  });

  it("preserves a saved layout override when merging defaults", () => {
    const state = mergeWithDefaults(
      {
        viewMode: "list",
        columnVisibility: {},
      },
      "repertoire"
    );

    expect(state.viewMode).toBe("list");
  });
});
