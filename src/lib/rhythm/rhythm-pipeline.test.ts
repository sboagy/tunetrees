import { describe, expect, it } from "vitest";
import { assembleCanonicalRhythmAbc, splitAbcSections } from "./canonical-abc";
import { buildNotationRhythmAbc } from "./notation-abc";
import { buildPlaybackRhythmPlan } from "./playback-abc";

describe("rhythm ABC pipeline", () => {
  it("flattens compact full-track ABC when the structure does not repeat labels", () => {
    const sourceAbc = [
      "X:1",
      "T:Compact Full Track",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "P:A",
      "| A2 | A3 |",
      "P:B",
      "| B2 | B3 |",
    ].join("\n");

    const canonical = assembleCanonicalRhythmAbc({
      sourceAbc,
      patternType: "full_track",
      tuneContext: { structure: "A2B2", rhythmSignature: "4/4" },
    });

    expect(canonical.fullAbc).not.toContain("P:");
    expect(canonical.fullAbc).toContain("| A2 | A3 | B2 | B3 |");
    expect(canonical.totalBars).toBe(4);
  });

  it("preserves repeated-label full-track structure for downstream start planning", () => {
    const sourceAbc = [
      "X:1",
      "T:Sectioned Full Track",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "P:A",
      "|: A2 | A3 | A4 | A5 :|",
      "P:B",
      "|: B2 | B3 | B4 | B5 :|",
    ].join("\n");

    const canonical = assembleCanonicalRhythmAbc({
      sourceAbc,
      patternType: "full_track",
      tuneContext: { structure: "AABB", rhythmSignature: "4/4" },
    });

    expect(canonical.fullAbc).toContain("P:A");
    expect(canonical.fullAbc).toContain("P:B");
    expect(splitAbcSections(canonical.fullAbc).bodyBars).toHaveLength(8);
  });

  it("builds notation from full ABC without carrying source-specific fields", () => {
    const notationAbc = buildNotationRhythmAbc({
      fullAbc: [
        "X:9",
        "T:Hidden Title",
        "Q:1/4=112",
        "R:Reel",
        "M:4/4",
        "L:1/8",
        "K:clef=perc",
        "P:A",
        "|: A2 | A3 | A4 | A5 | A6 | A7 :|",
      ].join("\n"),
    });

    expect(notationAbc).toContain("X:1");
    expect(notationAbc).toContain("M:4/4");
    expect(notationAbc).not.toContain("T:Hidden Title");
    expect(notationAbc).not.toContain("Q:1/4=112");
    expect(notationAbc).not.toContain("R:Reel");
    expect(notationAbc).not.toContain("P:A");
    expect(notationAbc).toContain("|: A2 | A3 | A4 | A5 |");
    expect(notationAbc).toContain("| A6 | A7 :|");
  });

  it("builds playback from full ABC and rotates from the selected structure start", () => {
    const fullAbc = [
      "X:1",
      "T:Sectioned Full Track",
      "M:4/4",
      "L:1/8",
      "K:clef=perc",
      "P:A",
      "|: A2 | A3 | A4 | A5 :|",
      "P:B",
      "|: B2 | B3 | B4 | B5 :|",
    ].join("\n");

    const plan = buildPlaybackRhythmPlan({
      fullAbc,
      structure: "AABB",
      startSectionValue: "B1",
      rhythmSignature: "4/4",
      tempoQpm: 112,
    });

    expect(plan.startSectionOptions.map((option) => option.value)).toEqual([
      "A1",
      "A2",
      "B1",
      "B2",
    ]);
    expect(plan.startBeatIndex).toBe(8);
    expect(plan.startMeasure).toBe(8);
    expect(plan.playbackAbc).toContain(
      "| B2 | B3 | B4 | B5 | B2 | B3 | B4 | B5 | A2 | A3 | A4 | A5 | A2 | A3 | A4 | A5 |"
    );
  });
});
