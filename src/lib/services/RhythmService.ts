import abcjs, {
  type AnimationOptions,
  type BeatCallback,
  type NoteTimingEvent,
  type TuneObject,
} from "abcjs";
import { sql } from "drizzle-orm";
import { type Accessor, createSignal, onCleanup } from "solid-js";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";

const DEFAULT_SAMPLE_BASE_URL = "/samples/bodhran";
const DEFAULT_SAMPLE_KIT = "bodhran_bosone";
const REQUIRED_RHYTHM_PATTERN_COLUMNS = [
  "abc_string",
  "genre_id",
  "is_default",
  "name",
  "part_target",
  "tune_type_id",
] as const;
const SAMPLE_FILE_BY_PITCH: Record<number, string> = {
  60: "bass.mp3",
  69: "rim.mp3",
};
const DEFAULT_TEMPO_BY_TYPE: Record<string, number> = {
  reel: 100,
  hornpipe: 90,
  jig: 115,
  "jig (single)": 105,
  "slip jig": 110,
  polka: 120,
};

export interface RhythmPatternRequest {
  genreName?: string | null;
  tuneTypeName?: string | null;
}

export interface RhythmPatternMetadata {
  genreName: string | null;
  tuneTypeName: string;
  rhythmAbc: string;
  rhythmSignature: string | null;
  tuneStructure?: string | null;
  tempoQpm: number;
  sampleKit: string;
  source: "rhythm_patterns" | "tune_type_fallback";
}

export interface RhythmService {
  metadata: Accessor<RhythmPatternMetadata | null>;
  tempoQpm: Accessor<number>;
  isPlaying: Accessor<boolean>;
  isReady: Accessor<boolean>;
  currentBeatIndex: Accessor<number>;
  currentMeasure: Accessor<number>;
  error: Accessor<string | null>;
  loadPattern: (
    request: RhythmPatternRequest
  ) => Promise<RhythmPatternMetadata | null>;
  play: () => Promise<void>;
  pause: () => void;
  restart: () => Promise<void>;
  togglePlayback: () => Promise<void>;
  setTempoQpm: (nextQpm: number) => Promise<void>;
  updateRhythmAbc: (nextRhythmAbc: string) => void;
}

export interface CreateRhythmServiceOptions {
  db: SqliteDatabase;
  abcjsModule?: Pick<typeof abcjs, "renderAbc" | "TimingCallbacks">;
  audioContext?: AudioContext;
  fetchImpl?: typeof fetch;
  sampleBaseUrl?: string;
  sampleUrlBuilder?: (sampleKit: string, fileName: string) => string;
}

type ResolvedAbcjsModule = NonNullable<
  CreateRhythmServiceOptions["abcjsModule"]
>;
type TimingCallbacksInstance = InstanceType<
  ResolvedAbcjsModule["TimingCallbacks"]
>;

function normalizeTuneTypeName(value: string): string {
  return value.trim().toLowerCase();
}

function sanitizeAbcTitle(value: string): string {
  return value.replace(/[\r\n:|[\]]+/g, " ").trim() || "Rhythm";
}

async function tableExists(
  db: SqliteDatabase,
  tableName: string
): Promise<boolean> {
  const rows = await db.all<{ name: string }>(sql`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name = ${tableName}
    LIMIT 1
  `);

  return rows.length > 0;
}

async function getTableColumns(
  db: SqliteDatabase,
  tableName: string
): Promise<Set<string>> {
  const rows = await db.all<{ name: string }>(
    sql.raw(`PRAGMA table_info("${tableName}")`)
  );
  return new Set(rows.map((row) => row.name));
}

function getDefaultTempoForTuneType(tuneTypeName: string): number {
  return DEFAULT_TEMPO_BY_TYPE[normalizeTuneTypeName(tuneTypeName)] ?? 100;
}

function msToSeconds(value: number): number {
  return value / 1000;
}

