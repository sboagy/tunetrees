import { describe, expect, it } from "vitest";
import {
  tuneTaskEntryState,
  tuneTaskOrigin,
  tuneTaskReturn,
  tuneTaskReturnState,
} from "../../src/lib/tune-task-navigation";

describe("tune task return navigation", () => {
  it("preserves the invoking list and its query", () => {
    expect(tuneTaskOrigin("/repertoire?search=reel", undefined, "tune")).toBe(
      "/repertoire?search=reel"
    );
  });
  it("keeps the origin when switching from History to Edit", () => {
    expect(
      tuneTaskOrigin(
        "/tunes/tune/practice-history",
        { from: "/?tab=practice" },
        "tune"
      )
    ).toBe("/?tab=practice");
  });
  it("rejects a circular legacy return destination", () => {
    expect(tuneTaskReturn({ from: "/tunes/tune/edit" }, "tune")).toBe(
      "/tunes/tune"
    );
  });
  it("provides a fallback for direct entry", () => {
    expect(tuneTaskReturn(undefined, "tune")).toBe("/tunes/tune");
  });
  it("does not navigate to an external origin", () => {
    expect(tuneTaskReturn({ from: "//example.com" }, "tune")).toBe(
      "/tunes/tune"
    );
  });
  it("preserves the original History trigger through Edit", () => {
    const entry = tuneTaskEntryState(
      "/tunes/tune/practice-history",
      { from: "/?tab=repertoire", fromFocus: "sidebar-practice-history-link" },
      "tune",
      "sidebar-edit-tune-button"
    );
    expect(tuneTaskReturnState(entry)).toEqual({
      restoreTuneTaskFocus: "sidebar-practice-history-link",
    });
  });
  it("returns direct Edit to its own invoking control", () => {
    const entry = tuneTaskEntryState(
      "/?tab=repertoire",
      undefined,
      "tune",
      "sidebar-edit-tune-button"
    );
    expect(tuneTaskReturnState(entry)).toEqual({
      restoreTuneTaskFocus: "sidebar-edit-tune-button",
    });
  });
  it("does not invent a trigger for direct URL entry", () => {
    expect(tuneTaskReturnState(undefined)).toEqual({
      restoreTuneTaskFocus: undefined,
    });
  });
});
