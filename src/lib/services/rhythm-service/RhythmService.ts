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
import {
  buildSampleUrl,
  clampPremiumLoopPlaybackRate,
  createSyntheticClickBuffer,
  decodeSample,
  getAudioContextConstructor,
  getAudioElementConstructor,
  msToSeconds,
  waitForMilliseconds,
} from "@/lib/services/rhythm-service/audio-helpers";
import {
  clampTempo,
  createCountInBuffers,
  eventHasAccent,
  getCountInPulseIndices,
  getEventPulseIndex,
  getPitchPlaybackGain,
  getPitchPlaybackRate,
  getPlaybackDelaySeconds,
  getPlaybackEventMarker,
  getPlaybackPitchSelection,
  getSampleKitMapping,
  normalizePlaybackPitch,
  normalizeSampleKit,
  type PlaybackEventMarker,
  type PlaybackPitchSelection,
  parseRhythmPlaybackDebugFlag,
  parseRhythmSignatureParts,
} from "@/lib/services/rhythm-service/playback-helpers";
import {
  clearStoredRhythmSwing,
  readStoredRhythmSwing,
  writeStoredRhythmSwing,
} from "@/lib/services/rhythm-service/swing-storage";
import {
  clearStoredRhythmTempo,
  readStoredRhythmTempo,
  writeStoredRhythmTempo,
} from "@/lib/services/rhythm-service/tempo-storage";

function clampSwingPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

export type {
  RhythmPatternCandidate,
  RhythmPatternCandidateScope,
  RhythmPatternMetadata,
  RhythmPatternRequest,
  RhythmPatternType,
} from "@/lib/rhythm/pattern-loader";
export type { PlaybackEventMarker } from "@/lib/services/rhythm-service/playback-helpers";

const DEFAULT_SAMPLE_BASE_URL = (() => {
  let value = import.meta.env.VITE_R2_AUDIO_BASE_URL?.trim() ?? "";

  while (value.endsWith("/")) {
    value = value.slice(0, -1);
  }

  return value;
})();

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
const BODHRAN_DEBUG_ENV_VALUE = import.meta.env.VITE_DEBUG_RHYTHM_PLAYBACK;

export interface PlaybackStartOptions {
  startPositionMs?: number;
  startBeatIndex?: number;
  startMeasure?: number;
  playbackRhythmAbc?: string;
}

