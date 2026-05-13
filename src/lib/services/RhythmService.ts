import abcjs, {
  type AnimationOptions,
  type BeatCallback,
  type NoteTimingEvent,
  type TuneObject,
} from "abcjs";
import { sql } from "drizzle-orm";
import { type Accessor, createSignal, onCleanup } from "solid-js";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";

const DEFAULT_SAMPLE_BASE_URL = (
  import.meta.env.VITE_R2_AUDIO_BASE_URL?.trim() ?? ""
).replace(/\/+$/, "");
const DEFAULT_SAMPLE_KIT = "generic_click";
const REQUIRED_RHYTHM_PATTERN_COLUMNS = [
  "abc_string",
  "genre_id",
  "is_default",
  "name",
  "part_target",
  "tune_type_id",
] as const;

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

type PremiumLoopEntry = {
  tempoQpm: number;
  fileName: string;
  trimMs: number;
};

type PremiumLoopLibrary = {
  genreId: string;
  sampleKit: string;
  performerSlug: string;
  entries: readonly PremiumLoopEntry[];
};

type PremiumLoopSelection = {
  source: "database" | "registry";
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
    60: { kind: "file", fileName: "bass.mp3" },
    69: { kind: "file", fileName: "rim.mp3" },
  },
  generic_click: {
    60: { kind: "synthetic", durationMs: 30, frequency: 1760 },
    69: { kind: "synthetic", durationMs: 20, frequency: 880 },
  },
};

const PREMIUM_LOOP_LIBRARY: Record<string, PremiumLoopLibrary> = {
  "irish traditional::reel": {
    genreId: "ITRAD",
    sampleKit: "bodhran",
    performerSlug: "santigaitero",
    entries: [
      { tempoQpm: 50, fileName: "C4.mp3", trimMs: 0 },
      { tempoQpm: 55, fileName: "Db4.mp3", trimMs: 0 },
      { tempoQpm: 60, fileName: "D4.mp3", trimMs: 0 },
      { tempoQpm: 65, fileName: "Eb4.mp3", trimMs: 0 },
      { tempoQpm: 70, fileName: "E4.mp3", trimMs: 0 },
      { tempoQpm: 75, fileName: "F4.mp3", trimMs: 0 },
      { tempoQpm: 80, fileName: "Gb4.mp3", trimMs: 0 },
      { tempoQpm: 90, fileName: "G4.mp3", trimMs: 0 },
      { tempoQpm: 100, fileName: "Ab4.mp3", trimMs: 0 },
      { tempoQpm: 110, fileName: "A4.mp3", trimMs: 0 },
      { tempoQpm: 120, fileName: "Bb4.mp3", trimMs: 0 },
      { tempoQpm: 130, fileName: "C6.mp3", trimMs: 0 },
      { tempoQpm: 140, fileName: "Db6.mp3", trimMs: 0 },
    ],
  },
  "irish traditional::jig": {
    genreId: "ITRAD",
    sampleKit: "bodhran",
    performerSlug: "santigaitero",
    entries: [
      { tempoQpm: 50, fileName: "C5.mp3", trimMs: 0 },
      { tempoQpm: 55, fileName: "Db5.mp3", trimMs: 0 },
      { tempoQpm: 60, fileName: "D5.mp3", trimMs: 0 },
      { tempoQpm: 65, fileName: "Eb5.mp3", trimMs: 0 },
      { tempoQpm: 70, fileName: "E5.mp3", trimMs: 0 },
      { tempoQpm: 75, fileName: "F5.mp3", trimMs: 0 },
      { tempoQpm: 80, fileName: "Gb5.mp3", trimMs: 0 },
      { tempoQpm: 90, fileName: "G5.mp3", trimMs: 0 },
      { tempoQpm: 100, fileName: "Ab5.mp3", trimMs: 0 },
      { tempoQpm: 110, fileName: "A5.mp3", trimMs: 0 },
      { tempoQpm: 120, fileName: "Bb5.mp3", trimMs: 0 },
      { tempoQpm: 130, fileName: "D6.mp3", trimMs: 0 },
      { tempoQpm: 140, fileName: "Eb6.mp3", trimMs: 0 },
    ],
  },
  "irish traditional::polka": {
    genreId: "ITRAD",
    sampleKit: "bodhran",
    performerSlug: "santigaitero",
    entries: [
      { tempoQpm: 70, fileName: "C3.mp3", trimMs: 0 },
      { tempoQpm: 80, fileName: "Db3.mp3", trimMs: 0 },
      { tempoQpm: 90, fileName: "D3.mp3", trimMs: 0 },
      { tempoQpm: 100, fileName: "Eb3.mp3", trimMs: 0 },
      { tempoQpm: 110, fileName: "E3.mp3", trimMs: 0 },
      { tempoQpm: 120, fileName: "F3.mp3", trimMs: 0 },
      { tempoQpm: 130, fileName: "Gb3.mp3", trimMs: 0 },
      { tempoQpm: 140, fileName: "G3.mp3", trimMs: 0 },
      { tempoQpm: 150, fileName: "E6.mp3", trimMs: 0 },
      { tempoQpm: 160, fileName: "F6.mp3", trimMs: 0 },
    ],
  },
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
  premiumAudioUrl: string | null;
  premiumAudioTrimMs: number;
  premiumAudioSource: "database" | "registry" | null;
  premiumAudioSourceTempoQpm: number | null;
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
  audioElementFactory?: (sourceUrl: string) => PremiumLoopAudio;
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

function normalizeGenreName(value?: string | null): string {
  return value?.trim().toLowerCase() ?? "";
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

function buildPremiumLoopUrl(
  baseUrl: string,
  library: PremiumLoopLibrary,
  fileName: string
): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const assetPath = `audio/loops/${library.genreId}/${library.sampleKit}/${library.performerSlug}/${fileName}`;
  return normalizedBase ? `${normalizedBase}/${assetPath}` : `/${assetPath}`;
}

function normalizePremiumAudioUrl(baseUrl: string, value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) {
    return trimmed;
  }

  const normalizedBase = baseUrl.replace(/\/+$/, "");
  return normalizedBase ? `${normalizedBase}/${trimmed}` : `/${trimmed}`;
}

