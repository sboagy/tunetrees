import { describe, expect, it } from "vitest";
import { buildDefaultTuneSetName } from "./name";

describe("buildDefaultTuneSetName", () => {
  it("joins selected tune titles in order", () => {
    expect(
      buildDefaultTuneSetName([
        "Ballydesmond 1",
        "Music in the Glen",
        "Broken Pledge",
      ])
    ).toBe("Ballydesmond 1 / Music in the Glen / Broken Pledge");
  });

  it("ignores blank titles", () => {
    expect(
      buildDefaultTuneSetName([" Ballydesmond 1 ", "", "  ", "Broken Pledge"])
    ).toBe("Ballydesmond 1 / Broken Pledge");
  });

  it("falls back when there are no usable titles", () => {
    expect(buildDefaultTuneSetName([])).toBe("Untitled Tune Set");
    expect(buildDefaultTuneSetName(["", "  "])).toBe("Untitled Tune Set");
  });
});
