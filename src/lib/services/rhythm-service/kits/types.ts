export type SampleKitFileEntry = {
  kind: "file";
  fileName: string;
};

export type SampleKitSyntheticEntry = {
  kind: "synthetic";
  durationMs: number;
  frequency: number;
};

export type SampleKitEntry = SampleKitFileEntry | SampleKitSyntheticEntry;

export type SampleKitDefinition = {
  entries: Record<number, SampleKitEntry>;
  getDefaultFallbackPitch: (hasAccent: boolean) => number;
  getFallbackPitchesFromElementPitchClasses: (
    pitchClasses: number[]
  ) => number[];
  resolvePlaybackPitch: (pitch: number, hasAccent: boolean) => number;
  getPlaybackGainMultiplier?: (resolvedPitch: number) => number;
  getPlaybackRate?: (resolvedPitch: number) => number;
};
