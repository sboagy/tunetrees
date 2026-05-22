import abcjs, {
  type AnimationOptions,
  type BeatCallback,
  type NoteTimingEvent,
  type TuneObject,
} from "abcjs";
import { type Accessor, createSignal, onCleanup } from "solid-js";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";
import {
  loadRhythmPattern as loadRhythmPatternFromPatternLoader,
  type RhythmPatternMetadata,
  type RhythmPatternRequest,
} from "@/lib/rhythm/pattern-loader";
import { normalizeTuneTypeName } from "@/lib/rhythm/tune-type-lookup";

export type {
  RhythmPatternCandidate,
  RhythmPatternCandidateScope,
  RhythmPatternMetadata,
  RhythmPatternRequest,
  RhythmPatternType,
} from "@/lib/rhythm/pattern-loader";

const DEFAULT_SAMPLE_BASE_URL = (
  import.meta.env.VITE_R2_AUDIO_BASE_URL?.trim() ?? ""
).replace(/\/+$/, "");
const DEFAULT_SAMPLE_KIT = "generic_click";
const GENERIC_CLICK_PRIMARY_PITCH = 60;
const GENERIC_CLICK_SECONDARY_PITCH = 69;
const BODHRAN_DEFAULT_STRIKE_PITCH = 28;
const BODHRAN_DEFAULT_EDGE_PITCH = 47;

type SampleKitFileEntry = {
  kind: "file";
  fileName: string;
};

type SampleKitSyntheticEntry = {
  kind: "synthetic";
  durationMs: number;
  frequency: number;
};

type SampleKitEntry = SampleKitFileEntry | SampleKitSyntheticEntry;

type PremiumLoopSelection = {
  source: "database";
  url: string;
  sourceTempoQpm: number | null;
  trimMs: number;
};

type PremiumLoopAudio = Pick<
  HTMLAudioElement,
  | "crossOrigin"
  | "currentTime"
  | "loop"
  | "pause"
  | "play"
  | "playbackRate"
  | "preload"
  | "src"
>;