function buildFallbackRhythmAbc(
  tuneTypeName: string,
  rhythmSignature: string | null
): string {
  const meter = rhythmSignature?.trim() || "4/4";

  const patternByMeter: Record<
    string,
    { noteLength: string; pattern: string }
  > = {
    "2/4": { noteLength: "1/8", pattern: "|: !accent!C2 A2 :|" },
    "3/4": { noteLength: "1/8", pattern: "|: !accent!C2 A2 A2 :|" },
    "4/4": { noteLength: "1/8", pattern: "|: !accent!C2 A2 C2 A2 :|" },
    "6/8": { noteLength: "1/8", pattern: "|: !accent!C2 A C2 A :|" },
    "9/8": {
      noteLength: "1/8",
      pattern: "|: !accent!C2 A C2 A C2 A :|",
    },
    "12/8": {
      noteLength: "1/8",
      pattern: "|: !accent!C2 A C2 A C2 A C2 A :|",
    },
    "3/2": {
      noteLength: "1/8",
      pattern: "|: !accent!C2 A2 C2 A2 C2 A2 :|",
    },
  };

  const fallback = patternByMeter[meter] ?? patternByMeter["4/4"];

  return [
    "X:1",
    `T:${sanitizeAbcTitle(tuneTypeName)} Rhythm`,
    `M:${meter}`,
    `L:${fallback.noteLength}`,
    "Q:1/4=100",
    "K:clef=perc",
    fallback.pattern,
  ].join("\n");
}

