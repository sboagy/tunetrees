import { sql } from "drizzle-orm";
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

const DEFAULT_TEMPO_BY_TYPE: Record<string, number> = {
  reel: 100,
  hornpipe: 90,
  jig: 115,
  "jig (single)": 105,
  "slip jig": 110,
  polka: 120,
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
  genreId?: string | null;
  genreName?: string | null;
  tuneTypeName?: string | null;
  tuneId?: string | null;
  userId?: string | null;
  selectedPatternId?: string | null;
}

export type RhythmPatternType = "seed" | "full_track";

export type RhythmPatternCandidateScope =
  | "user_tune"
  | "tune_default"
  | "user_default"
  | "system_default"
  | "system_pattern";

export interface RhythmPatternCandidate {
  id: string;
  name: string;
  scope: RhythmPatternCandidateScope;
  patternType: RhythmPatternType;
  sampleKit: string;
  hasPremiumAudio: boolean;
}

export interface RhythmPatternMetadata {
  genreName: string | null;
  genreId?: string | null;
  tuneTypeName: string;
  tuneTypeId?: string | null;
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
  selectedPatternId?: string | null;
  patternCandidates?: RhythmPatternCandidate[];
}

type PremiumLoopSelection = {
  source: "database";
  url: string;
  sourceTempoQpm: number | null;
  trimMs: number;
};

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

function normalizePatternType(patternType?: string | null): RhythmPatternType {
  return patternType === "full_track" ? "full_track" : "seed";
}

function escapeSqlStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function toSqlNullableStringLiteral(value?: string | null): string {
  return value == null ? "NULL" : escapeSqlStringLiteral(value);
}