const SAMPLE_KITS: Record<string, Record<number, SampleKitEntry>> = {
  bodhran: {
    24: { kind: "file", fileName: "65849__bosone__bodhran-pp01.mp3" },
    26: { kind: "file", fileName: "65839__bosone__bodhran-p01.mp3" },
    28: { kind: "file", fileName: "65831__bosone__bodhran-f01.mp3" },
    29: { kind: "file", fileName: "65835__bosone__bodhran-ff01.mp3" },
    44: { kind: "file", fileName: "65824__bosone__bodhran-drag01.mp3" },
    45: { kind: "file", fileName: "65818__bosone__bodhran-border01.mp3" },
    46: { kind: "file", fileName: "65820__bosone__bodhran-border03.mp3" },
    47: { kind: "file", fileName: "65823__bosone__bodhran-border06.mp3" },
  },
  bodhran2: {
    21: { kind: "file", fileName: "A0.mp3" },
    22: { kind: "file", fileName: "Bb0.mp3" },
    23: { kind: "file", fileName: "B0.mp3" },
    24: { kind: "file", fileName: "C1.mp3" },
    25: { kind: "file", fileName: "Db1.mp3" },
    26: { kind: "file", fileName: "D1.mp3" },
    27: { kind: "file", fileName: "Eb1.mp3" },
    28: { kind: "file", fileName: "E1.mp3" },
    29: { kind: "file", fileName: "F1.mp3" },
    30: { kind: "file", fileName: "Gb1.mp3" },
    31: { kind: "file", fileName: "G1.mp3" },
    32: { kind: "file", fileName: "Ab1.mp3" },
    33: { kind: "file", fileName: "A1.mp3" },
    34: { kind: "file", fileName: "Bb1.mp3" },
    35: { kind: "file", fileName: "B1.mp3" },
    36: { kind: "file", fileName: "C2.mp3" },
    37: { kind: "file", fileName: "Db2.mp3" },
    38: { kind: "file", fileName: "D2.mp3" },
    39: { kind: "file", fileName: "Eb2.mp3" },
    40: { kind: "file", fileName: "E2.mp3" },
    41: { kind: "file", fileName: "F2.mp3" },
    42: { kind: "file", fileName: "Gb2.mp3" },
    43: { kind: "file", fileName: "G2.mp3" },
    44: { kind: "file", fileName: "Ab2.mp3" },
    45: { kind: "file", fileName: "A2.mp3" },
    46: { kind: "file", fileName: "Bb2.mp3" },
    47: { kind: "file", fileName: "B2.mp3" },
    48: { kind: "file", fileName: "C3.mp3" },
    49: { kind: "file", fileName: "Db3.mp3" },
    50: { kind: "file", fileName: "D3.mp3" },
    51: { kind: "file", fileName: "Eb3.mp3" },
    52: { kind: "file", fileName: "E3.mp3" },
    53: { kind: "file", fileName: "F3.mp3" },
    54: { kind: "file", fileName: "Gb3.mp3" },
    55: { kind: "file", fileName: "G3.mp3" },
    56: { kind: "file", fileName: "Ab3.mp3" },
    57: { kind: "file", fileName: "A3.mp3" },
    58: { kind: "file", fileName: "Bb3.mp3" },
    59: { kind: "file", fileName: "B3.mp3" },
    60: { kind: "file", fileName: "C4.mp3" },
    61: { kind: "file", fileName: "Db4.mp3" },
    62: { kind: "file", fileName: "D4.mp3" },
    63: { kind: "file", fileName: "Eb4.mp3" },
    64: { kind: "file", fileName: "E4.mp3" },
    65: { kind: "file", fileName: "F4.mp3" },
    66: { kind: "file", fileName: "Gb4.mp3" },
    67: { kind: "file", fileName: "G4.mp3" },
    68: { kind: "file", fileName: "Ab4.mp3" },
    69: { kind: "file", fileName: "A4.mp3" },
    70: { kind: "file", fileName: "Bb4.mp3" },
    71: { kind: "file", fileName: "B4.mp3" },
    72: { kind: "file", fileName: "C5.mp3" },
    73: { kind: "file", fileName: "Db5.mp3" },
    74: { kind: "file", fileName: "D5.mp3" },
    75: { kind: "file", fileName: "Eb5.mp3" },
    76: { kind: "file", fileName: "E5.mp3" },
    77: { kind: "file", fileName: "F5.mp3" },
    78: { kind: "file", fileName: "Gb5.mp3" },
    79: { kind: "file", fileName: "G5.mp3" },
    80: { kind: "file", fileName: "Ab5.mp3" },
    81: { kind: "file", fileName: "A5.mp3" },
    82: { kind: "file", fileName: "Bb5.mp3" },
    83: { kind: "file", fileName: "B5.mp3" },
    84: { kind: "file", fileName: "C6.mp3" },
    85: { kind: "file", fileName: "Db6.mp3" },
    86: { kind: "file", fileName: "D6.mp3" },
    87: { kind: "file", fileName: "Eb6.mp3" },
    88: { kind: "file", fileName: "E6.mp3" },
    89: { kind: "file", fileName: "F6.mp3" },
    90: { kind: "file", fileName: "Gb6.mp3" },
    91: { kind: "file", fileName: "G6.mp3" },
    92: { kind: "file", fileName: "Ab6.mp3" },
    93: { kind: "file", fileName: "A6.mp3" },
    94: { kind: "file", fileName: "Bb6.mp3" },
    95: { kind: "file", fileName: "B6.mp3" },
    96: { kind: "file", fileName: "C7.mp3" },
    97: { kind: "file", fileName: "Db7.mp3" },
    98: { kind: "file", fileName: "D7.mp3" },
    99: { kind: "file", fileName: "Eb7.mp3" },
    100: { kind: "file", fileName: "E7.mp3" },
    101: { kind: "file", fileName: "F7.mp3" },
    102: { kind: "file", fileName: "Gb7.mp3" },
    103: { kind: "file", fileName: "G7.mp3" },
    104: { kind: "file", fileName: "Ab7.mp3" },
    105: { kind: "file", fileName: "A7.mp3" },
    106: { kind: "file", fileName: "Bb7.mp3" },
    107: { kind: "file", fileName: "B7.mp3" },
    108: { kind: "file", fileName: "C8.mp3" },
  },
  generic_click: {
    60: { kind: "synthetic", durationMs: 30, frequency: 1760 },
    69: { kind: "synthetic", durationMs: 20, frequency: 880 },
  },
};

// abcjs reports percussion notes in its own pitch space. Normalize those
// note values into concrete bodhran sample slots before looking up files.
const BODHRAN_ABCJS_MIDI_TO_SAMPLE_PITCH: Record<number, number> = {
  60: BODHRAN_DEFAULT_STRIKE_PITCH,
  69: 45,
  72: BODHRAN_DEFAULT_EDGE_PITCH,
};

const BODHRAN_ABCJS_PITCH_CLASS_TO_SAMPLE_PITCH: Record<number, number> = {
  0: BODHRAN_DEFAULT_STRIKE_PITCH,
  5: 45,
  7: BODHRAN_DEFAULT_EDGE_PITCH,
};

const HORNPIPE_SWING_DELAY_MULTIPLIER = 1 / 3;
const JIG_LILT_DELAY_MULTIPLIER = 1 / 6;

const BODHRAN_SAMPLE_GAIN_MULTIPLIERS: Record<number, number> = {
  45: 1.2,
  46: 1.2,
  47: 1.2,
};

const RHYTHM_TEMPO_STORAGE_KEY_PREFIX = "tunetrees.rhythm-tempo";

export interface PlaybackStartOptions {
  startPositionMs?: number;
  startBeatIndex?: number;
  startMeasure?: number;
  playbackRhythmAbc?: string;
}

export interface PlaybackEventMarker {
  measureIndex: number;
  noteIndex: number;
}

export interface RhythmService {
  metadata: Accessor<RhythmPatternMetadata | null>;
  tempoQpm: Accessor<number>;
  isPlaying: Accessor<boolean>;
  isPaused: Accessor<boolean>;
  isReady: Accessor<boolean>;
  isCountIn: Accessor<boolean>;
  countInPulse: Accessor<number>;
  countInTotalPulses: Accessor<number>;
  currentBeatIndex: Accessor<number>;
  currentPlaybackMarker: Accessor<PlaybackEventMarker | null>;
  currentPulse: Accessor<number>;
  currentMeasure: Accessor<number>;
  error: Accessor<string | null>;
  loadPattern: (
    request: RhythmPatternRequest
  ) => Promise<RhythmPatternMetadata | null>;
  play: (options?: PlaybackStartOptions) => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => Promise<void>;
  restart: (options?: PlaybackStartOptions) => Promise<void>;
  togglePlayback: () => Promise<void>;
  setTempoQpm: (nextQpm: number) => Promise<void>;
  updateRhythmAbc: (nextRhythmAbc: string) => void;
}

