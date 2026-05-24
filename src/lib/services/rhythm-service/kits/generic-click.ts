import type {
  SampleKitDefinition,
  SampleKitEntry,
} from "@/lib/services/rhythm-service/kits/types";

export const GENERIC_CLICK_PRIMARY_PITCH = 60;
export const GENERIC_CLICK_SECONDARY_PITCH = 69;

export const GENERIC_CLICK_SAMPLE_KIT: Record<number, SampleKitEntry> = {
  60: { kind: "synthetic", durationMs: 30, frequency: 1760 },
  69: { kind: "synthetic", durationMs: 20, frequency: 880 },
};

export function mapSimplePercussionElementPitchClasses(
  pitchClasses: number[]
): number[] {
  return Array.from(
    new Set(
      pitchClasses.map((pitchClass) =>
        pitchClass <= 0
          ? GENERIC_CLICK_PRIMARY_PITCH
          : GENERIC_CLICK_SECONDARY_PITCH
      )
    )
  );
}

export const GENERIC_CLICK_KIT: SampleKitDefinition = {
  entries: GENERIC_CLICK_SAMPLE_KIT,
  getDefaultFallbackPitch: (hasAccent) =>
    hasAccent ? GENERIC_CLICK_PRIMARY_PITCH : GENERIC_CLICK_SECONDARY_PITCH,
  getFallbackPitchesFromElementPitchClasses:
    mapSimplePercussionElementPitchClasses,
  resolvePlaybackPitch: (pitch) => pitch,
};
