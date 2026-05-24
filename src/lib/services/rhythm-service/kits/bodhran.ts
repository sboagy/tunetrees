import type {
  SampleKitDefinition,
  SampleKitEntry,
  SampleKitFileEntry,
} from "@/lib/services/rhythm-service/kits/types";

const BODHRAN_DEFAULT_STRIKE_PITCH = 60;
const BODHRAN_DEFAULT_EDGE_PITCH = 57;
const BODHRAN_LOWEST_STRIKE_PITCH = 43;
const BODHRAN_LOWER_STRIKE_PITCH = 41;
const BODHRAN_LOW_STRIKE_PITCH = 39;
const BODHRAN_MID_STRIKE_PITCH = 68;
const BODHRAN_UPPER_MID_STRIKE_PITCH = 72;
const BODHRAN_HIGH_STRIKE_PITCH = 80;
const BODHRAN_HIGHEST_STRIKE_PITCH = 88;
const BODHRAN_LOW_STRIKE_START_PITCH = 24;
const BODHRAN_LOW_STRIKE_END_PITCH = 55;
const BODHRAN_HIGH_STRIKE_START_PITCH = 60;
const BODHRAN_HIGH_STRIKE_END_PITCH = 91;
const BODHRAN_LOW_ALIAS_START_PITCH = 92;
const BODHRAN_LOW_ALIAS_END_PITCH = 119;
const BODHRAN_LOW_STRIKE_MIN_SEMITONES = -1.75;
const BODHRAN_LOW_STRIKE_MAX_SEMITONES = -0.5;
const BODHRAN_HIGH_STRIKE_MIN_SEMITONES = 0.15;
const BODHRAN_HIGH_STRIKE_MAX_SEMITONES = 0.75;

const BODHRAN_ABCJS_MIDI_TO_SAMPLE_PITCH: Record<number, number> = {
  60: BODHRAN_DEFAULT_STRIKE_PITCH,
  69: BODHRAN_LOW_STRIKE_PITCH,
  72: BODHRAN_LOWEST_STRIKE_PITCH,
};

const BODHRAN_ABCJS_PITCH_CLASS_TO_SAMPLE_PITCH: Record<number, number> = {
  0: BODHRAN_DEFAULT_STRIKE_PITCH,
  [-7]: BODHRAN_LOWEST_STRIKE_PITCH,
  [-6]: BODHRAN_LOWER_STRIKE_PITCH,
  [-4]: BODHRAN_LOW_STRIKE_PITCH,
  2: BODHRAN_MID_STRIKE_PITCH,
  3: BODHRAN_UPPER_MID_STRIKE_PITCH,
  5: BODHRAN_HIGH_STRIKE_PITCH,
  7: 84,
  8: BODHRAN_HIGHEST_STRIKE_PITCH,
  12: BODHRAN_HIGH_STRIKE_END_PITCH,
};

const BODHRAN_SORTED_ELEMENT_PITCH_CLASSES = Object.keys(
  BODHRAN_ABCJS_PITCH_CLASS_TO_SAMPLE_PITCH
)
  .map((pitchClass) => Number.parseInt(pitchClass, 10))
  .filter((pitchClass) => Number.isFinite(pitchClass))
  .sort((left, right) => left - right);

const BODHRAN_SAMPLE_GAIN_MULTIPLIERS: Record<number, number> =
  Object.fromEntries([57, 58, 59].map((pitch) => [pitch, 1.2]));

const BODHRAN_BORDER_FILES = [
  "65818__bosone__bodhran-border01.mp3",
  "65819__bosone__bodhran-border02.mp3",
  "65820__bosone__bodhran-border03.mp3",
  "65821__bosone__bodhran-border04.mp3",
  "65822__bosone__bodhran-border05.mp3",
  "65823__bosone__bodhran-border06.mp3",
] as const;

const BODHRAN_DRAG_FILES = [
  "65824__bosone__bodhran-drag01.mp3",
  "65825__bosone__bodhran-drag02.mp3",
  "65826__bosone__bodhran-drag03.mp3",
  "65827__bosone__bodhran-drag04.mp3",
  "65828__bosone__bodhran-drag05.mp3",
  "65829__bosone__bodhran-drag06.mp3",
  "65830__bosone__bodhran-drag07.mp3",
] as const;

const BODHRAN_F_FILES = [
  "65831__bosone__bodhran-f01.mp3",
  "65832__bosone__bodhran-f02.mp3",
  "65833__bosone__bodhran-f03.mp3",
  "65834__bosone__bodhran-f04.mp3",
] as const;

const BODHRAN_FF_FILES = [
  "65835__bosone__bodhran-ff01.mp3",
  "65836__bosone__bodhran-ff02.mp3",
  "65837__bosone__bodhran-ff03.mp3",
  "65838__bosone__bodhran-ff04.mp3",
] as const;