export interface CreateRhythmServiceOptions {
  db: SqliteDatabase;
  abcjsModule?: Pick<typeof abcjs, "renderAbc" | "TimingCallbacks">;
  audioContext?: AudioContext;
  audioElementFactory?: (sourceUrl: string) => PremiumLoopAudio;
  fetchImpl?: typeof fetch;
  initialCountInMeasures?: number;
  preferPremiumLoop?: Accessor<boolean>;
  sampleBaseUrl?: string;
  sampleUrlBuilder?: (sampleKit: string, fileName: string) => string;
  waitImpl?: (milliseconds: number) => Promise<void>;
}

type ResolvedAbcjsModule = NonNullable<
  CreateRhythmServiceOptions["abcjsModule"]
>;
type TimingCallbacksInstance = InstanceType<
  ResolvedAbcjsModule["TimingCallbacks"]
>;

function getRhythmTempoStorage(): Storage | null {
  if (typeof globalThis === "undefined") {
    return null;
  }

  try {
    const storage =
      "localStorage" in globalThis ? globalThis.localStorage : null;
    if (
      storage &&
      typeof storage.getItem === "function" &&
      typeof storage.setItem === "function"
    ) {
      return storage;
    }

    return null;
  } catch {
    return null;
  }
}

function buildRhythmTempoStorageKey(
  userId: string | null | undefined,
  tuneTypeName: string
): string {
  const normalizedUserId = userId?.trim() || "anonymous";
  return [
    RHYTHM_TEMPO_STORAGE_KEY_PREFIX,
    normalizedUserId,
    normalizeTuneTypeName(tuneTypeName),
  ].join(":");
}

function readStoredRhythmTempo(
  userId: string | null | undefined,
  tuneTypeName: string
): number | null {
  const storage = getRhythmTempoStorage();
  if (!storage) {
    return null;
  }

  const rawValue = storage.getItem(
    buildRhythmTempoStorageKey(userId, tuneTypeName)
  );
  if (!rawValue) {
    return null;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsedValue) ? clampTempo(parsedValue) : null;
}

function writeStoredRhythmTempo(
  userId: string | null | undefined,
  tuneTypeName: string,
  tempoQpm: number
): void {
  const storage = getRhythmTempoStorage();
  if (!storage) {
    return;
  }

  storage.setItem(
    buildRhythmTempoStorageKey(userId, tuneTypeName),
    String(clampTempo(tempoQpm))
  );
}

function normalizeSampleKit(sampleKit?: string | null): string {
  return sampleKit?.trim() || DEFAULT_SAMPLE_KIT;
}

function getSampleKitMapping(
  sampleKit?: string | null
): Record<number, SampleKitEntry> {
  return (
    SAMPLE_KITS[normalizeSampleKit(sampleKit)] ??
    SAMPLE_KITS[DEFAULT_SAMPLE_KIT]
  );
}

function buildSampleUrl(
  baseUrl: string,
  sampleKit: string,
  fileName: string
): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const assetPath = `audio/kits/${sampleKit}/${fileName}`;
  return normalizedBase ? `${normalizedBase}/${assetPath}` : `/${assetPath}`;
}

function msToSeconds(value: number): number {
  return value / 1000;
}

function waitForMilliseconds(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

export async function loadRhythmPattern(
  db: SqliteDatabase,
  request: RhythmPatternRequest,
  options?: { sampleBaseUrl?: string }
): Promise<RhythmPatternMetadata | null> {
  return loadRhythmPatternFromPatternLoader(db, request, options);
}

function clampTempo(qpm: number): number {
  const normalized = Math.round(qpm);
  if (!Number.isFinite(normalized)) {
    return 100;
  }

  return Math.min(240, Math.max(30, normalized));
}

function getAudioContextConstructor(): (new () => AudioContext) | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: new () => AudioContext })
      .webkitAudioContext
  );
}

function getAudioElementConstructor():
  | (new (
      src?: string
    ) => HTMLAudioElement)
  | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.Audio;
}

function clampPremiumLoopPlaybackRate(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  return Math.min(2, Math.max(0.5, value));
}