export async function loadRhythmPatternMetadata(
  db: SqliteDatabase,
  request: RhythmPatternRequest
): Promise<RhythmPatternMetadata | null> {
  const tuneTypeName = request.tuneTypeName?.trim();
  if (!tuneTypeName) {
    return null;
  }

  const hasGenreDefaultBpmColumn = (await tableExists(db, "genre_tune_type"))
    ? (await getTableColumns(db, "genre_tune_type")).has("default_bpm")
    : false;
  const hasRhythmPatternsTable = await tableExists(db, "rhythm_patterns");

  const rhythmPatternColumns = hasRhythmPatternsTable
    ? await getTableColumns(db, "rhythm_patterns")
    : new Set<string>();

  const canUseRhythmPatterns =
    hasRhythmPatternsTable &&
    REQUIRED_RHYTHM_PATTERN_COLUMNS.every((column) =>
      rhythmPatternColumns.has(column)
    );

  const genreFilter = request.genreName?.trim() || null;

  if (canUseRhythmPatterns) {
    const rows = await db.all<{
      genre_name: string | null;
      tune_type_name: string | null;
      rhythm_signature: string | null;
      tempo_qpm: number | null;
      abc_string: string | null;
    }>(sql`
      WITH tune_type_match AS (
        SELECT id, name, rhythm
        FROM tune_type
        WHERE lower(name) = lower(${tuneTypeName})
        LIMIT 1
      ),
      genre_match AS (
        SELECT id, name
        FROM genre
        WHERE ${genreFilter} IS NOT NULL
          AND lower(name) = lower(${genreFilter})
        LIMIT 1
      ),
      selected_pattern AS (
        SELECT
          rp.genre_id,
          rp.tune_type_id,
          rp.abc_string,
          rp.is_default,
          rp.part_target,
          ROW_NUMBER() OVER (
            ORDER BY
              CASE WHEN rp.is_default THEN 0 ELSE 1 END,
              CASE
                WHEN rp.part_target IS NULL OR rp.part_target = '*' THEN 0
                ELSE 1
              END,
              rp.name
          ) AS row_num
        FROM rhythm_patterns rp
        JOIN tune_type_match ttm ON rp.tune_type_id = ttm.id
        LEFT JOIN genre_match gm ON 1 = 1
        WHERE (gm.id IS NULL OR rp.genre_id = gm.id)
      )
      SELECT
        gm.name AS genre_name,
        ttm.name AS tune_type_name,
        ttm.rhythm AS rhythm_signature,
        ${
          hasGenreDefaultBpmColumn
            ? sql`gtt.default_bpm`
            : sql`CAST(NULL AS INTEGER)`
        } AS tempo_qpm,
        sp.abc_string AS abc_string
      FROM tune_type_match ttm
      LEFT JOIN genre_match gm ON 1 = 1
      LEFT JOIN genre_tune_type gtt
        ON gtt.tune_type_id = ttm.id
       AND (gm.id IS NULL OR gtt.genre_id = gm.id)
      LEFT JOIN selected_pattern sp ON sp.row_num = 1
      LIMIT 1
    `);

    const row = rows[0];
    if (row?.tune_type_name && row.abc_string?.trim()) {
      return {
        genreName: row.genre_name ?? genreFilter,
        tuneTypeName: row.tune_type_name,
        rhythmSignature: row.rhythm_signature ?? null,
        rhythmAbc: row.abc_string.trim(),
        tempoQpm:
          typeof row.tempo_qpm === "number" && Number.isFinite(row.tempo_qpm)
            ? row.tempo_qpm
            : getDefaultTempoForTuneType(row.tune_type_name),
        sampleKit: DEFAULT_SAMPLE_KIT,
        source: "rhythm_patterns",
      };
    }
  }

  if (hasGenreDefaultBpmColumn) {
    const rows = await db.all<{
      genre_name: string | null;
      tune_type_name: string | null;
      rhythm_signature: string | null;
      tempo_qpm: number | null;
    }>(sql`
      WITH tune_type_match AS (
        SELECT id, name, rhythm
        FROM tune_type
        WHERE lower(name) = lower(${tuneTypeName})
        LIMIT 1
      ),
      genre_match AS (
        SELECT id, name
        FROM genre
        WHERE ${genreFilter} IS NOT NULL
          AND lower(name) = lower(${genreFilter})
        LIMIT 1
      )
      SELECT
        gm.name AS genre_name,
        ttm.name AS tune_type_name,
        ttm.rhythm AS rhythm_signature,
        gtt.default_bpm AS tempo_qpm
      FROM tune_type_match ttm
      LEFT JOIN genre_match gm ON 1 = 1
      LEFT JOIN genre_tune_type gtt
        ON gtt.tune_type_id = ttm.id
       AND (gm.id IS NULL OR gtt.genre_id = gm.id)
      LIMIT 1
    `);

    const row = rows[0];
    if (row?.tune_type_name) {
      return {
        genreName: row.genre_name ?? genreFilter,
        tuneTypeName: row.tune_type_name,
        rhythmSignature: row.rhythm_signature ?? null,
        rhythmAbc: buildFallbackRhythmAbc(
          row.tune_type_name,
          row.rhythm_signature ?? null
        ),
        tempoQpm:
          typeof row.tempo_qpm === "number" && Number.isFinite(row.tempo_qpm)
            ? row.tempo_qpm
            : getDefaultTempoForTuneType(row.tune_type_name),
        sampleKit: DEFAULT_SAMPLE_KIT,
        source: "tune_type_fallback",
      };
    }
  }

  const fallbackRows = await db.all<{
    tune_type_name: string | null;
    rhythm_signature: string | null;
  }>(sql`
    SELECT name AS tune_type_name, rhythm AS rhythm_signature
    FROM tune_type
    WHERE lower(name) = lower(${tuneTypeName})
    LIMIT 1
  `);

  const fallbackRow = fallbackRows[0];
  if (!fallbackRow?.tune_type_name) {
    return null;
  }

  return {
    genreName: genreFilter,
    tuneTypeName: fallbackRow.tune_type_name,
    rhythmSignature: fallbackRow.rhythm_signature ?? null,
    rhythmAbc: buildFallbackRhythmAbc(
      fallbackRow.tune_type_name,
      fallbackRow.rhythm_signature ?? null
    ),
    tempoQpm: getDefaultTempoForTuneType(fallbackRow.tune_type_name),
    sampleKit: DEFAULT_SAMPLE_KIT,
    source: "tune_type_fallback",
  };
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

function getPitchPlaybackGain(event: NoteTimingEvent): number {
  const hasAccent = event.elements?.some((group) =>
    group.some((element) =>
      (element.getAttribute("class") ?? "").includes("abcjs-accent")
    )
  );

  return hasAccent ? 1 : 0.8;
}

export function createRhythmService(
  options: CreateRhythmServiceOptions
): RhythmService {
  const resolvedAbcjs: ResolvedAbcjsModule = options.abcjsModule ?? abcjs;
  const fetchImpl = options.fetchImpl ?? fetch;
  const sampleBaseUrl = options.sampleBaseUrl ?? DEFAULT_SAMPLE_BASE_URL;

  const [metadata, setMetadata] = createSignal<RhythmPatternMetadata | null>(
    null
  );
  const [tempoQpm, setTempoQpmSignal] = createSignal(100);
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [isReady, setIsReady] = createSignal(false);
  const [currentBeatIndex, setCurrentBeatIndex] = createSignal(0);
  const [currentMeasure, setCurrentMeasure] = createSignal(0);
  const [error, setError] = createSignal<string | null>(null);

  let timingCallbacks: TimingCallbacksInstance | null = null;
  let lastKnownPositionMs = 0;
  let ownedAudioContext: AudioContext | null = null;
  let sampleBuffers = new Map<number, AudioBuffer>();
  let renderTarget: HTMLDivElement | null = null;

  const stopPlayback = () => {
    if (timingCallbacks) {
      timingCallbacks.stop();
      timingCallbacks = null;
    }
    setIsPlaying(false);
  };

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
    if (sampleBuffers.size === Object.keys(SAMPLE_FILE_BY_PITCH).length) {
      setIsReady(true);
      return;
    }

    const audioContext = await ensureAudioContext();
    const decodedEntries = await Promise.all(
      Object.entries(SAMPLE_FILE_BY_PITCH).map(async ([pitch, fileName]) => {
        const buffer = await decodeSample(
          audioContext,
          fetchImpl,
          options.sampleUrlBuilder
            ? options.sampleUrlBuilder(DEFAULT_SAMPLE_KIT, fileName)
            : `${sampleBaseUrl}/${fileName}`
        );
        return [Number(pitch), buffer] as const;
      })
    );

    sampleBuffers = new Map(decodedEntries);
    setIsReady(true);
  }

  function playEventPitches(
    event: NoteTimingEvent,
    audioContext: AudioContext
  ) {
    if (event.type !== "event") {
      return;
    }

    const gainValue = getPitchPlaybackGain(event);
    for (const midiPitch of event.midiPitches ?? []) {
      const buffer = sampleBuffers.get(midiPitch.pitch);
      if (!buffer) {
        continue;
      }

      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();
      source.buffer = buffer;
      gainNode.gain.value = gainValue;
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      source.start();
    }
  }

  function buildTimingCallbacks(
    rhythmAbc: string,
    audioContext: AudioContext
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
      setCurrentBeatIndex(Math.max(0, Math.floor(beatNumber)));
    };

    const animationOptions: AnimationOptions = {
      qpm: tempoQpm(),
      beatCallback,
      eventCallback: (event) => {
        if (!event) {
          return;
        }
        if (event.measureStart) {
          setCurrentMeasure(event.measureNumber ?? currentMeasure());
        }
        playEventPitches(event, audioContext);
      },
    };

    return new resolvedAbcjs.TimingCallbacks(visualObj, animationOptions);
  }

  async function startPlayback(positionMs?: number) {
    const currentMetadata = metadata();
    if (!currentMetadata) {
      throw new Error("Rhythm pattern metadata has not been loaded.");
    }

    await ensureSamplesLoaded();
    const audioContext = await ensureAudioContext();
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    timingCallbacks?.stop();
    timingCallbacks = buildTimingCallbacks(
      currentMetadata.rhythmAbc,
      audioContext
    );
    timingCallbacks.start(
      positionMs == null ? undefined : msToSeconds(positionMs),
      "seconds"
    );
    setIsPlaying(true);
  }

  async function loadPattern(
    request: RhythmPatternRequest
  ): Promise<RhythmPatternMetadata | null> {
    stopPlayback();
    lastKnownPositionMs = 0;
    setCurrentBeatIndex(0);
    setCurrentMeasure(0);
    setError(null);

    const nextMetadata = await loadRhythmPatternMetadata(options.db, request);
    setMetadata(nextMetadata);
    if (nextMetadata) {
      setTempoQpmSignal(clampTempo(nextMetadata.tempoQpm));
    }

    return nextMetadata;
  }

  async function play(): Promise<void> {
    setError(null);
    await startPlayback(lastKnownPositionMs || undefined);
  }

  function pause(): void {
    if (!timingCallbacks) {
      setIsPlaying(false);
      return;
    }

    lastKnownPositionMs = timingCallbacks.currentMillisecond();
    timingCallbacks.pause();
    setIsPlaying(false);
  }

  async function togglePlayback(): Promise<void> {
    if (isPlaying()) {
      pause();
      return;
    }

    await play();
  }

  async function restart(): Promise<void> {
    lastKnownPositionMs = 0;
    setCurrentBeatIndex(0);
    setCurrentMeasure(0);

    if (!metadata()) {
      return;
    }

    if (isPlaying()) {
      await startPlayback(0);
    }
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
    if (!metadata() || !isPlaying()) {
      return;
    }

    lastKnownPositionMs =
      timingCallbacks?.currentMillisecond() ?? lastKnownPositionMs;
    try {
      await startPlayback(lastKnownPositionMs);
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
    isReady,
    currentBeatIndex,
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
    play: async () => {
      try {
        await play();
      } catch (cause: unknown) {
        const message =
          cause instanceof Error
            ? cause.message
            : "Failed to start rhythm playback.";
        setError(message);
        stopPlayback();
      }
    },
    pause,
    restart: async () => {
      try {
        await restart();
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
