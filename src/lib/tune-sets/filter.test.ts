import { describe, expect, it } from "vitest";
import { filterRowsBySelectedTuneIds } from "./filter";

describe("filterRowsBySelectedTuneIds", () => {
  const rows = [
    { id: "tune-1", title: "One" },
    { id: "tune-2", title: "Two" },
    { id: "tune-3", title: "Three" },
  ];

  it("returns all rows when no tune set is selected", () => {
    expect(filterRowsBySelectedTuneIds(rows)).toEqual(rows);
  });

  it("returns only rows included in the selected tune ids", () => {
    expect(filterRowsBySelectedTuneIds(rows, ["tune-1", "tune-3"])).toEqual([
      rows[0],
      rows[2],
    ]);
  });

  it("returns an empty array for an active empty tune set", () => {
    expect(filterRowsBySelectedTuneIds(rows, [])).toEqual([]);
  });
});