const BODHRAN_P_FILES = [
  "65839__bosone__bodhran-p01.mp3",
  "65840__bosone__bodhran-p02.mp3",
  "65841__bosone__bodhran-p03.mp3",
  "65842__bosone__bodhran-p04.mp3",
  "65843__bosone__bodhran-p05.mp3",
  "65844__bosone__bodhran-p06.mp3",
  "65845__bosone__bodhran-p07.mp3",
  "65846__bosone__bodhran-p08.mp3",
  "65847__bosone__bodhran-p09.mp3",
  "65848__bosone__bodhran-p10.mp3",
] as const;

const BODHRAN_PP_FILES = [
  "65849__bosone__bodhran-pp01.mp3",
  "65850__bosone__bodhran-pp02.mp3",
  "65851__bosone__bodhran-pp03.mp3",
  "65852__bosone__bodhran-pp04.mp3",
  "65853__bosone__bodhran-pp05.mp3",
] as const;

const BODHRAN_LOW_STRIKE_CYCLE = [
  ...BODHRAN_PP_FILES,
  ...BODHRAN_P_FILES,
  ...BODHRAN_F_FILES,
  ...BODHRAN_FF_FILES,
  ...BODHRAN_PP_FILES,
  ...BODHRAN_P_FILES.slice(0, 4),
] as const;

function rotateSequence<T>(sequence: readonly T[], offset: number): T[] {
  if (sequence.length === 0) {
    return [];
  }

  const normalizedOffset =
    ((offset % sequence.length) + sequence.length) % sequence.length;
  return [
    ...sequence.slice(normalizedOffset),
    ...sequence.slice(0, normalizedOffset),
  ];
}

const BODHRAN_HIGH_STRIKE_CYCLE = rotateSequence(BODHRAN_LOW_STRIKE_CYCLE, 12);

function createFileEntries(
  startPitch: number,
  fileNames: readonly string[]
): Record<number, SampleKitEntry> {
  return Object.fromEntries(
    fileNames.map((fileName, index) => [
      startPitch + index,
      { kind: "file", fileName } satisfies SampleKitFileEntry,
    ])
  );
}

function createRepeatingFileEntries(
  startPitch: number,
  endPitch: number,
  fileNames: readonly string[]
): Record<number, SampleKitEntry> {
  const entries: Record<number, SampleKitEntry> = {};

  for (let pitch = startPitch; pitch <= endPitch; pitch += 1) {
    const fileIndex = (pitch - startPitch) % fileNames.length;
    const fileName = fileNames[fileIndex];
    if (!fileName) {
      continue;
    }

    entries[pitch] = { kind: "file", fileName };
  }

  return entries;
}

function createExplicitFileEntries(
  entries: ReadonlyArray<readonly [number, string]>
): Record<number, SampleKitEntry> {
  return Object.fromEntries(
    entries.map(([pitch, fileName]) => [
      pitch,
      { kind: "file", fileName } satisfies SampleKitFileEntry,
    ])
  );
}

function createBodhranSampleKit(): Record<number, SampleKitEntry> {
  return {
    ...createExplicitFileEntries([
      [21, BODHRAN_PP_FILES[0]],
      [22, BODHRAN_PP_FILES[1]],
      [23, BODHRAN_PP_FILES[2]],
    ]),
    ...createFileEntries(24, BODHRAN_LOW_STRIKE_CYCLE),
    ...createExplicitFileEntries([
      [56, BODHRAN_DRAG_FILES[0]],
      [57, BODHRAN_BORDER_FILES[0]],
      [58, BODHRAN_BORDER_FILES[2]],
      [59, BODHRAN_BORDER_FILES[5]],
    ]),
    ...createFileEntries(60, BODHRAN_HIGH_STRIKE_CYCLE),
    ...createRepeatingFileEntries(92, 119, BODHRAN_LOW_STRIKE_CYCLE),
    ...createFileEntries(120, BODHRAN_DRAG_FILES),
  };
}

export const BODHRAN_SAMPLE_KIT = createBodhranSampleKit();

function getAvailableSamplePitches(): number[] {
  return Object.keys(BODHRAN_SAMPLE_KIT)
    .map((pitch) => Number.parseInt(pitch, 10))
    .filter((pitch) => Number.isFinite(pitch))
    .sort((left, right) => left - right);
}

function clampToNearestSamplePitch(pitch: number): number {
  const availablePitches = getAvailableSamplePitches();
  if (availablePitches.length === 0) {
    return pitch;
  }

  let nearestPitch = availablePitches[0] ?? pitch;
  let smallestDistance = Math.abs(nearestPitch - pitch);
  for (const candidatePitch of availablePitches) {
    const distance = Math.abs(candidatePitch - pitch);
    if (distance < smallestDistance) {
      nearestPitch = candidatePitch;
      smallestDistance = distance;
    }
  }

  return nearestPitch;
}

function semitonesToPlaybackRate(semitones: number): number {
  return 2 ** (semitones / 12);
}

