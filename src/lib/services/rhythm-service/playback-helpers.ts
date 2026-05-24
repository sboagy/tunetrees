import type { NoteTimingEvent } from "abcjs";
import type { RhythmPatternMetadata } from "@/lib/rhythm/pattern-loader";
import { normalizeTuneTypeName } from "@/lib/rhythm/tune-type-lookup";
import {
  DEFAULT_SAMPLE_KIT,
  SAMPLE_KITS,
  type SampleKitDefinition,
  type SampleKitEntry,
} from "@/lib/services/rhythm-service/kits";

const HORNPIPE_SWING_DELAY_MULTIPLIER = 1 / 3;
const JIG_LILT_DELAY_MULTIPLIER = 1 / 6;

export interface PlaybackEventMarker {
  measureIndex: number;
  noteIndex: number;
}

export type PlaybackPitchSource = "midi" | "elements" | "default" | "rest";

export type PlaybackPitchSelection = {
  source: PlaybackPitchSource;
  midiPitches: number[];
  elementPitches: number[];
  playbackPitches: number[];
};

export function normalizeSampleKit(sampleKit?: string | null): string {
  const normalizedSampleKit = sampleKit?.trim();
  return normalizedSampleKit && SAMPLE_KITS[normalizedSampleKit]
    ? normalizedSampleKit
    : DEFAULT_SAMPLE_KIT;
}

export function getSampleKitDefinition(
  sampleKit?: string | null
): SampleKitDefinition {
  return (
    SAMPLE_KITS[normalizeSampleKit(sampleKit)] ??
    SAMPLE_KITS[DEFAULT_SAMPLE_KIT]
  );
}

export function getSampleKitMapping(
  sampleKit?: string | null
): Record<number, SampleKitEntry> {
  return getSampleKitDefinition(sampleKit).entries;
}

export function clampTempo(qpm: number): number {
  const normalized = Math.round(qpm);
  if (!Number.isFinite(normalized)) {
    return 100;
  }

  return Math.min(240, Math.max(30, normalized));
}

export function eventHasAccent(event: NoteTimingEvent): boolean {
  return Boolean(
    event.elements?.some((group) =>
      group.some((element) =>
        (element.getAttribute("class") ?? "").includes("abcjs-accent")
      )
    )
  );
}

export function eventIsRest(event: NoteTimingEvent): boolean {
  return Boolean(
    event.elements?.some((group) =>
      group.some((element) =>
        (element.getAttribute("class") ?? "").includes("abcjs-rest")
      )
    )
  );
}

function getPitchClassesFromEventElements(event: NoteTimingEvent): number[] {
  const pitchClasses = new Set<number>();

  for (const group of event.elements ?? []) {
    for (const element of group) {
      const className = element.getAttribute("class") ?? "";
      const matches = className.matchAll(/abcjs-p(-?\d+)/g);
      for (const match of matches) {
        const pitchClass = Number.parseInt(match[1] ?? "", 10);
        if (Number.isFinite(pitchClass)) {
          pitchClasses.add(pitchClass);
        }
      }
    }
  }

  return Array.from(pitchClasses);
}

function getFallbackPitchesFromEventElements(
  sampleKit: string,
  event: NoteTimingEvent
): number[] {
  const pitchClasses = getPitchClassesFromEventElements(event);
  if (pitchClasses.length === 0) {
    return [];
  }

  return getSampleKitDefinition(
    sampleKit
  ).getFallbackPitchesFromElementPitchClasses(pitchClasses);
}

export function getPlaybackPitchSelection(
  sampleKit: string,
  event: NoteTimingEvent
): PlaybackPitchSelection {
  if (eventIsRest(event)) {
    return {
      source: "rest",
      midiPitches: [],
      elementPitches: [],
      playbackPitches: [],
    };
  }

  const midiPitches = Array.from(
    new Set(
      (event.midiPitches ?? [])
        .map((pitch) => pitch.pitch)
        .filter((pitch) => Number.isFinite(pitch))
    )
  );

  if (midiPitches.length > 0) {
    return {
      source: "midi",
      midiPitches,
      elementPitches: [],
      playbackPitches: midiPitches,
    };
  }

  const elementPitches = getFallbackPitchesFromEventElements(sampleKit, event);
  if (elementPitches.length > 0) {
    return {
      source: "elements",
      midiPitches: [],
      elementPitches,
      playbackPitches: elementPitches,
    };
  }

  return {
    source: "default",
    midiPitches: [],
    elementPitches: [],
    playbackPitches: [
      getSampleKitDefinition(sampleKit).getDefaultFallbackPitch(
        eventHasAccent(event)
      ),
    ],
  };
}

