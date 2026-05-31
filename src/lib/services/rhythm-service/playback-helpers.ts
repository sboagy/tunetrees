import type { NoteTimingEvent } from "abcjs";
import type {
  RhythmPatternMetadata,
  SwingDescriptor,
} from "@/lib/rhythm/pattern-loader";
import { normalizeTuneTypeName } from "@/lib/rhythm/tune-type-lookup";
import {
  DEFAULT_SAMPLE_KIT,
  SAMPLE_KITS,
  type SampleKitDefinition,
  type SampleKitEntry,
} from "@/lib/services/rhythm-service/kits";

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

type SwingSlotContext = {
  descriptor: SwingDescriptor;
  slotIndex: number;
  baseSlotDurationMs: number;
  groupDurationMs: number;
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
  event: NoteTimingEvent,
  currentMetadata?: RhythmPatternMetadata | null
): number {
  const hasAccent = eventHasAccent(event);
  const baseGain = hasAccent ? 1 : 0.8;
  const velocityMultiplier = getVelocityPatternGainMultiplier(
    currentMetadata ?? null,
    event
  );
  return (
    baseGain *
    velocityMultiplier *
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

const PLAYBACK_MEASURE_CLASS_RE = /\babcjs-mm(\d+)\b/;
const PLAYBACK_NOTE_CLASS_RE = /\babcjs-n(\d+)\b/;

function getMarkerFromClassName(
  className: string,
  currentMeasureIndex: number | null | undefined
): PlaybackEventMarker | null {
  const noteMatch = PLAYBACK_NOTE_CLASS_RE.exec(className);
  if (!noteMatch) {
    return null;
  }

  const measureMatch = PLAYBACK_MEASURE_CLASS_RE.exec(className);
  const noteIndex = Number.parseInt(noteMatch[1] ?? "", 10);
  const classMeasureIndex = measureMatch
    ? Number.parseInt(measureMatch[1] ?? "", 10)
    : null;
  const resolvedMeasureIndex =
    (Number.isFinite(currentMeasureIndex)
      ? Math.max(0, currentMeasureIndex ?? 0)
      : null) ??
    (Number.isFinite(classMeasureIndex) ? classMeasureIndex : null);

  if (resolvedMeasureIndex == null || !Number.isFinite(noteIndex)) {
    return null;
  }

  return { measureIndex: resolvedMeasureIndex, noteIndex };
}

export function getPlaybackEventMarker(
  event: NoteTimingEvent,
  currentMeasureIndex: number | null | undefined
): PlaybackEventMarker | null {
  for (const group of event.elements ?? []) {
    for (const element of group) {
      const className = element.getAttribute("class") ?? "";
      const marker = getMarkerFromClassName(className, currentMeasureIndex);
      if (marker) {
        return marker;
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

function getLegacySwingDescriptor(
  currentMetadata: RhythmPatternMetadata
): SwingDescriptor | null {
  const tuneType = normalizeTuneTypeName(currentMetadata.tuneTypeName);
  const signature = parseRhythmSignatureParts(currentMetadata.rhythmSignature);
  if (!signature) {
    return null;
  }

  if (
    tuneType === "hornpipe" &&
    signature.numerator === 4 &&
    signature.denominator === 4
  ) {
    return {
      timeSignature: "4/4",
      macroBeatDivision: 2,
      defaultSwingFactor: 1.33,
      balanceRemainingNotes: false,
      velocityPattern: [110, 75],
      humanizationDeltaMs: 0,
    };
  }

  if (
    isJigTuneType(currentMetadata.tuneTypeName) &&
    signature.denominator === 8
  ) {
    return {
      timeSignature:
        tuneType === "slip jig" && signature.numerator === 9 ? "9/8" : "6/8",
      macroBeatDivision: 3,
      defaultSwingFactor: 1.15,
      balanceRemainingNotes: true,
      velocityPattern:
        signature.numerator === 9 ? [110, 75, 60] : [100, 80, 60],
      humanizationDeltaMs: 0,
    };
  }

  return null;
}

function getActiveSwingDescriptor(
  currentMetadata: RhythmPatternMetadata
): SwingDescriptor | null {
  return (
    currentMetadata.swingDescriptor ?? getLegacySwingDescriptor(currentMetadata)
  );
}

function getSwingSlotContext(
  currentMetadata: RhythmPatternMetadata | null,
  event: NoteTimingEvent
): SwingSlotContext | null {
  if (!currentMetadata) {
    return null;
  }

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

  const normalizedElapsed = ((elapsedMs % measureMs) + measureMs) % measureMs;
  const signature = parseRhythmSignatureParts(currentMetadata.rhythmSignature);
  if (!signature) {
    return null;
  }

  const swingDescriptor = getActiveSwingDescriptor(currentMetadata);
  if (!swingDescriptor) {
    return null;
  }

  const normalizedTimeSignature = swingDescriptor.timeSignature.trim();
  const expectedTimeSignature = `${signature.numerator}/${signature.denominator}`;
  if (
    normalizedTimeSignature &&
    normalizedTimeSignature !== expectedTimeSignature
  ) {
    return null;
  }

  const subunitCountPerMeasure = getSwingSubunitCountPerMeasure(signature);
  if (subunitCountPerMeasure == null || subunitCountPerMeasure <= 0) {
    return null;
  }

  const baseSlotDurationMs = measureMs / subunitCountPerMeasure;
  const groupDurationMs =
    baseSlotDurationMs * swingDescriptor.macroBeatDivision;
  if (groupDurationMs <= 0) {
    return null;
  }

  const positionWithinGroup = normalizedElapsed % groupDurationMs;
  const toleranceMs = Math.max(2, baseSlotDurationMs * 0.12);
  const slotIndex = Array.from(
    { length: swingDescriptor.macroBeatDivision },
    (_value, index) => index
  ).findIndex(
    (index) =>
      Math.abs(positionWithinGroup - baseSlotDurationMs * index) <= toleranceMs
  );

  if (slotIndex < 0) {
    return null;
  }

  return {
    descriptor: swingDescriptor,
    slotIndex,
    baseSlotDurationMs,
    groupDurationMs,
  };
}

function getHumanizationSeed(
  event: NoteTimingEvent,
  slotIndex: number
): number {
  const measureNumber = Number.isFinite(event.measureNumber)
    ? (event.measureNumber ?? 0)
    : 0;
  const elapsedMs = Number.isFinite(event.milliseconds)
    ? Math.round(event.milliseconds ?? 0)
    : 0;
  const pitchSeed = (event.midiPitches ?? []).reduce(
    (totalPitch, pitch) =>
      totalPitch + (Number.isFinite(pitch.pitch) ? pitch.pitch : 0),
    0
  );

  return (
    measureNumber * 73_856_093 +
    elapsedMs * 19_349_663 +
    slotIndex * 83_492_791 +
    pitchSeed
  );
}

export function getVelocityPatternGainMultiplier(
  currentMetadata: RhythmPatternMetadata | null,
  event: NoteTimingEvent
): number {
  const swingSlotContext = getSwingSlotContext(currentMetadata, event);
  if (!swingSlotContext) {
    return 1;
  }

  const velocityValue =
    swingSlotContext.descriptor.velocityPattern[swingSlotContext.slotIndex] ??
    swingSlotContext.descriptor.velocityPattern.at(-1) ??
    100;

  return Math.max(0, velocityValue / 100);
}

export function getHumanizationDelaySeconds(
  currentMetadata: RhythmPatternMetadata | null,
  event: NoteTimingEvent
): number {
  const swingSlotContext = getSwingSlotContext(currentMetadata, event);
  if (
    !swingSlotContext ||
    swingSlotContext.descriptor.humanizationDeltaMs <= 0
  ) {
    return 0;
  }

  const seed = getHumanizationSeed(event, swingSlotContext.slotIndex);
  const jitter = Math.sin(seed) * 10_000;
  const normalizedJitter = jitter - Math.floor(jitter);
  const signedJitterMs =
    (normalizedJitter * 2 - 1) *
    swingSlotContext.descriptor.humanizationDeltaMs;

  return signedJitterMs / 1000;
}

export function getDefaultSwingPercentage(
  currentMetadata: RhythmPatternMetadata | null
): number {
  if (!currentMetadata) {
    return 0;
  }

  const swingDescriptor = getActiveSwingDescriptor(currentMetadata);
  if (
    swingDescriptor &&
    Number.isFinite(swingDescriptor.defaultSwingFactor) &&
    swingDescriptor.defaultSwingFactor > 0
  ) {
    return Math.max(0, swingDescriptor.defaultSwingFactor - 1);
  }

  return currentMetadata.swingPercentage;
}

function getSwingSubunitCountPerMeasure(signature: {
  numerator: number;
  denominator: number;
}): number | null {
  const eighthNoteRatio = 8 / signature.denominator;
  const subunitCount = signature.numerator * eighthNoteRatio;

  return Number.isFinite(subunitCount) && subunitCount > 0
    ? subunitCount
    : null;
}

function getSlotDurationsMs(
  slotCount: number,
  baseSlotDurationMs: number,
  groupDurationMs: number,
  swingFactor: number,
  balanceRemainingNotes: boolean
): number[] | null {
  if (slotCount <= 1) {
    return [groupDurationMs];
  }

  const firstSlotDurationMs = Math.min(
    groupDurationMs,
    Math.max(0, baseSlotDurationMs * swingFactor)
  );

  if (balanceRemainingNotes) {
    const remainingDurationMs = groupDurationMs - firstSlotDurationMs;
    if (remainingDurationMs < 0) {
      return null;
    }

    const remainingSlotDurationMs = remainingDurationMs / (slotCount - 1);
    return [
      firstSlotDurationMs,
      ...Array.from({ length: slotCount - 1 }, () => remainingSlotDurationMs),
    ];
  }

  const slotDurationsMs = [
    firstSlotDurationMs,
    ...Array.from({ length: slotCount - 2 }, () => baseSlotDurationMs),
  ];
  const usedDurationMs = slotDurationsMs.reduce(
    (totalDurationMs, durationMs) => totalDurationMs + durationMs,
    0
  );
  const finalSlotDurationMs = groupDurationMs - usedDurationMs;

  if (finalSlotDurationMs < 0) {
    return null;
  }

  slotDurationsMs.push(finalSlotDurationMs);
  return slotDurationsMs;
}

export function getPlaybackDelaySeconds(
  currentMetadata: RhythmPatternMetadata | null,
  event: NoteTimingEvent,
  swingPercentage = 0
): number {
  if (!currentMetadata || swingPercentage <= 0) {
    return 0;
  }

  const swingSlotContext = getSwingSlotContext(currentMetadata, event);
  if (!swingSlotContext) {
    return 0;
  }

  if (swingSlotContext.slotIndex <= 0) {
    return 0;
  }

  const slotDurationsMs = getSlotDurationsMs(
    swingSlotContext.descriptor.macroBeatDivision,
    swingSlotContext.baseSlotDurationMs,
    swingSlotContext.groupDurationMs,
    1 + swingPercentage,
    swingSlotContext.descriptor.balanceRemainingNotes
  );

  if (!slotDurationsMs) {
    return 0;
  }

  const actualSlotStartMs = slotDurationsMs
    .slice(0, swingSlotContext.slotIndex)
    .reduce((totalDurationMs, durationMs) => totalDurationMs + durationMs, 0);
  const expectedSlotStartMs =
    swingSlotContext.baseSlotDurationMs * swingSlotContext.slotIndex;

  return (actualSlotStartMs - expectedSlotStartMs) / 1000;
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
