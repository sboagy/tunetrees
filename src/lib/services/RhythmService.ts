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
const GENERIC_CLICK_PRIMARY_PITCH = 60;
const GENERIC_CLICK_SECONDARY_PITCH = 69;
const BODHRAN_DEFAULT_STRIKE_PITCH = 28;
const BODHRAN_DEFAULT_EDGE_PITCH = 47;
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

const DEFAULT_TEMPO_BY_TYPE: Record<string, number> = {
  reel: 100,
  hornpipe: 90,
  jig: 115,
  "jig (single)": 105,
  "slip jig": 110,
  polka: 120,
};
const RHYTHM_TEMPO_STORAGE_KEY_PREFIX = "tunetrees.rhythm-tempo";

const GENRE_NAME_ALIASES: Record<string, string> = {
  itrad: "irish traditional",
  "irish traditional music": "irish traditional",
};

const TUNE_TYPE_NAME_ALIASES: Record<string, string> = {
  air: "air",
  bdnce: "barn dance",
  "barn dance": "barn dance",
  hland: "highland",
  highland: "highland",
  hpipe: "hornpipe",
  hornpipe: "hornpipe",
  jigd: "jig",
  jig: "jig",
  "double jig": "jig",
  jigsl: "slip jig",
  "slip jig": "slip jig",
  sgjig: "jig (single)",
  "single jig": "jig (single)",
  "jig (single)": "jig (single)",
  mzrka: "mazurka",
  mazurka: "mazurka",
  piece: "piece",
  polka: "polka",
  reel: "reel",
  sgreel: "reel",
  schot: "schottische",
  schottische: "schottische",
  setd: "set dance",
  "set dance": "set dance",
  slide: "slide",
  song: "song",
  strath: "strathspey",
  strathspey: "strathspey",
  "three-two": "3/2 hornpipe",
  waltz: "waltz",
};

const TUNE_TYPE_LOOKUP_VARIANTS: Record<string, readonly string[]> = {
  hpipe: ["Hpipe", "Hornpipe"],
  hornpipe: ["Hornpipe", "Hpipe"],
  jigd: ["JigD", "Jig", "Double Jig"],
  jig: ["Jig", "JigD", "Double Jig"],
  jigsl: ["JigSl", "Slip Jig"],
  "slip jig": ["Slip Jig", "JigSl"],
  sgjig: ["SgJig", "Jig (Single)", "Single Jig"],
  "single jig": ["Single Jig", "Jig (Single)", "SgJig"],
  "jig (single)": ["Jig (Single)", "Single Jig", "SgJig"],
  sgreel: ["SgReel", "Single Reel", "Reel"],
  reel: ["Reel", "SgReel", "Single Reel"],
  setd: ["SetD", "Set Dance"],
  "set dance": ["Set Dance", "SetD"],
  strath: ["Strath", "Strathspey"],
  strathspey: ["Strathspey", "Strath"],
};

export interface RhythmPatternRequest {
  genreName?: string | null;
  tuneTypeName?: string | null;
  tuneId?: string | null;
  userId?: string | null;
}

export type RhythmPatternType = "seed" | "full_track";

export interface RhythmPatternMetadata {
  genreName: string | null;
  tuneTypeName: string;
  rhythmAbc: string;
  rhythmSignature: string | null;
  tuneStructure?: string | null;
  patternType: RhythmPatternType;
  tempoQpm: number;
  sampleKit: string;
  premiumAudioUrl: string | null;
  premiumAudioTrimMs: number;
  premiumAudioSource: "database" | null;
  premiumAudioSourceTempoQpm: number | null;
  source: "rhythm_patterns" | "tune_type_fallback";
}