export function normalizePlaybackPitch(
  sampleKit: string,
  pitch: number,
  hasAccent: boolean
): number {
  return getSampleKitDefinition(sampleKit).resolvePlaybackPitch(
    pitch,
    hasAccent
  );
}

export function getPitchPlaybackGain(
  sampleKit: string,
  resolvedPitch: number,
  event: NoteTimingEvent
): number {
  const hasAccent = eventHasAccent(event);
  const baseGain = hasAccent ? 1 : 0.8;
  return (
    baseGain *
    (getSampleKitDefinition(sampleKit).getPlaybackGainMultiplier?.(
      resolvedPitch
    ) ?? 1)
  );
}

export function getPitchPlaybackRate(
  sampleKit: string,
  resolvedPitch: number
): number {
  return (
    getSampleKitDefinition(sampleKit).getPlaybackRate?.(resolvedPitch) ?? 1
  );
}

function getBeatsPerMeasure(rhythmSignature?: string | null): number {
  const numerator = Number.parseInt(rhythmSignature?.split("/")[0] ?? "", 10);
  return Number.isFinite(numerator) && numerator > 0 ? numerator : 4;
}

export function getEventPulseIndex(
  event: NoteTimingEvent,
  rhythmSignature?: string | null
): number | null {
  const elapsedMs = event.milliseconds;
  const measureMs = event.millisecondsPerMeasure;
  if (
    !Number.isFinite(elapsedMs) ||
    !Number.isFinite(measureMs) ||
    measureMs == null ||
    measureMs <= 0
  ) {
    return null;
  }

  const pulseCount = getBeatsPerMeasure(rhythmSignature);
  const normalizedElapsed = ((elapsedMs % measureMs) + measureMs) % measureMs;
  const pulseIndex =
    Math.floor((normalizedElapsed / measureMs) * pulseCount) + 1;
  return Math.min(Math.max(pulseIndex, 1), pulseCount);
}

export function getPlaybackEventMarker(
  event: NoteTimingEvent,
  currentMeasureIndex: number | null | undefined
): PlaybackEventMarker | null {
  for (const group of event.elements ?? []) {
    for (const element of group) {
      const className = element.getAttribute("class") ?? "";
      const measureMatch = className.match(/\babcjs-mm(\d+)\b/);
      const noteMatch = className.match(/\babcjs-n(\d+)\b/);
      if (!noteMatch) {
        continue;
      }

      const noteIndex = Number.parseInt(noteMatch[1] ?? "", 10);
      const classMeasureIndex = measureMatch
        ? Number.parseInt(measureMatch[1] ?? "", 10)
        : null;
      const resolvedMeasureIndex =
        (Number.isFinite(currentMeasureIndex)
          ? Math.max(0, currentMeasureIndex ?? 0)
          : null) ??
        (Number.isFinite(classMeasureIndex) ? classMeasureIndex : null);

      if (resolvedMeasureIndex != null && Number.isFinite(noteIndex)) {
        return { measureIndex: resolvedMeasureIndex, noteIndex };
      }
    }
  }

  return null;
}

export function parseRhythmSignatureParts(
  rhythmSignature?: string | null
): { numerator: number; denominator: number } | null {
  const [rawNumerator, rawDenominator] = rhythmSignature?.split("/") ?? [];
  const numerator = Number.parseInt(rawNumerator ?? "", 10);
  const denominator = Number.parseInt(rawDenominator ?? "", 10);
  if (
    !Number.isFinite(numerator) ||
    numerator <= 0 ||
    !Number.isFinite(denominator) ||
    denominator <= 0
  ) {
    return null;
  }

  return { numerator, denominator };
}

