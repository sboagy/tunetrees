import type { NoteTimingEvent } from "abcjs";
import { describe, expect, it } from "vitest";
import type { RhythmPatternMetadata } from "@/lib/rhythm/pattern-loader";
import { getPlaybackDelaySeconds } from "./playback-helpers";

const JIG_SWING_DESCRIPTOR = {
  timeSignature: "6/8",
  macroBeatDivision: 3,
  defaultSwingFactor: 1.15,
  balanceRemainingNotes: true,
  velocityPattern: [100, 80, 60],
  humanizationDeltaMs: 15,
};

const HORNPIPE_SWING_DESCRIPTOR = {
  timeSignature: "4/4",
  macroBeatDivision: 2,
  defaultSwingFactor: 1.4,
  balanceRemainingNotes: false,
  velocityPattern: [110, 75],
  humanizationDeltaMs: 10,
};

const JIG_METADATA: RhythmPatternMetadata = {
  genreName: "Irish Traditional",
  tuneTypeName: "Jig",
  rhythmAbc: "X:1\nM:6/8\nL:1/8\nK:clef=perc\n|: C c c c c c :|",
  rhythmSignature: "6/8",
  patternType: "seed",
  tempoQpm: 115,
  swingPercentage: 0,
  swingDescriptor: JIG_SWING_DESCRIPTOR,
  sampleKit: "generic_click",
  premiumAudioUrl: null,
  premiumAudioTrimMs: 0,
  premiumAudioSource: null,
  premiumAudioSourceTempoQpm: null,
  source: "tune_type_fallback",
};

const HORNPIPE_METADATA: RhythmPatternMetadata = {
  genreName: "Irish Traditional",
  tuneTypeName: "Hornpipe",
  rhythmAbc: "X:1\nM:4/4\nL:1/8\nK:clef=perc\n|: C A C A :|",
  rhythmSignature: "4/4",
  patternType: "seed",
  tempoQpm: 90,
  swingPercentage: 0,
  swingDescriptor: HORNPIPE_SWING_DESCRIPTOR,
  sampleKit: "generic_click",
  premiumAudioUrl: null,
  premiumAudioTrimMs: 0,
  premiumAudioSource: null,
  premiumAudioSourceTempoQpm: null,
  source: "tune_type_fallback",
};

function createTimingEvent(
  milliseconds: number,
  millisecondsPerMeasure = 600
): NoteTimingEvent {
  return {
    type: "event",
    measureStart: milliseconds === 0,
    measureNumber: 1,
    milliseconds,
    millisecondsPerMeasure,
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

  it("drives hornpipe swing from the descriptor's paired subdivision", () => {
    expect(
      getPlaybackDelaySeconds(
        HORNPIPE_METADATA,
        createTimingEvent(0, 2000),
        1 / 3
      )
    ).toBe(0);
    expect(
      getPlaybackDelaySeconds(
        HORNPIPE_METADATA,
        createTimingEvent(250, 2000),
        1 / 3
      )
    ).toBeCloseTo(0.25 / 3, 5);
  });
});