async function decodeSample(
  audioContext: AudioContext,
  fetchImpl: typeof fetch,
  url: string
): Promise<AudioBuffer> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch rhythm sample: ${url}`);
  }

  const buffer = await response.arrayBuffer();
  return await audioContext.decodeAudioData(buffer);
}

function createSyntheticClickBuffer(
  audioContext: AudioContext,
  entry: SampleKitSyntheticEntry
): AudioBuffer {
  const frameCount = Math.max(
    1,
    Math.round((audioContext.sampleRate * entry.durationMs) / 1000)
  );
  const buffer = audioContext.createBuffer(
    1,
    frameCount,
    audioContext.sampleRate
  );
  const channelData = buffer.getChannelData(0);

  for (let index = 0; index < frameCount; index += 1) {
    const time = index / audioContext.sampleRate;
    const envelope = Math.exp((-8 * index) / frameCount);
    channelData[index] =
      Math.sin(2 * Math.PI * entry.frequency * time) * envelope;
  }

  return buffer;
}

function eventHasAccent(event: NoteTimingEvent): boolean {
  return Boolean(
    event.elements?.some((group) =>
      group.some((element) =>
        (element.getAttribute("class") ?? "").includes("abcjs-accent")
      )
    )
  );
}

function getDefaultFallbackPitch(
  sampleKit: string,
  hasAccent: boolean
): number {
  if (sampleKit === "bodhran") {
    return hasAccent
      ? BODHRAN_DEFAULT_STRIKE_PITCH
      : BODHRAN_DEFAULT_EDGE_PITCH;
  }

  return hasAccent
    ? GENERIC_CLICK_PRIMARY_PITCH
    : GENERIC_CLICK_SECONDARY_PITCH;
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

  if (sampleKit === "bodhran") {
    return Array.from(
      new Set(
        pitchClasses
          .map(
            (pitchClass) =>
              BODHRAN_ABCJS_PITCH_CLASS_TO_SAMPLE_PITCH[pitchClass]
          )
          .filter((pitch): pitch is number => Number.isFinite(pitch))
      )
    );
  }

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

function getPlaybackPitches(
  sampleKit: string,
  event: NoteTimingEvent
): number[] {
  const explicitPitches = Array.from(
    new Set(
      (event.midiPitches ?? [])
        .map((pitch) => pitch.pitch)
        .filter((pitch) => Number.isFinite(pitch))
    )
  );

  if (explicitPitches.length > 0) {
    return explicitPitches;
  }

  const elementPitches = getFallbackPitchesFromEventElements(sampleKit, event);
  if (elementPitches.length > 0) {
    return elementPitches;
  }

  return [getDefaultFallbackPitch(sampleKit, eventHasAccent(event))];
}

function normalizePlaybackPitch(
  sampleKit: string,
  pitch: number,
  hasAccent: boolean
): number {
  if (sampleKit !== "bodhran") {
    return pitch;
  }

  if (SAMPLE_KITS.bodhran?.[pitch]) {
    return pitch;
  }

  return (
    BODHRAN_ABCJS_MIDI_TO_SAMPLE_PITCH[pitch] ??
    (hasAccent ? BODHRAN_DEFAULT_STRIKE_PITCH : BODHRAN_DEFAULT_EDGE_PITCH)
  );
}

function getPitchPlaybackGain(
  sampleKit: string,
  resolvedPitch: number,
  event: NoteTimingEvent
): number {
  const hasAccent = eventHasAccent(event);
  const baseGain = hasAccent ? 1 : 0.8;

  if (sampleKit === "bodhran") {
    return baseGain * (BODHRAN_SAMPLE_GAIN_MULTIPLIERS[resolvedPitch] ?? 1);
  }

  return baseGain;
}

function getBeatsPerMeasure(rhythmSignature?: string | null): number {
  const numerator = Number.parseInt(rhythmSignature?.split("/")[0] ?? "", 10);
  return Number.isFinite(numerator) && numerator > 0 ? numerator : 4;
}

function getEventPulseIndex(
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

function getPlaybackEventMarker(
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

function parseRhythmSignatureParts(
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

function getPlaybackDelaySeconds(
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

function getCountInPulseIndices(
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

let nextRhythmServiceInstanceId = 1;
let activeRhythmPlayback: {
  ownerId: number;
  stop: (resetPosition?: boolean) => void;
} | null = null;

export function createRhythmService(
  options: CreateRhythmServiceOptions
): RhythmService {
  const resolvedAbcjs: ResolvedAbcjsModule = options.abcjsModule ?? abcjs;
  const fetchImpl = options.fetchImpl ?? fetch;
  const waitImpl = options.waitImpl ?? waitForMilliseconds;
  const sampleBaseUrl = options.sampleBaseUrl ?? DEFAULT_SAMPLE_BASE_URL;

  const [metadata, setMetadata] = createSignal<RhythmPatternMetadata | null>(
    null
  );
  const [tempoQpm, setTempoQpmSignal] = createSignal(100);
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [isPaused, setIsPaused] = createSignal(false);
  const [isReady, setIsReady] = createSignal(false);
  const [isCountIn, setIsCountIn] = createSignal(false);
  const [countInPulse, setCountInPulse] = createSignal(0);
  const [countInTotalPulses, setCountInTotalPulses] = createSignal(0);
  const [currentBeatIndex, setCurrentBeatIndex] = createSignal(0);
  const [currentPlaybackMarker, setCurrentPlaybackMarker] =
    createSignal<PlaybackEventMarker | null>(null);
  const [currentPulse, setCurrentPulse] = createSignal(0);
  const [currentMeasure, setCurrentMeasure] = createSignal(0);
  const [error, setError] = createSignal<string | null>(null);
  const serviceInstanceId = nextRhythmServiceInstanceId++;

  let timingCallbacks: TimingCallbacksInstance | null = null;
  let lastKnownPositionMs = 0;
  let pendingStartPlayback: Promise<void> | null = null;
  let ownedAudioContext: AudioContext | null = null;
  let sampleBuffers = new Map<number, AudioBuffer>();
  let loadedSampleKit: string | null = null;
  let premiumLoopAudio: PremiumLoopAudio | null = null;
  let premiumLoopUrl: string | null = null;
  let renderTarget: HTMLDivElement | null = null;
  let currentEventIndex = 0;
  let playbackStartBeatIndex = 0;
  let playbackStartMeasure = 0;
  let activePlaybackRhythmAbc: string | null = null;
  let tempoPreferenceKey: {
    userId: string | null | undefined;
    tuneTypeName: string;
  } | null = null;

  const resetCountInState = () => {
    setIsCountIn(false);
    setCountInPulse(0);
    setCountInTotalPulses(0);
  };

  const stopPremiumLoopAudio = (resetPosition: boolean) => {
    if (!premiumLoopAudio) {
      if (resetPosition) {
        premiumLoopUrl = null;
      }
      return;
    }

    premiumLoopAudio.pause();
    if (resetPosition) {
      premiumLoopAudio.currentTime = 0;
      premiumLoopAudio = null;
      premiumLoopUrl = null;
    }
  };

  const stopPlayback = (resetPosition = true) => {
    if (timingCallbacks) {
      timingCallbacks.stop();
      timingCallbacks = null;
    }
    stopPremiumLoopAudio(resetPosition);
    if (activeRhythmPlayback?.ownerId === serviceInstanceId) {
      activeRhythmPlayback = null;
    }
    if (resetPosition) {
      lastKnownPositionMs = 0;
      playbackStartBeatIndex = 0;
      playbackStartMeasure = 0;
      activePlaybackRhythmAbc = null;
    }
    currentEventIndex = 0;
    resetCountInState();
    setCurrentBeatIndex(0);
    setCurrentPlaybackMarker(null);
    setCurrentPulse(0);
    setCurrentMeasure(0);
    setIsPlaying(false);
    setIsPaused(false);
  };

  const claimGlobalPlayback = () => {
    if (activeRhythmPlayback?.ownerId === serviceInstanceId) {
      return;
    }

    activeRhythmPlayback?.stop(true);
    activeRhythmPlayback = {
      ownerId: serviceInstanceId,
      stop: stopPlayback,
    };
  };

  function resolvePremiumLoopSelection(
    currentMetadata: RhythmPatternMetadata
  ): PremiumLoopSelection | null {
    if (!options.preferPremiumLoop?.()) {
      return null;
    }

    return currentMetadata.premiumAudioUrl
      ? {
          source: "database",
          url: currentMetadata.premiumAudioUrl,
          sourceTempoQpm:
            currentMetadata.premiumAudioSourceTempoQpm ??
            currentMetadata.tempoQpm,
          trimMs: currentMetadata.premiumAudioTrimMs,
        }
      : null;
  }

  function createPremiumLoopAudio(sourceUrl: string): PremiumLoopAudio {
    if (options.audioElementFactory) {
      return options.audioElementFactory(sourceUrl);
    }

    const AudioConstructor = getAudioElementConstructor();
    if (!AudioConstructor) {
      throw new Error(
        "HTML audio playback is not available in this environment."
      );
    }

    return new AudioConstructor(sourceUrl);
  }

  async function startPremiumLoopAudio(
    selection: PremiumLoopSelection,
    targetTempoQpm: number,
    positionMs?: number
  ): Promise<void> {
    if (!premiumLoopAudio || premiumLoopUrl !== selection.url) {
      stopPremiumLoopAudio(true);
      premiumLoopAudio = createPremiumLoopAudio(selection.url);
      premiumLoopUrl = selection.url;
    }

    premiumLoopAudio.loop = true;
    premiumLoopAudio.preload = "auto";
    premiumLoopAudio.crossOrigin = "anonymous";
    premiumLoopAudio.playbackRate = clampPremiumLoopPlaybackRate(
      targetTempoQpm / Math.max(1, selection.sourceTempoQpm ?? targetTempoQpm)
    );
    if (positionMs != null) {
      premiumLoopAudio.currentTime = msToSeconds(
        Math.max(0, positionMs + selection.trimMs)
      );
    } else if (selection.trimMs > 0 && premiumLoopAudio.currentTime === 0) {
      premiumLoopAudio.currentTime = msToSeconds(selection.trimMs);
    }

    await premiumLoopAudio.play();
    setIsReady(true);
  }

  async function ensureAudioContext(): Promise<AudioContext> {
    if (options.audioContext) {
      return options.audioContext;
    }
    if (ownedAudioContext) {
      return ownedAudioContext;
    }

    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor) {
      throw new Error("Web Audio API is not available in this environment.");
    }

    ownedAudioContext = new AudioContextConstructor();
    return ownedAudioContext;
  }

  async function ensureSamplesLoaded(): Promise<void> {
    const activeSampleKit = normalizeSampleKit(metadata()?.sampleKit);
    const kitMapping = getSampleKitMapping(activeSampleKit);

    if (
      loadedSampleKit === activeSampleKit &&
      sampleBuffers.size === Object.keys(kitMapping).length
    ) {
      setIsReady(true);
      return;
    }

    const audioContext = await ensureAudioContext();
    const decodedEntries = await Promise.all(
      Object.entries(kitMapping).map(async ([pitch, entry]) => {
        if (entry.kind === "file") {
          const url = options.sampleUrlBuilder
            ? options.sampleUrlBuilder(activeSampleKit, entry.fileName)
            : buildSampleUrl(sampleBaseUrl, activeSampleKit, entry.fileName);
          const buffer = await decodeSample(audioContext, fetchImpl, url);
          return [Number(pitch), buffer] as const;
        }
        return [
          Number(pitch),
          createSyntheticClickBuffer(audioContext, entry),
        ] as const;
      })
    );

    sampleBuffers = new Map(decodedEntries);
    loadedSampleKit = activeSampleKit;
    setIsReady(true);
  }

  function playEventPitches(
    event: NoteTimingEvent,
    audioContext: AudioContext
  ) {
    if (event.type !== "event") {
      return;
    }

    const activeSampleKit = normalizeSampleKit(metadata()?.sampleKit);
    const playbackDelaySeconds = getPlaybackDelaySeconds(metadata(), event);
    const hasAccent = eventHasAccent(event);
    for (const playbackPitch of getPlaybackPitches(activeSampleKit, event)) {
      const resolvedPitch = normalizePlaybackPitch(
        activeSampleKit,
        playbackPitch,
        hasAccent
      );
      const gainValue = getPitchPlaybackGain(
        activeSampleKit,
        resolvedPitch,
        event
      );
      const buffer = sampleBuffers.get(resolvedPitch);
      if (!buffer) {
        continue;
      }

      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();
      source.buffer = buffer;
      gainNode.gain.value = gainValue;
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      if (playbackDelaySeconds > 0) {
        source.start(audioContext.currentTime + playbackDelaySeconds);
      } else {
        source.start();
      }
    }
  }

  async function runCountIn(
    audioContext: AudioContext,
    currentMetadata: RhythmPatternMetadata,
    measureCount: number
  ): Promise<void> {
    if (measureCount <= 0) {
      return;
    }

    const signature = parseRhythmSignatureParts(
      currentMetadata.rhythmSignature
    );
    if (!signature) {
      return;
    }

    const pulseDurationMs =
      (60_000 / Math.max(1, tempoQpm())) * (4 / signature.denominator);
    const pulseCount = signature.numerator * measureCount;
    const accentPulseIndices = getCountInPulseIndices(signature, pulseCount);
    const primaryEntry = SAMPLE_KITS.generic_click[GENERIC_CLICK_PRIMARY_PITCH];
    const secondaryEntry =
      SAMPLE_KITS.generic_click[GENERIC_CLICK_SECONDARY_PITCH];
    if (
      primaryEntry?.kind !== "synthetic" ||
      secondaryEntry?.kind !== "synthetic"
    ) {
      return;
    }

    const primaryBuffer = createSyntheticClickBuffer(
      audioContext,
      primaryEntry
    );
    const secondaryBuffer = createSyntheticClickBuffer(
      audioContext,
      secondaryEntry
    );
    const countInStartTime = audioContext.currentTime;

    setIsCountIn(true);
    setCountInTotalPulses(pulseCount);
    setCountInPulse(0);

    for (let pulseIndex = 0; pulseIndex < pulseCount; pulseIndex += 1) {
      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();
      const isAccentPulse = accentPulseIndices.has(
        pulseIndex % signature.numerator
      );
      source.buffer = isAccentPulse ? primaryBuffer : secondaryBuffer;
      gainNode.gain.value = isAccentPulse ? 1 : 0.75;
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      source.start(
        countInStartTime + msToSeconds(pulseIndex * pulseDurationMs)
      );

      setCountInPulse(pulseIndex + 1);
      await waitImpl(pulseDurationMs);
    }

    resetCountInState();
  }

  function buildTimingCallbacks(
    rhythmAbc: string,
    audioContext: AudioContext,
    shouldPlayEventSamples: boolean
  ): TimingCallbacksInstance {
    if (typeof document === "undefined") {
      throw new Error("ABC rhythm playback requires a browser document.");
    }

    renderTarget ??= document.createElement("div");
    const rendered = resolvedAbcjs.renderAbc(renderTarget, rhythmAbc, {
      add_classes: true,
      staffwidth: 1,
    });

    const visualObj = rendered[0] as TuneObject | undefined;
    if (!visualObj) {
      throw new Error("Unable to parse rhythm ABC.");
    }

    const beatCallback: BeatCallback = (beatNumber) => {
      setCurrentPulse(Math.max(0, Math.floor(beatNumber)));
    };

    const animationOptions: AnimationOptions = {
      qpm: tempoQpm(),
      beatCallback,
      eventCallback: (event) => {
        if (!event) {
          lastKnownPositionMs = 0;
          currentEventIndex = playbackStartBeatIndex;
          setCurrentBeatIndex(playbackStartBeatIndex);
          setCurrentPlaybackMarker(null);
          setCurrentPulse(0);
          setCurrentMeasure(playbackStartMeasure);

          const currentStart = pendingStartPlayback;

          return (currentStart ?? Promise.resolve())
            .then(() =>
              beginPlayback(undefined, false, {
                startBeatIndex: playbackStartBeatIndex,
                startMeasure: playbackStartMeasure,
                playbackRhythmAbc: activePlaybackRhythmAbc ?? undefined,
              })
            )
            .then(() => "continue" as const)
            .catch((cause: unknown) => {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Failed to loop rhythm playback."
              );
              stopPlayback();
              return "continue" as const;
            });
        }
        const playbackMeasureIndex = event.measureStart
          ? playbackStartMeasure + (event.measureNumber ?? currentMeasure())
          : currentMeasure();
        if (event.measureStart) {
          setCurrentMeasure(playbackMeasureIndex);
        }
        currentEventIndex += 1;
        setCurrentBeatIndex(currentEventIndex);
        setCurrentPlaybackMarker(
          getPlaybackEventMarker(event, playbackMeasureIndex)
        );
        const nextPulse = getEventPulseIndex(
          event,
          metadata()?.rhythmSignature ?? null
        );
        if (nextPulse != null) {
          setCurrentPulse(nextPulse);
        }
        if (shouldPlayEventSamples) {
          playEventPitches(event, audioContext);
        }
      },
    };

    return new resolvedAbcjs.TimingCallbacks(visualObj, animationOptions);
  }

  async function startPlayback(
    positionMs?: number,
    useCountIn = false,
    startOptions?: PlaybackStartOptions
  ) {
    const currentMetadata = metadata();
    if (!currentMetadata) {
      throw new Error("Rhythm pattern metadata has not been loaded.");
    }

    claimGlobalPlayback();
    activePlaybackRhythmAbc = startOptions?.playbackRhythmAbc?.trim() || null;
    playbackStartBeatIndex = Math.max(0, startOptions?.startBeatIndex ?? 0);
    playbackStartMeasure = Math.max(0, startOptions?.startMeasure ?? 0);
    currentEventIndex = playbackStartBeatIndex;
    setCurrentBeatIndex(playbackStartBeatIndex);
    setCurrentPlaybackMarker(null);
    setCurrentPulse(0);
    setIsPaused(false);
    setCurrentMeasure(playbackStartMeasure);

    if (!resolvePremiumLoopSelection(currentMetadata)) {
      await ensureSamplesLoaded();
    }

    const audioContext = await ensureAudioContext();
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    if (useCountIn) {
      await runCountIn(
        audioContext,
        currentMetadata,
        options.initialCountInMeasures ?? 0
      );
    }

    let usingPremiumLoop = false;
    const premiumLoopSelection = resolvePremiumLoopSelection(currentMetadata);
    if (premiumLoopSelection) {
      try {
        await startPremiumLoopAudio(
          premiumLoopSelection,
          tempoQpm(),
          positionMs
        );
        usingPremiumLoop = true;
      } catch {
        // Premium loop unavailable (e.g. 404, CORS, autoplay rejection) –
        // clean up and fall through to the WebAudio sample path so rhythm
        // playback continues.
        stopPremiumLoopAudio(true);
      }
    }
    if (!usingPremiumLoop && sampleBuffers.size === 0) {
      await ensureSamplesLoaded();
    }

    timingCallbacks?.stop();
    timingCallbacks = buildTimingCallbacks(
      activePlaybackRhythmAbc || currentMetadata.rhythmAbc,
      audioContext,
      !usingPremiumLoop
    );
    timingCallbacks.start(
      positionMs == null ? undefined : msToSeconds(positionMs),
      "seconds"
    );
    setIsPlaying(true);
  }

  function beginPlayback(
    positionMs?: number,
    useCountIn = false,
    startOptions?: PlaybackStartOptions
  ): Promise<void> {
    if (pendingStartPlayback) {
      return pendingStartPlayback;
    }

    const nextStart = startPlayback(
      positionMs,
      useCountIn,
      startOptions
    ).finally(() => {
      if (pendingStartPlayback === nextStart) {
        pendingStartPlayback = null;
      }
    });
    pendingStartPlayback = nextStart;
    return nextStart;
  }

  async function loadPattern(
    request: RhythmPatternRequest
  ): Promise<RhythmPatternMetadata | null> {
    stopPlayback();
    tempoPreferenceKey = null;
    lastKnownPositionMs = 0;
    resetCountInState();
    setCurrentBeatIndex(0);
    setCurrentPlaybackMarker(null);
    setCurrentPulse(0);
    setCurrentMeasure(0);
    setError(null);

    const nextMetadata = await loadRhythmPattern(options.db, request, {
      sampleBaseUrl,
    });
    setMetadata(nextMetadata);
    if (nextMetadata) {
      tempoPreferenceKey = {
        userId: request.userId,
        tuneTypeName: request.tuneTypeName?.trim() || nextMetadata.tuneTypeName,
      };
      setTempoQpmSignal(
        readStoredRhythmTempo(
          tempoPreferenceKey.userId,
          tempoPreferenceKey.tuneTypeName
        ) ?? clampTempo(nextMetadata.tempoQpm)
      );
      setIsReady(false);
    }

    return nextMetadata;
  }

  async function play(startOptions?: PlaybackStartOptions): Promise<void> {
    setError(null);
    const startPositionMs = Math.max(0, startOptions?.startPositionMs ?? 0);
    lastKnownPositionMs = startPositionMs;
    const shouldCountIn = (options.initialCountInMeasures ?? 0) > 0;
    await beginPlayback(
      startPositionMs || undefined,
      shouldCountIn,
      startOptions
    );
  }

  function stop(): void {
    stopPlayback(true);
  }

  function pause(): void {
    if (!timingCallbacks) {
      stopPremiumLoopAudio(false);
      if (activeRhythmPlayback?.ownerId === serviceInstanceId) {
        activeRhythmPlayback = null;
      }
      setIsPlaying(false);
      return;
    }

    lastKnownPositionMs = timingCallbacks.currentMillisecond();
    timingCallbacks.pause();
    stopPremiumLoopAudio(false);
    if (activeRhythmPlayback?.ownerId === serviceInstanceId) {
      activeRhythmPlayback = null;
    }
    setIsPlaying(false);
    setIsPaused(lastKnownPositionMs > 0);
  }

  async function resume(): Promise<void> {
    setError(null);
    if (lastKnownPositionMs <= 0) {
      await play();
      return;
    }

    await beginPlayback(lastKnownPositionMs, false, {
      startBeatIndex: playbackStartBeatIndex,
      startMeasure: playbackStartMeasure,
      playbackRhythmAbc: activePlaybackRhythmAbc ?? undefined,
    });
  }

  async function togglePlayback(): Promise<void> {
    if (isPlaying()) {
      stop();
      return;
    }

    await play();
  }

  async function restart(startOptions?: PlaybackStartOptions): Promise<void> {
    const startPositionMs = Math.max(0, startOptions?.startPositionMs ?? 0);
    lastKnownPositionMs = startPositionMs;
    playbackStartBeatIndex = Math.max(0, startOptions?.startBeatIndex ?? 0);
    playbackStartMeasure = Math.max(0, startOptions?.startMeasure ?? 0);
    activePlaybackRhythmAbc = startOptions?.playbackRhythmAbc?.trim() || null;
    setCurrentBeatIndex(0);
    setCurrentPlaybackMarker(null);
    setCurrentPulse(0);
    setCurrentMeasure(playbackStartMeasure);
    setIsPlaying(false);

    if (!metadata()) {
      return;
    }

    if (activeRhythmPlayback?.ownerId === serviceInstanceId) {
      activeRhythmPlayback = null;
    }
    stopPremiumLoopAudio(false);
    setIsPaused(true);
  }

  function updateRhythmAbc(nextRhythmAbc: string): void {
    const currentMetadata = metadata();
    const trimmedRhythmAbc = nextRhythmAbc.trim();

    if (!currentMetadata || !trimmedRhythmAbc) {
      return;
    }

    if (currentMetadata.rhythmAbc === trimmedRhythmAbc) {
      return;
    }

    setMetadata({
      ...currentMetadata,
      rhythmAbc: trimmedRhythmAbc,
    });
  }

  async function setTempoQpm(nextQpm: number) {
    const clamped = clampTempo(nextQpm);
    setTempoQpmSignal(clamped);
    if (tempoPreferenceKey) {
      writeStoredRhythmTempo(
        tempoPreferenceKey.userId,
        tempoPreferenceKey.tuneTypeName,
        clamped
      );
    }
    if (!metadata() || !isPlaying()) {
      return;
    }

    lastKnownPositionMs =
      timingCallbacks?.currentMillisecond() ?? lastKnownPositionMs;
    try {
      await beginPlayback(lastKnownPositionMs);
    } catch (cause: unknown) {
      setError(
        cause instanceof Error ? cause.message : "Failed to change tempo."
      );
      stopPlayback();
    }
  }

  onCleanup(() => {
    stopPlayback();
    if (ownedAudioContext && ownedAudioContext.state !== "closed") {
      void ownedAudioContext.close();
    }
    renderTarget?.remove();
    renderTarget = null;
  });

  return {
    metadata,
    tempoQpm,
    isPlaying,
    isPaused,
    isReady,
    isCountIn,
    countInPulse,
    countInTotalPulses,
    currentBeatIndex,
    currentPlaybackMarker,
    currentPulse,
    currentMeasure,
    error,
    loadPattern: async (request) => {
      try {
        return await loadPattern(request);
      } catch (cause: unknown) {
        const message =
          cause instanceof Error
            ? cause.message
            : "Failed to load rhythm pattern.";
        setError(message);
        return null;
      }
    },
    play: async (options) => {
      try {
        await play(options);
      } catch (cause: unknown) {
        const message =
          cause instanceof Error
            ? cause.message
            : "Failed to start rhythm playback.";
        setError(message);
        stopPlayback();
      }
    },
    stop,
    pause,
    resume: async () => {
      try {
        await resume();
      } catch (cause: unknown) {
        const message =
          cause instanceof Error
            ? cause.message
            : "Failed to resume rhythm playback.";
        setError(message);
        stopPlayback();
      }
    },
    restart: async (options) => {
      try {
        await restart(options);
      } catch (cause: unknown) {
        const message =
          cause instanceof Error ? cause.message : "Failed to restart rhythm.";
        setError(message);
        stopPlayback();
      }
    },
    togglePlayback: async () => {
      try {
        await togglePlayback();
      } catch (cause: unknown) {
        const message =
          cause instanceof Error
            ? cause.message
            : "Failed to toggle rhythm playback.";
        setError(message);
        stopPlayback();
      }
    },
    setTempoQpm,
    updateRhythmAbc,
  };
}