function getRhythmPatternCandidateScope(row: {
  tune_id?: string | null;
  user_id?: string | null;
  is_default?: number | boolean | null;
}): RhythmPatternCandidateScope {
  if (row.user_id && row.tune_id) {
    return "user_tune";
  }

  if (row.tune_id) {
    return "tune_default";
  }

  if (row.user_id) {
    return "user_default";
  }

  if (row.is_default) {
    return "system_default";
  }

  return "system_pattern";
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

export async function loadRhythmPattern(
  db: SqliteDatabase,
  request: RhythmPatternRequest,
  options?: { sampleBaseUrl?: string }
): Promise<RhythmPatternMetadata | null> {
  const context = await createPatternLoaderContext(db, request, options);
  if (!context) {
    return null;
  }

  const rhythmPatternMetadata = context.capabilities.canUseRhythmPatterns
    ? mapRhythmPatternMetadata(
        await queryRhythmPatternRows(db, context),
        context
      )
    : null;
  if (rhythmPatternMetadata) {
    return rhythmPatternMetadata;
  }

  const genreTempoFallback = context.capabilities.hasGenreDefaultBpmColumn
    ? await queryGenreTempoFallbackRow(db, context)
    : null;
  if (genreTempoFallback?.tune_type_name) {
    const resolvedTempoQpm =
      typeof genreTempoFallback.tempo_qpm === "number" &&
      Number.isFinite(genreTempoFallback.tempo_qpm)
        ? genreTempoFallback.tempo_qpm
        : getDefaultTempoForTuneType(genreTempoFallback.tune_type_name);

    return buildTuneTypeFallbackMetadata(
      {
        tune_type_name: genreTempoFallback.tune_type_name,
        tune_type_id: genreTempoFallback.tune_type_id,
        rhythm_signature: genreTempoFallback.rhythm_signature,
      },
      context,
      {
        genreName: genreTempoFallback.genre_name,
        genreId: genreTempoFallback.genre_id,
        tempoQpm: resolvedTempoQpm,
      }
    );
  }

  const tuneTypeFallback = await queryTuneTypeFallbackRow(db, context);
  if (!tuneTypeFallback?.tune_type_name) {
    return null;
  }

  return buildTuneTypeFallbackMetadata(tuneTypeFallback, context, {
    genreName: context.filters.genreNameFilter ?? context.filters.genreIdFilter,
    genreId: context.filters.genreIdFilter,
    tempoQpm: getDefaultTempoForTuneType(tuneTypeFallback.tune_type_name),
  });
}

type PatternLoaderSchemaCapabilities = {
  hasGenreDefaultBpmColumn: boolean;
  canUseRhythmPatterns: boolean;
  hasSampleKitColumn: boolean;
  hasPremiumAudioUrlColumn: boolean;
  hasTuneIdColumn: boolean;
  hasUserIdColumn: boolean;
  hasPatternTypeColumn: boolean;
  canUseHierarchicalOverrides: boolean;
};

type PatternLoaderFilters = {
  genreNameFilter: string | null;
  genreIdFilter: string | null;
  genreFilter: string | null;
  tuneIdFilter: string | null;
  userIdFilter: string | null;
  selectedPatternIdFilter: string | null;
};

type PatternLoaderContext = {
  tuneTypeName: string;
  tuneTypeMatchClause: ReturnType<typeof sql.raw>;
  sampleBaseUrl: string;
  filters: PatternLoaderFilters;
  capabilities: PatternLoaderSchemaCapabilities;
};

type RhythmPatternQueryRow = {
  genre_name: string | null;
  genre_id: string | null;
  tune_type_name: string | null;
  tune_type_id: string | null;
  rhythm_signature: string | null;
  tempo_qpm: number | null;
  pattern_id: string | null;
  pattern_name: string | null;
  abc_string: string | null;
  sample_kit: string | null;
  premium_audio_url: string | null;
  pattern_type: string | null;
  tune_id: string | null;
  user_id: string | null;
  is_default: number | null;
  row_num: number | null;
};

type SelectedRhythmPatternRow = RhythmPatternQueryRow & {
  pattern_id: string;
  pattern_name: string;
};

type GenreTempoFallbackRow = {
  genre_name: string | null;
  genre_id: string | null;
  tune_type_name: string | null;
  tune_type_id: string | null;
  rhythm_signature: string | null;
  tempo_qpm: number | null;
};

type TuneTypeFallbackRow = {
  tune_type_id: string | null;
  tune_type_name: string | null;
  rhythm_signature: string | null;
};

async function createPatternLoaderContext(
  db: SqliteDatabase,
  request: RhythmPatternRequest,
  options?: { sampleBaseUrl?: string }
): Promise<PatternLoaderContext | null> {
  const tuneTypeName = request.tuneTypeName?.trim();
  if (!tuneTypeName) {
    return null;
  }

  return {
    tuneTypeName,
    tuneTypeMatchClause: buildTuneTypeMatchClause(tuneTypeName),
    sampleBaseUrl: options?.sampleBaseUrl ?? DEFAULT_SAMPLE_BASE_URL,
    filters: buildPatternLoaderFilters(request),
    capabilities: await detectPatternLoaderSchemaCapabilities(db),
  };
}

async function detectPatternLoaderSchemaCapabilities(
  db: SqliteDatabase
): Promise<PatternLoaderSchemaCapabilities> {
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
  const hasTuneIdColumn = rhythmPatternColumns.has("tune_id");
  const hasUserIdColumn = rhythmPatternColumns.has("user_id");

  return {
    hasGenreDefaultBpmColumn,
    canUseRhythmPatterns,
    hasSampleKitColumn: rhythmPatternColumns.has("sample_kit"),
    hasPremiumAudioUrlColumn: rhythmPatternColumns.has("premium_audio_url"),
    hasTuneIdColumn,
    hasUserIdColumn,
    hasPatternTypeColumn: rhythmPatternColumns.has("pattern_type"),
    canUseHierarchicalOverrides: hasTuneIdColumn && hasUserIdColumn,
  };
}

function buildPatternLoaderFilters(
  request: RhythmPatternRequest
): PatternLoaderFilters {
  const genreNameFilter = request.genreName?.trim() || null;
  const genreIdFilter = request.genreId?.trim() || null;

  return {
    genreNameFilter,
    genreIdFilter,
    genreFilter: genreIdFilter ?? genreNameFilter,
    tuneIdFilter: request.tuneId?.trim() || null,
    userIdFilter: request.userId?.trim() || null,
    selectedPatternIdFilter: request.selectedPatternId?.trim() || null,
  };
}

function buildTuneTypeMatchClause(
  tuneTypeName: string
): ReturnType<typeof sql.raw> {
  const tuneTypeLookupCandidates = getTuneTypeLookupCandidates(tuneTypeName);

  return sql.raw(
    tuneTypeLookupCandidates.length > 0
      ? tuneTypeLookupCandidates
          .map((candidate) => {
            const literal = escapeSqlStringLiteral(candidate);
            return `(lower(id) = lower(${literal}) OR lower(name) = lower(${literal}))`;
          })
          .join(" OR ")
      : "1 = 0"
  );
}

function buildSelectedPatternOrderClause(
  filters: PatternLoaderFilters,
  canUseHierarchicalOverrides: boolean
): ReturnType<typeof sql.raw> {
  return sql.raw(
    [
      canUseHierarchicalOverrides
        ? `CASE
            WHEN ${toSqlNullableStringLiteral(filters.userIdFilter)} IS NOT NULL
             AND ${toSqlNullableStringLiteral(filters.tuneIdFilter)} IS NOT NULL
             AND rp.user_id = ${toSqlNullableStringLiteral(filters.userIdFilter)}
             AND rp.tune_id = ${toSqlNullableStringLiteral(filters.tuneIdFilter)} THEN 0
            WHEN ${toSqlNullableStringLiteral(filters.tuneIdFilter)} IS NOT NULL
             AND rp.user_id IS NULL
             AND rp.tune_id = ${toSqlNullableStringLiteral(filters.tuneIdFilter)} THEN 1
            WHEN ${toSqlNullableStringLiteral(filters.userIdFilter)} IS NOT NULL
             AND rp.user_id = ${toSqlNullableStringLiteral(filters.userIdFilter)}
             AND rp.tune_id IS NULL THEN 2
            WHEN rp.user_id IS NULL
             AND rp.tune_id IS NULL
             AND rp.is_default THEN 3
            WHEN rp.user_id IS NULL
             AND rp.tune_id IS NULL THEN 4
            ELSE 5
          END`
        : null,
      "CASE WHEN rp.is_default THEN 0 ELSE 1 END",
      "CASE WHEN rp.part_target IS NULL OR rp.part_target = '*' THEN 0 ELSE 1 END",
      "rp.name",
    ]
      .filter(Boolean)
      .join(",\n              ")
  );
}

async function queryRhythmPatternRows(
  db: SqliteDatabase,
  context: PatternLoaderContext
): Promise<RhythmPatternQueryRow[]> {
  const { capabilities, filters, tuneTypeMatchClause, tuneTypeName } = context;
  const selectedPatternOrderClause = buildSelectedPatternOrderClause(
    filters,
    capabilities.canUseHierarchicalOverrides
  );

  return db.all<RhythmPatternQueryRow>(sql`
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
      WHERE ${filters.genreFilter} IS NOT NULL
        AND (
          lower(name) = lower(${filters.genreFilter})
          OR lower(id) = lower(${filters.genreFilter})
        )
      LIMIT 1
    ),
    tempo_match AS (
      SELECT gtt.default_bpm
      FROM tune_type_match ttm
      JOIN genre_tune_type gtt ON gtt.tune_type_id = ttm.id
      LEFT JOIN genre_match gm ON 1 = 1
      WHERE gm.id IS NULL OR gtt.genre_id = gm.id
      ORDER BY
        CASE
          WHEN gm.id IS NOT NULL AND gtt.genre_id = gm.id THEN 0
          ELSE 1
        END,
        gtt.genre_id
      LIMIT 1
    ),
    selected_pattern AS (
      SELECT
        rp.id,
        rp.name,
        rp.genre_id,
        rp.tune_type_id,
        rp.abc_string,
        ${
          capabilities.hasSampleKitColumn
            ? sql`rp.sample_kit`
            : sql`CAST(NULL AS TEXT)`
        } AS sample_kit,
        ${
          capabilities.hasPremiumAudioUrlColumn
            ? sql`rp.premium_audio_url`
            : sql`CAST(NULL AS TEXT)`
        } AS premium_audio_url,
        ${
          capabilities.hasPatternTypeColumn
            ? sql`rp.pattern_type`
            : sql`CAST('seed' AS TEXT)`
        } AS pattern_type,
        ${
          capabilities.hasTuneIdColumn
            ? sql`rp.tune_id`
            : sql`CAST(NULL AS TEXT)`
        } AS tune_id,
        ${
          capabilities.hasUserIdColumn
            ? sql`rp.user_id`
            : sql`CAST(NULL AS TEXT)`
        } AS user_id,
        rp.is_default,
        rp.part_target,
        ROW_NUMBER() OVER (
          ORDER BY ${selectedPatternOrderClause}
        ) AS row_num
      FROM rhythm_patterns rp
      JOIN tune_type_match ttm ON rp.tune_type_id = ttm.id
      LEFT JOIN genre_match gm ON 1 = 1
      WHERE (gm.id IS NULL OR rp.genre_id = gm.id)
        AND ${
          capabilities.canUseHierarchicalOverrides
            ? sql`
              (
                (${filters.userIdFilter} IS NOT NULL
                  AND ${filters.tuneIdFilter} IS NOT NULL
                  AND rp.user_id = ${filters.userIdFilter}
                  AND rp.tune_id = ${filters.tuneIdFilter})
                OR (${filters.tuneIdFilter} IS NOT NULL
                  AND rp.user_id IS NULL
                  AND rp.tune_id = ${filters.tuneIdFilter})
                OR (${filters.userIdFilter} IS NOT NULL
                  AND rp.user_id = ${filters.userIdFilter}
                  AND rp.tune_id IS NULL)
                OR (rp.user_id IS NULL AND rp.tune_id IS NULL)
              )
            `
            : sql`1 = 1`
        }
    )
    SELECT
      gm.name AS genre_name,
      COALESCE(sp.genre_id, gm.id) AS genre_id,
      ttm.name AS tune_type_name,
      COALESCE(sp.tune_type_id, ttm.id) AS tune_type_id,
      ttm.rhythm AS rhythm_signature,
      ${
        capabilities.hasGenreDefaultBpmColumn
          ? sql`tm.default_bpm`
          : sql`CAST(NULL AS INTEGER)`
      } AS tempo_qpm,
      sp.id AS pattern_id,
      sp.name AS pattern_name,
      sp.abc_string AS abc_string,
      sp.sample_kit AS sample_kit,
      sp.premium_audio_url AS premium_audio_url,
      sp.pattern_type AS pattern_type,
      sp.tune_id AS tune_id,
      sp.user_id AS user_id,
      sp.is_default AS is_default,
      sp.row_num AS row_num
    FROM tune_type_match ttm
    LEFT JOIN genre_match gm ON 1 = 1
    LEFT JOIN tempo_match tm ON 1 = 1
    LEFT JOIN selected_pattern sp ON 1 = 1
    ORDER BY sp.row_num
  `);
}

function isSelectableRhythmPatternRow(
  candidateRow: RhythmPatternQueryRow
): candidateRow is SelectedRhythmPatternRow {
  return Boolean(
    candidateRow.pattern_id &&
      candidateRow.pattern_name &&
      candidateRow.abc_string?.trim()
  );
}

function mapRhythmPatternMetadata(
  rows: RhythmPatternQueryRow[],
  context: PatternLoaderContext
): RhythmPatternMetadata | null {
  const row = rows[0];
  const candidateRows = rows.filter(isSelectableRhythmPatternRow);
  const selectedPatternRow =
    candidateRows.find(
      (candidateRow) =>
        candidateRow.pattern_id === context.filters.selectedPatternIdFilter
    ) ?? candidateRows.find((candidateRow) => candidateRow.row_num === 1);

  if (!row?.tune_type_name || !selectedPatternRow?.abc_string?.trim()) {
    return null;
  }

  const resolvedTempoQpm =
    typeof row.tempo_qpm === "number" && Number.isFinite(row.tempo_qpm)
      ? row.tempo_qpm
      : getDefaultTempoForTuneType(row.tune_type_name);
  const premiumLoop = selectPremiumLoop(context.sampleBaseUrl, {
    explicitUrl: selectedPatternRow.premium_audio_url,
    tempoQpm: resolvedTempoQpm,
  });

  return {
    genreName:
      row.genre_name ??
      context.filters.genreNameFilter ??
      context.filters.genreIdFilter,
    genreId: row.genre_id,
    tuneTypeName: row.tune_type_name,
    tuneTypeId: row.tune_type_id,
    rhythmSignature: row.rhythm_signature ?? null,
    rhythmAbc: selectedPatternRow.abc_string.trim(),
    patternType: normalizePatternType(selectedPatternRow.pattern_type),
    tempoQpm: resolvedTempoQpm,
    sampleKit: normalizeSampleKit(selectedPatternRow.sample_kit),
    premiumAudioUrl: premiumLoop?.url ?? null,
    premiumAudioTrimMs: premiumLoop?.trimMs ?? 0,
    premiumAudioSource: premiumLoop?.source ?? null,
    premiumAudioSourceTempoQpm: premiumLoop?.sourceTempoQpm ?? null,
    source: "rhythm_patterns",
    selectedPatternId: selectedPatternRow.pattern_id,
    patternCandidates: candidateRows.map((candidateRow) => ({
      id: candidateRow.pattern_id,
      name: candidateRow.pattern_name,
      scope: getRhythmPatternCandidateScope(candidateRow),
      patternType: normalizePatternType(candidateRow.pattern_type),
      sampleKit: normalizeSampleKit(candidateRow.sample_kit),
      hasPremiumAudio: Boolean(candidateRow.premium_audio_url?.trim()),
    })),
  };
}

async function queryGenreTempoFallbackRow(
  db: SqliteDatabase,
  context: PatternLoaderContext
): Promise<GenreTempoFallbackRow | null> {
  const rows = await db.all<GenreTempoFallbackRow>(sql`
    WITH tune_type_match AS (
      SELECT id, name, rhythm
      FROM tune_type
      WHERE (${context.tuneTypeMatchClause})
      ORDER BY
        CASE
          WHEN lower(id) = lower(${context.tuneTypeName}) THEN 0
          WHEN lower(name) = lower(${context.tuneTypeName}) THEN 1
          ELSE 2
        END,
        length(coalesce(name, id))
      LIMIT 1
    ),
    genre_match AS (
      SELECT id, name
      FROM genre
      WHERE ${context.filters.genreFilter} IS NOT NULL
        AND (
          lower(name) = lower(${context.filters.genreFilter})
          OR lower(id) = lower(${context.filters.genreFilter})
        )
      LIMIT 1
    )
    SELECT
      gm.name AS genre_name,
      gm.id AS genre_id,
      ttm.name AS tune_type_name,
      ttm.id AS tune_type_id,
      ttm.rhythm AS rhythm_signature,
      gtt.default_bpm AS tempo_qpm
    FROM tune_type_match ttm
    LEFT JOIN genre_match gm ON 1 = 1
    LEFT JOIN genre_tune_type gtt
      ON gtt.tune_type_id = ttm.id
     AND (gm.id IS NULL OR gtt.genre_id = gm.id)
    LIMIT 1
  `);

  return rows[0] ?? null;
}

async function queryTuneTypeFallbackRow(
  db: SqliteDatabase,
  context: PatternLoaderContext
): Promise<TuneTypeFallbackRow | null> {
  const rows = await db.all<TuneTypeFallbackRow>(sql`
    SELECT id AS tune_type_id, name AS tune_type_name, rhythm AS rhythm_signature
    FROM tune_type
    WHERE (${context.tuneTypeMatchClause})
    ORDER BY
      CASE
        WHEN lower(id) = lower(${context.tuneTypeName}) THEN 0
        WHEN lower(name) = lower(${context.tuneTypeName}) THEN 1
        ELSE 2
      END,
      length(coalesce(name, id))
    LIMIT 1
  `);

  return rows[0] ?? null;
}

function buildTuneTypeFallbackMetadata(
  row: TuneTypeFallbackRow,
  context: PatternLoaderContext,
  options: {
    genreName: string | null;
    genreId: string | null;
    tempoQpm: number;
  }
): RhythmPatternMetadata {
  return {
    genreName: options.genreName,
    genreId: options.genreId,
    tuneTypeName: row.tune_type_name ?? context.tuneTypeName,
    tuneTypeId: row.tune_type_id,
    rhythmSignature: row.rhythm_signature ?? null,
    rhythmAbc: buildFallbackRhythmAbc(
      row.tune_type_name ?? context.tuneTypeName,
      row.rhythm_signature ?? null
    ),
    patternType: "seed",
    tempoQpm: options.tempoQpm,
    sampleKit: DEFAULT_SAMPLE_KIT,
    premiumAudioUrl: null,
    premiumAudioTrimMs: 0,
    premiumAudioSource: null,
    premiumAudioSourceTempoQpm: null,
    source: "tune_type_fallback",
    selectedPatternId: null,
    patternCandidates: [],
  };
}