export interface PlaybackStartOptions {
  startPositionMs?: number;
  startBeatIndex?: number;
  startMeasure?: number;
  playbackRhythmAbc?: string;
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

function normalizeTuneTypeName(value: string): string {
  const normalized = value.trim().toLowerCase();
  return TUNE_TYPE_NAME_ALIASES[normalized] ?? normalized;
}

function getTuneTypeLookupCandidates(value: string): string[] {
  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();
  const variants = TUNE_TYPE_LOOKUP_VARIANTS[normalized] ?? [trimmed];

  return Array.from(
    new Set([trimmed, ...variants].filter((candidate) => candidate.trim()))
  );
}

function normalizeGenreName(value?: string | null): string {
  const normalized = value?.trim().toLowerCase() ?? "";
  return GENRE_NAME_ALIASES[normalized] ?? normalized;
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

function normalizePatternType(patternType?: string | null): RhythmPatternType {
  return patternType === "full_track" ? "full_track" : "seed";
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

function normalizePremiumAudioUrl(baseUrl: string, value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) {
    return trimmed;
  }

  const normalizedBase = baseUrl.replace(/\/+$/, "");
  return normalizedBase ? `${normalizedBase}/${trimmed}` : `/${trimmed}`;
}

function selectPremiumLoop(
  sampleBaseUrl: string,
  request: {
    explicitUrl?: string | null;
    tempoQpm: number;
  }
): PremiumLoopSelection | null {
  const explicitUrl = request.explicitUrl?.trim();
  if (!explicitUrl) {
    return null;
  }

  return {
    source: "database",
    url: normalizePremiumAudioUrl(sampleBaseUrl, explicitUrl),
    sourceTempoQpm: request.tempoQpm,
    trimMs: 0,
  };
}

function msToSeconds(value: number): number {
  return value / 1000;
}

function waitForMilliseconds(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
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
    "6/8": { noteLength: "1/8", pattern: "|: !accent!C2 c C c c :|" },
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
  const hasTuneIdColumn = rhythmPatternColumns.has("tune_id");
  const hasUserIdColumn = rhythmPatternColumns.has("user_id");
  const hasPatternTypeColumn = rhythmPatternColumns.has("pattern_type");
  const canUseHierarchicalOverrides = hasTuneIdColumn && hasUserIdColumn;
  const sampleBaseUrl = options?.sampleBaseUrl ?? DEFAULT_SAMPLE_BASE_URL;
  const tuneTypeLookupCandidates = getTuneTypeLookupCandidates(tuneTypeName);
  const tuneTypeMatchClause = sql.join(
    tuneTypeLookupCandidates.map(
      (candidate) =>
        sql`lower(id) = lower(${candidate}) OR lower(name) = lower(${candidate})`
    ),
    sql` OR `
  );

  const genreFilter = request.genreName?.trim() || null;
  const tuneIdFilter = request.tuneId?.trim() || null;
  const userIdFilter = request.userId?.trim() || null;

  if (canUseRhythmPatterns) {
    const rows = await db.all<{
      genre_name: string | null;
      tune_type_name: string | null;
      rhythm_signature: string | null;
      tempo_qpm: number | null;
      abc_string: string | null;
      sample_kit: string | null;
      premium_audio_url: string | null;
      pattern_type: string | null;
    }>(sql`
      WITH tune_type_match AS (
        SELECT id, name, rhythm
        FROM tune_type
        WHERE (${tuneTypeMatchClause})
        ORDER BY
          CASE
            WHEN lower(id) = lower(${tuneTypeName}) THEN 0
            WHEN lower(name) = lower(${tuneTypeName}) THEN 1
            ELSE 2
          END,
          length(coalesce(name, id))
        LIMIT 1
      ),
      genre_match AS (
        SELECT id, name
        FROM genre
        WHERE ${genreFilter} IS NOT NULL
          AND (
            lower(name) = lower(${genreFilter})
            OR lower(id) = lower(${genreFilter})
          )
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
          ${
            hasPatternTypeColumn
              ? sql`rp.pattern_type`
              : sql`CAST('seed' AS TEXT)`
          } AS pattern_type,
          rp.is_default,
          rp.part_target,
          ROW_NUMBER() OVER (
            ORDER BY
              ${
                canUseHierarchicalOverrides
                  ? sql`
                    CASE
                      WHEN ${userIdFilter} IS NOT NULL
                       AND ${tuneIdFilter} IS NOT NULL
                       AND rp.user_id = ${userIdFilter}
                       AND rp.tune_id = ${tuneIdFilter} THEN 0
                      WHEN ${tuneIdFilter} IS NOT NULL
                       AND rp.user_id IS NULL
                       AND rp.tune_id = ${tuneIdFilter} THEN 1
                      WHEN ${userIdFilter} IS NOT NULL
                       AND rp.user_id = ${userIdFilter}
                       AND rp.tune_id IS NULL THEN 2
                      WHEN rp.user_id IS NULL
                       AND rp.tune_id IS NULL
                       AND rp.is_default THEN 3
                      WHEN rp.user_id IS NULL
                       AND rp.tune_id IS NULL THEN 4
                      ELSE 5
                    END,
                  `
                  : sql``
              }
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
          AND ${
            canUseHierarchicalOverrides
              ? sql`
                (
                  (${userIdFilter} IS NOT NULL
                    AND ${tuneIdFilter} IS NOT NULL
                    AND rp.user_id = ${userIdFilter}
                    AND rp.tune_id = ${tuneIdFilter})
                  OR (${tuneIdFilter} IS NOT NULL
                    AND rp.user_id IS NULL
                    AND rp.tune_id = ${tuneIdFilter})
                  OR (${userIdFilter} IS NOT NULL
                    AND rp.user_id = ${userIdFilter}
                    AND rp.tune_id IS NULL)
                  OR (rp.user_id IS NULL AND rp.tune_id IS NULL)
                )
              `
              : sql`1 = 1`
          }
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
        sp.premium_audio_url AS premium_audio_url,
        sp.pattern_type AS pattern_type
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
        tempoQpm: resolvedTempoQpm,
      });

      return {
        genreName: row.genre_name ?? genreFilter,
        tuneTypeName: row.tune_type_name,
        rhythmSignature: row.rhythm_signature ?? null,
        rhythmAbc: row.abc_string.trim(),
        patternType: normalizePatternType(row.pattern_type),
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
        WHERE (${tuneTypeMatchClause})
        ORDER BY
          CASE
            WHEN lower(id) = lower(${tuneTypeName}) THEN 0
            WHEN lower(name) = lower(${tuneTypeName}) THEN 1
            ELSE 2
          END,
          length(coalesce(name, id))
        LIMIT 1
      ),
      genre_match AS (
        SELECT id, name
        FROM genre
        WHERE ${genreFilter} IS NOT NULL
          AND (
            lower(name) = lower(${genreFilter})
            OR lower(id) = lower(${genreFilter})
          )
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

      return {
        genreName: row.genre_name ?? genreFilter,
        tuneTypeName: row.tune_type_name,
        rhythmSignature: row.rhythm_signature ?? null,
        rhythmAbc: buildFallbackRhythmAbc(
          row.tune_type_name,
          row.rhythm_signature ?? null
        ),
        patternType: "seed",
        tempoQpm: resolvedTempoQpm,
        sampleKit: DEFAULT_SAMPLE_KIT,
        premiumAudioUrl: null,
        premiumAudioTrimMs: 0,
        premiumAudioSource: null,
        premiumAudioSourceTempoQpm: null,
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
    WHERE (${tuneTypeMatchClause})
    ORDER BY
      CASE
        WHEN lower(id) = lower(${tuneTypeName}) THEN 0
        WHEN lower(name) = lower(${tuneTypeName}) THEN 1
        ELSE 2
      END,
      length(coalesce(name, id))
    LIMIT 1
  `);

  const fallbackRow = fallbackRows[0];
  if (!fallbackRow?.tune_type_name) {
    return null;
  }

  return {
    genreName: genreFilter ? normalizeGenreName(genreFilter) : null,
    tuneTypeName: fallbackRow.tune_type_name,
    rhythmSignature: fallbackRow.rhythm_signature ?? null,
    rhythmAbc: buildFallbackRhythmAbc(
      fallbackRow.tune_type_name,
      fallbackRow.rhythm_signature ?? null
    ),
    patternType: "seed",
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
        if (event.measureStart) {
          setCurrentMeasure(
            playbackStartMeasure + (event.measureNumber ?? currentMeasure())
          );
        }
        currentEventIndex += 1;
        setCurrentBeatIndex(currentEventIndex);
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
    setCurrentPulse(0);
    setCurrentMeasure(0);
    setError(null);

    const nextMetadata = await loadRhythmPatternMetadata(options.db, request, {
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