function interpolateLinear(
  value: number,
  inputStart: number,
  inputEnd: number,
  outputStart: number,
  outputEnd: number
): number {
  if (inputEnd <= inputStart) {
    return outputEnd;
  }

  const clampedValue = Math.min(Math.max(value, inputStart), inputEnd);
  const progress = (clampedValue - inputStart) / (inputEnd - inputStart);
  return outputStart + (outputEnd - outputStart) * progress;
}

export function getBodhranMappedMidiSamplePitch(
  pitch: number
): number | undefined {
  return BODHRAN_ABCJS_MIDI_TO_SAMPLE_PITCH[pitch];
}

export function getBodhranPlaybackGainMultiplier(
  resolvedPitch: number
): number {
  return BODHRAN_SAMPLE_GAIN_MULTIPLIERS[resolvedPitch] ?? 1;
}

export function mapBodhranElementPitchToSamplePitch(
  elementPitch: number
): number {
  const legacyMappedPitch =
    BODHRAN_ABCJS_PITCH_CLASS_TO_SAMPLE_PITCH[elementPitch];
  if (Number.isFinite(legacyMappedPitch)) {
    return legacyMappedPitch;
  }

  const nearestPitchClass = BODHRAN_SORTED_ELEMENT_PITCH_CLASSES.reduce(
    (nearestClass, candidateClass) => {
      return Math.abs(candidateClass - elementPitch) <
        Math.abs(nearestClass - elementPitch)
        ? candidateClass
        : nearestClass;
    },
    BODHRAN_SORTED_ELEMENT_PITCH_CLASSES[0] ?? 0
  );

  return (
    BODHRAN_ABCJS_PITCH_CLASS_TO_SAMPLE_PITCH[nearestPitchClass] ??
    BODHRAN_DEFAULT_STRIKE_PITCH
  );
}

export const BODHRAN_KIT: SampleKitDefinition = {
  entries: BODHRAN_SAMPLE_KIT,
  getDefaultFallbackPitch: (hasAccent) =>
    hasAccent ? BODHRAN_DEFAULT_STRIKE_PITCH : BODHRAN_DEFAULT_EDGE_PITCH,
  getFallbackPitchesFromElementPitchClasses: (pitchClasses) =>
    Array.from(
      new Set(
        pitchClasses
          .map((pitchClass) => mapBodhranElementPitchToSamplePitch(pitchClass))
          .filter((pitch): pitch is number => Number.isFinite(pitch))
      )
    ),
  resolvePlaybackPitch: (pitch, hasAccent) => {
    const mappedPitch = getBodhranMappedMidiSamplePitch(pitch);
    if (typeof mappedPitch === "number" && Number.isFinite(mappedPitch)) {
      return mappedPitch;
    }

    if (BODHRAN_SAMPLE_KIT[pitch]) {
      return pitch;
    }

    const defaultPitch = hasAccent
      ? BODHRAN_DEFAULT_STRIKE_PITCH
      : BODHRAN_DEFAULT_EDGE_PITCH;
    return clampToNearestSamplePitch(pitch ?? defaultPitch);
  },
  getPlaybackGainMultiplier: getBodhranPlaybackGainMultiplier,
  getPlaybackRate: (resolvedPitch) => {
    if (resolvedPitch <= BODHRAN_LOW_STRIKE_END_PITCH) {
      return semitonesToPlaybackRate(
        interpolateLinear(
          resolvedPitch,
          BODHRAN_LOW_STRIKE_START_PITCH,
          BODHRAN_LOW_STRIKE_END_PITCH,
          BODHRAN_LOW_STRIKE_MIN_SEMITONES,
          BODHRAN_LOW_STRIKE_MAX_SEMITONES
        )
      );
    }

    if (
      resolvedPitch >= BODHRAN_LOW_ALIAS_START_PITCH &&
      resolvedPitch <= BODHRAN_LOW_ALIAS_END_PITCH
    ) {
      return semitonesToPlaybackRate(
        interpolateLinear(
          resolvedPitch,
          BODHRAN_LOW_ALIAS_START_PITCH,
          BODHRAN_LOW_ALIAS_END_PITCH,
          BODHRAN_LOW_STRIKE_MIN_SEMITONES,
          BODHRAN_LOW_STRIKE_MAX_SEMITONES
        )
      );
    }

    if (
      resolvedPitch >= BODHRAN_HIGH_STRIKE_START_PITCH &&
      resolvedPitch <= BODHRAN_HIGH_STRIKE_END_PITCH
    ) {
      return semitonesToPlaybackRate(
        interpolateLinear(
          resolvedPitch,
          BODHRAN_HIGH_STRIKE_START_PITCH,
          BODHRAN_HIGH_STRIKE_END_PITCH,
          BODHRAN_HIGH_STRIKE_MIN_SEMITONES,
          BODHRAN_HIGH_STRIKE_MAX_SEMITONES
        )
      );
    }

    return 1;
  },
};