function isJigTuneType(tuneTypeName: string): boolean {
  const normalizedTuneType = normalizeTuneTypeName(tuneTypeName);
  return (
    normalizedTuneType === "jig" ||
    normalizedTuneType === "slip jig" ||
    normalizedTuneType === "jig (single)"
  );
}

export function getPlaybackDelaySeconds(
  currentMetadata: RhythmPatternMetadata | null,
  event: NoteTimingEvent
): number {
  if (!currentMetadata) {
    return 0;
  }

  const elapsedMs = event.milliseconds;
  const measureMs = event.millisecondsPerMeasure;
  if (
    !Number.isFinite(elapsedMs) ||
    !Number.isFinite(measureMs) ||
    measureMs == null ||
    measureMs <= 0
  ) {
    return 0;
  }

  const normalizedElapsed = ((elapsedMs % measureMs) + measureMs) % measureMs;
  const tuneType = normalizeTuneTypeName(currentMetadata.tuneTypeName);
  const signature = parseRhythmSignatureParts(currentMetadata.rhythmSignature);
  if (!signature) {
    return 0;
  }

  if (
    tuneType === "hornpipe" &&
    signature.numerator === 4 &&
    signature.denominator === 4
  ) {
    const beatDurationMs = measureMs / signature.numerator;
    const eighthDurationMs = beatDurationMs / 2;
    const positionWithinBeat = normalizedElapsed % beatDurationMs;
    const toleranceMs = Math.max(2, beatDurationMs * 0.08);
    const isOffBeatEighth =
      Math.abs(positionWithinBeat - eighthDurationMs) <= toleranceMs;

    if (!isOffBeatEighth) {
      return 0;
    }

    return (eighthDurationMs * HORNPIPE_SWING_DELAY_MULTIPLIER) / 1000;
  }

  if (
    isJigTuneType(currentMetadata.tuneTypeName) &&
    signature.denominator === 8 &&
    signature.numerator % 3 === 0
  ) {
    const eighthDurationMs = measureMs / signature.numerator;
    const tripletDurationMs = eighthDurationMs * 3;
    const positionWithinTriplet = normalizedElapsed % tripletDurationMs;
    const toleranceMs = Math.max(2, eighthDurationMs * 0.12);
    const isMiddleTripletEighth =
      Math.abs(positionWithinTriplet - eighthDurationMs) <= toleranceMs;

    if (!isMiddleTripletEighth) {
      return 0;
    }

    return (eighthDurationMs * JIG_LILT_DELAY_MULTIPLIER) / 1000;
  }

  return 0;
}

export function getCountInPulseIndices(
  signature: { numerator: number; denominator: number },
  pulseCount: number
): Set<number> {
  if (signature.denominator === 8 && signature.numerator % 3 === 0) {
    return new Set(
      Array.from(
        { length: Math.ceil(pulseCount / 3) },
        (_value, index) => index * 3
      )
    );
  }

  return new Set([0]);
}

export function parseRhythmPlaybackDebugFlag(
  value: string | boolean | number | undefined
): number {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  const normalizedValue = value?.trim().toLowerCase();
  if (!normalizedValue) {
    return 0;
  }

  if (normalizedValue === "true") {
    return 1;
  }

  const numericValue = Number.parseInt(normalizedValue, 10);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}

export function createCountInBuffers(
  createBuffer: (
    entry: Extract<SampleKitEntry, { kind: "synthetic" }>
  ) => AudioBuffer
): { primaryBuffer: AudioBuffer; secondaryBuffer: AudioBuffer } | null {
  const primaryEntry = getSampleKitMapping("generic_click")[60];
  const secondaryEntry = getSampleKitMapping("generic_click")[69];
  if (
    primaryEntry?.kind !== "synthetic" ||
    secondaryEntry?.kind !== "synthetic"
  ) {
    return null;
  }

  return {
    primaryBuffer: createBuffer(primaryEntry),
    secondaryBuffer: createBuffer(secondaryEntry),
  };
}