export interface RhythmService {
  metadata: Accessor<RhythmPatternMetadata | null>;
  tempoQpm: Accessor<number>;
  swingPercentage: Accessor<number>;
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
  resetTempoToDefault: () => Promise<void>;
  setSwingPercentage: (nextSwingPercentage: number) => Promise<void>;
  resetSwingToDefault: () => Promise<void>;
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

type RhythmPlaybackDebugFlag = boolean | number;

type RhythmPlaybackDebugGlobals = typeof globalThis & {
  __TT_DEBUG_RHYTHM_PLAYBACK__?: RhythmPlaybackDebugFlag;
};

export async function loadRhythmPattern(
  db: SqliteDatabase,
  request: RhythmPatternRequest,
  options?: { sampleBaseUrl?: string }
): Promise<RhythmPatternMetadata | null> {
  return loadRhythmPatternFromPatternLoader(db, request, options);
}

function getRequestedRhythmPlaybackDebugPasses(): number {
  const globalDebugFlag = (globalThis as RhythmPlaybackDebugGlobals)
    .__TT_DEBUG_RHYTHM_PLAYBACK__;
  return Math.max(
    parseRhythmPlaybackDebugFlag(BODHRAN_DEBUG_ENV_VALUE),
    parseRhythmPlaybackDebugFlag(globalDebugFlag)
  );
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
  const [swingPercentage, setSwingPercentageSignal] = createSignal(0);
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
  let remainingDebugPlaybackPasses = getRequestedRhythmPlaybackDebugPasses();
  let tempoPreferenceKey: {
    userId: string | null | undefined;
    tuneTypeName: string;
  } | null = null;
  let swingPreferenceKey: {
    userId: string | null | undefined;
    tuneTypeName: string;
  } | null = null;

  const armDebugPlaybackPasses = () => {
    const requestedDebugPasses = getRequestedRhythmPlaybackDebugPasses();
    if (requestedDebugPasses > remainingDebugPlaybackPasses) {
      remainingDebugPlaybackPasses = requestedDebugPasses;
    }
  };

  const shouldLogPlaybackDebug = () => remainingDebugPlaybackPasses > 0;

  const finishDebugPlaybackPass = () => {
    if (remainingDebugPlaybackPasses > 0) {
      remainingDebugPlaybackPasses -= 1;
    }
  };

  const logPlaybackDebug = (
    event: NoteTimingEvent,
    selection: PlaybackPitchSelection,
    resolvedPitches: number[],
    activeSampleKit: string
  ) => {
    if (!shouldLogPlaybackDebug()) {
      return;
    }

    console.info("[RhythmService] playback event", {
      sampleKit: activeSampleKit,
      measureNumber: event.measureNumber,
      measureStart: event.measureStart,
      milliseconds: event.milliseconds,
      midiPitches: selection.midiPitches,
      elementPitches: selection.elementPitches,
      playbackSource: selection.source,
      playbackPitches: selection.playbackPitches,
      resolvedPitches,
    });
  };

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
    const decodedFileCache = new Map<string, Promise<AudioBuffer>>();
    const decodedEntries = await Promise.all(
      Object.entries(kitMapping).map(async ([pitch, entry]) => {
        if (entry.kind === "file") {
          const url = options.sampleUrlBuilder
            ? options.sampleUrlBuilder(activeSampleKit, entry.fileName)
            : buildSampleUrl(sampleBaseUrl, activeSampleKit, entry.fileName);
          let bufferPromise = decodedFileCache.get(url);
          if (!bufferPromise) {
            bufferPromise = decodeSample(audioContext, fetchImpl, url);
            decodedFileCache.set(url, bufferPromise);
          }

          const buffer = await bufferPromise;
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
    const playbackDelaySeconds = getPlaybackDelaySeconds(
      metadata(),
      event,
      swingPercentage()
    );
    const hasAccent = eventHasAccent(event);
    const selection = getPlaybackPitchSelection(activeSampleKit, event);
    const resolvedPitches = selection.playbackPitches.map((playbackPitch) =>
      normalizePlaybackPitch(activeSampleKit, playbackPitch, hasAccent)
    );

    logPlaybackDebug(event, selection, resolvedPitches, activeSampleKit);

    for (const resolvedPitch of resolvedPitches) {
      const gainValue = getPitchPlaybackGain(
        activeSampleKit,
        resolvedPitch,
        event
      );
      const playbackRate = getPitchPlaybackRate(activeSampleKit, resolvedPitch);
      const buffer = sampleBuffers.get(resolvedPitch);
      if (!buffer) {
        continue;
      }

      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();
      source.buffer = buffer;
      if (
        source.playbackRate &&
        typeof source.playbackRate.value === "number"
      ) {
        source.playbackRate.value = playbackRate;
      }
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
    const countInBuffers = createCountInBuffers((entry) =>
      createSyntheticClickBuffer(audioContext, entry)
    );
    if (!countInBuffers) {
      return;
    }
    const { primaryBuffer, secondaryBuffer } = countInBuffers;
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
      throw new TypeError("ABC rhythm playback requires a browser document.");
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
          finishDebugPlaybackPass();
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
    swingPreferenceKey = null;
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
      swingPreferenceKey = {
        userId: request.userId,
        tuneTypeName: request.tuneTypeName?.trim() || nextMetadata.tuneTypeName,
      };
      setTempoQpmSignal(
        readStoredRhythmTempo(
          tempoPreferenceKey.userId,
          tempoPreferenceKey.tuneTypeName
        ) ?? clampTempo(nextMetadata.tempoQpm)
      );
      setSwingPercentageSignal(
        readStoredRhythmSwing(
          swingPreferenceKey.userId,
          swingPreferenceKey.tuneTypeName
        ) ?? clampSwingPercentage(nextMetadata.swingPercentage)
      );
      setIsReady(false);
    }

    return nextMetadata;
  }

  async function play(startOptions?: PlaybackStartOptions): Promise<void> {
    setError(null);
    armDebugPlaybackPasses();
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
    armDebugPlaybackPasses();
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

  async function resetTempoToDefault() {
    const defaultTempo = clampTempo(metadata()?.tempoQpm ?? 100);
    setTempoQpmSignal(defaultTempo);
    if (tempoPreferenceKey) {
      clearStoredRhythmTempo(
        tempoPreferenceKey.userId,
        tempoPreferenceKey.tuneTypeName
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
        cause instanceof Error ? cause.message : "Failed to reset tempo."
      );
      stopPlayback();
    }
  }

  async function setSwingPercentage(nextSwingPercentage: number) {
    const clamped = clampSwingPercentage(nextSwingPercentage);
    setSwingPercentageSignal(clamped);
    if (swingPreferenceKey) {
      writeStoredRhythmSwing(
        swingPreferenceKey.userId,
        swingPreferenceKey.tuneTypeName,
        clamped
      );
    }
    // Swing changes take effect on next play/restart — no in-flight restart needed
  }

  async function resetSwingToDefault() {
    const defaultSwing = clampSwingPercentage(metadata()?.swingPercentage ?? 0);
    setSwingPercentageSignal(defaultSwing);
    if (swingPreferenceKey) {
      clearStoredRhythmSwing(
        swingPreferenceKey.userId,
        swingPreferenceKey.tuneTypeName
      );
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
    swingPercentage,
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
    resetTempoToDefault,
    setSwingPercentage,
    resetSwingToDefault,
    updateRhythmAbc,
  };
}