function selectNearestPremiumLoopEntry(
  entries: readonly PremiumLoopEntry[],
  targetTempoQpm: number
): PremiumLoopEntry | null {
  const [selected] = [...entries].sort((left, right) => {
    const leftDelta = Math.abs(left.tempoQpm - targetTempoQpm);
    const rightDelta = Math.abs(right.tempoQpm - targetTempoQpm);

    if (leftDelta !== rightDelta) {
      return leftDelta - rightDelta;
    }

    return left.tempoQpm - right.tempoQpm;
  });

  return selected ?? null;
}

function selectPremiumLoop(
  sampleBaseUrl: string,
  request: {
    explicitUrl?: string | null;
    genreName?: string | null;
    tuneTypeName: string;
    tempoQpm: number;
  }
): PremiumLoopSelection | null {
  const explicitUrl = request.explicitUrl?.trim();
  if (explicitUrl) {
    return {
      source: "database",
      url: normalizePremiumAudioUrl(sampleBaseUrl, explicitUrl),
      sourceTempoQpm: request.tempoQpm,
      trimMs: 0,
    };
  }

  const library =
    PREMIUM_LOOP_LIBRARY[
      `${normalizeGenreName(request.genreName)}::${normalizeTuneTypeName(
        request.tuneTypeName
      )}`
    ];
  if (!library) {
    return null;
  }

  const entry = selectNearestPremiumLoopEntry(
    library.entries,
    request.tempoQpm
  );
  if (!entry) {
    return null;
  }

  return {
    source: "registry",
    url: buildPremiumLoopUrl(sampleBaseUrl, library, entry.fileName),
    sourceTempoQpm: entry.tempoQpm,
    trimMs: entry.trimMs,
  };
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
  request: RhythmPatternRequest,
  options?: { sampleBaseUrl?: string }
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
  const hasSampleKitColumn = rhythmPatternColumns.has("sample_kit");
  const hasPremiumAudioUrlColumn =
    rhythmPatternColumns.has("premium_audio_url");
  const sampleBaseUrl = options?.sampleBaseUrl ?? DEFAULT_SAMPLE_BASE_URL;

  const genreFilter = request.genreName?.trim() || null;

  if (canUseRhythmPatterns) {
    const rows = await db.all<{
      genre_name: string | null;
      tune_type_name: string | null;
      rhythm_signature: string | null;
      tempo_qpm: number | null;
      abc_string: string | null;
      sample_kit: string | null;
      premium_audio_url: string | null;
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
          ${
            hasSampleKitColumn ? sql`rp.sample_kit` : sql`CAST(NULL AS TEXT)`
          } AS sample_kit,
          ${
            hasPremiumAudioUrlColumn
              ? sql`rp.premium_audio_url`
              : sql`CAST(NULL AS TEXT)`
          } AS premium_audio_url,
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
        sp.abc_string AS abc_string,
        sp.sample_kit AS sample_kit,
        sp.premium_audio_url AS premium_audio_url
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
      const resolvedTempoQpm =
        typeof row.tempo_qpm === "number" && Number.isFinite(row.tempo_qpm)
          ? row.tempo_qpm
          : getDefaultTempoForTuneType(row.tune_type_name);
      const premiumLoop = selectPremiumLoop(sampleBaseUrl, {
        explicitUrl: row.premium_audio_url,
        genreName: row.genre_name ?? genreFilter,
        tuneTypeName: row.tune_type_name,
        tempoQpm: resolvedTempoQpm,
      });

      return {
        genreName: row.genre_name ?? genreFilter,
        tuneTypeName: row.tune_type_name,
        rhythmSignature: row.rhythm_signature ?? null,
        rhythmAbc: row.abc_string.trim(),
        tempoQpm: resolvedTempoQpm,
        sampleKit: normalizeSampleKit(row.sample_kit),
        premiumAudioUrl: premiumLoop?.url ?? null,
        premiumAudioTrimMs: premiumLoop?.trimMs ?? 0,
        premiumAudioSource: premiumLoop?.source ?? null,
        premiumAudioSourceTempoQpm: premiumLoop?.sourceTempoQpm ?? null,
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
      const resolvedTempoQpm =
        typeof row.tempo_qpm === "number" && Number.isFinite(row.tempo_qpm)
          ? row.tempo_qpm
          : getDefaultTempoForTuneType(row.tune_type_name);
      const premiumLoop = selectPremiumLoop(sampleBaseUrl, {
        genreName: row.genre_name ?? genreFilter,
        tuneTypeName: row.tune_type_name,
        tempoQpm: resolvedTempoQpm,
      });

      return {
        genreName: row.genre_name ?? genreFilter,
        tuneTypeName: row.tune_type_name,
        rhythmSignature: row.rhythm_signature ?? null,
        rhythmAbc: buildFallbackRhythmAbc(
          row.tune_type_name,
          row.rhythm_signature ?? null
        ),
        tempoQpm: resolvedTempoQpm,
        sampleKit: DEFAULT_SAMPLE_KIT,
        premiumAudioUrl: premiumLoop?.url ?? null,
        premiumAudioTrimMs: premiumLoop?.trimMs ?? 0,
        premiumAudioSource: premiumLoop?.source ?? null,
        premiumAudioSourceTempoQpm: premiumLoop?.sourceTempoQpm ?? null,
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
    premiumAudioUrl: null,
    premiumAudioTrimMs: 0,
    premiumAudioSource: null,
    premiumAudioSourceTempoQpm: null,
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
  let loadedSampleKit: string | null = null;
  let premiumLoopAudio: PremiumLoopAudio | null = null;
  let premiumLoopUrl: string | null = null;
  let renderTarget: HTMLDivElement | null = null;

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
    setIsPlaying(false);
  };

  function resolvePremiumLoopSelection(
    currentMetadata: RhythmPatternMetadata,
    targetTempoQpm: number
  ): PremiumLoopSelection | null {
    if (currentMetadata.premiumAudioSource === "database") {
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

    return selectPremiumLoop(sampleBaseUrl, {
      genreName: currentMetadata.genreName,
      tuneTypeName: currentMetadata.tuneTypeName,
      tempoQpm: targetTempoQpm,
    });
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
        const buffer =
          entry.kind === "file"
            ? await decodeSample(
                audioContext,
                fetchImpl,
                options.sampleUrlBuilder
                  ? options.sampleUrlBuilder(activeSampleKit, entry.fileName)
                  : buildSampleUrl(
                      sampleBaseUrl,
                      activeSampleKit,
                      entry.fileName
                    )
              )
            : createSyntheticClickBuffer(audioContext, entry);
        return [Number(pitch), buffer] as const;
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
        if (shouldPlayEventSamples) {
          playEventPitches(event, audioContext);
        }
      },
    };

    return new resolvedAbcjs.TimingCallbacks(visualObj, animationOptions);
  }

  async function startPlayback(positionMs?: number) {
    const currentMetadata = metadata();
    if (!currentMetadata) {
      throw new Error("Rhythm pattern metadata has not been loaded.");
    }

    const premiumLoopSelection = resolvePremiumLoopSelection(
      currentMetadata,
      tempoQpm()
    );
    if (premiumLoopSelection) {
      await startPremiumLoopAudio(premiumLoopSelection, tempoQpm(), positionMs);
    } else {
      await ensureSamplesLoaded();
    }

    const audioContext = await ensureAudioContext();
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    timingCallbacks?.stop();
    timingCallbacks = buildTimingCallbacks(
      currentMetadata.rhythmAbc,
      audioContext,
      premiumLoopSelection == null
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

    const nextMetadata = await loadRhythmPatternMetadata(options.db, request, {
      sampleBaseUrl,
    });
    setMetadata(nextMetadata);
    if (nextMetadata) {
      setTempoQpmSignal(clampTempo(nextMetadata.tempoQpm));
      setIsReady(false);
    }

    return nextMetadata;
  }

  async function play(): Promise<void> {
    setError(null);
    await startPlayback(lastKnownPositionMs || undefined);
  }

  function pause(): void {
    if (!timingCallbacks) {
      stopPremiumLoopAudio(false);
      setIsPlaying(false);
      return;
    }

    lastKnownPositionMs = timingCallbacks.currentMillisecond();
    timingCallbacks.pause();
    stopPremiumLoopAudio(false);
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
