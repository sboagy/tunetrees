import type { NoteTimingEvent } from "abcjs";
import { describe, expect, it } from "vitest";
import type { RhythmPatternMetadata } from "@/lib/rhythm/pattern-loader";
import { getPlaybackDelaySeconds } from "./playback-helpers";

const JIG_METADATA: RhythmPatternMetadata = {
  genreName: "Irish Traditional",
  tuneTypeName: "Jig",
  rhythmAbc: "X:1\nM:6/8\nL:1/8\nK:clef=perc\n|: C c c c c c :|",
  rhythmSignature: "6/8",
  patternType: "seed",
  tempoQpm: 115,
  swingPercentage: 0,
  sampleKit: "generic_click",
  premiumAudioUrl: null,
  premiumAudioTrimMs: 0,
  premiumAudioSource: null,
  premiumAudioSourceTempoQpm: null,
  source: "tune_type_fallback",
};

function createTimingEvent(milliseconds: number): NoteTimingEvent {
  return {
    type: "event",
    measureStart: milliseconds === 0,
    measureNumber: 1,
    milliseconds,
    millisecondsPerMeasure: 600,
    midiPitches: [{ pitch: 60 }],
    elements: [[]],
  } as unknown as NoteTimingEvent;
}

describe("getPlaybackDelaySeconds jig swing", () => {
  it("returns zero for flat jig playback", () => {
    expect(getPlaybackDelaySeconds(JIG_METADATA, createTimingEvent(0), 0)).toBe(
      0
    );
    expect(
      getPlaybackDelaySeconds(JIG_METADATA, createTimingEvent(100), 0)
    ).toBe(0);
    expect(
      getPlaybackDelaySeconds(JIG_METADATA, createTimingEvent(200), 0)
    ).toBe(0);
  });

  it("delays the second and third jig triplet notes for the default lilt", () => {
    expect(
      getPlaybackDelaySeconds(JIG_METADATA, createTimingEvent(0), 1 / 6)
    ).toBe(0);
    expect(
      getPlaybackDelaySeconds(JIG_METADATA, createTimingEvent(100), 1 / 6)
    ).toBeCloseTo(0.1 / 6, 5);
    expect(
      getPlaybackDelaySeconds(JIG_METADATA, createTimingEvent(200), 1 / 6)
    ).toBeCloseTo(0.1 / 12, 5);
  });

  it("scales both delayed jig triplet notes for stronger swing", () => {
    expect(
      getPlaybackDelaySeconds(JIG_METADATA, createTimingEvent(100), 1 / 3)
    ).toBeCloseTo(0.1 / 3, 5);
    expect(
      getPlaybackDelaySeconds(JIG_METADATA, createTimingEvent(200), 1 / 3)
    ).toBeCloseTo(0.1 / 6, 5);
  });
});
