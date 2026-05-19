import { and, eq } from "drizzle-orm";
import { generateId } from "@/lib/utils/uuid";
import { persistDb, type SqliteDatabase } from "../client-sqlite";
import { genre, rhythmPatterns, tuneType } from "../schema";

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

export type EditableRhythmPattern = typeof rhythmPatterns.$inferSelect;
export type EditableRhythmPatternScope = "user_default" | "user_tune";
export type EditableRhythmPatternType = "seed" | "full_track";

export interface SaveEditableRhythmPatternInput {
  genreName: string;
  genreId?: string | null;
  tuneTypeName: string;
  tuneTypeId?: string | null;
  name: string;
  abcString: string;
  sampleKit: string;
  patternType: EditableRhythmPatternType;
  userId: string;
  scope: EditableRhythmPatternScope;
  tuneId?: string | null;
}

function normalizeLookupValue(value?: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

function getTuneTypeLookupCandidates(tuneTypeName: string): string[] {
  const trimmed = tuneTypeName.trim();
  if (!trimmed) {
    return [];
  }

  const normalized = normalizeLookupValue(trimmed);
  const aliased = TUNE_TYPE_NAME_ALIASES[normalized] ?? normalized;
  const variants = TUNE_TYPE_LOOKUP_VARIANTS[aliased] ?? [];

  return Array.from(
    new Set([
      trimmed,
      normalized,
      aliased,
      ...variants,
      ...variants.map((variant) => variant.toLowerCase()),
    ])
  );
}

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Pattern name must not be empty");
  }
  return trimmed;
}

function normalizeAbcString(abcString: string): string {
  const trimmed = abcString.trim();
  if (!trimmed) {
    throw new Error("ABC notation must not be empty");
  }
  return trimmed;
}

async function resolveGenreId(
  db: SqliteDatabase,
  genreName: string,
  requestedGenreId?: string | null
): Promise<string> {
  const explicitGenreId = requestedGenreId?.trim();
  if (explicitGenreId) {
    return explicitGenreId;
  }

  const normalized = normalizeLookupValue(genreName);
  const rows = await db.select().from(genre);
  const match = rows.find((row) => {
    const rowId = normalizeLookupValue(row.id);
    const rowName = normalizeLookupValue(row.name);
    return rowId === normalized || rowName === normalized;
  });

  if (!match) {
    throw new Error(`Unable to find genre "${genreName}" for this pattern`);
  }

  return match.id;
}

async function resolveTuneTypeId(
  db: SqliteDatabase,
  tuneTypeName: string,
  requestedTuneTypeId?: string | null
): Promise<string> {
  const explicitTuneTypeId = requestedTuneTypeId?.trim();
  if (explicitTuneTypeId) {
    return explicitTuneTypeId;
  }

  const candidates = getTuneTypeLookupCandidates(tuneTypeName);
  const rows = await db.select().from(tuneType);
  const match = rows.find((row) => {
    const rowId = normalizeLookupValue(row.id);
    const rowName = normalizeLookupValue(row.name);
    return (
      candidates.includes(row.id) ||
      candidates.includes(row.name ?? "") ||
      candidates.includes(rowId) ||
      candidates.includes(rowName)
    );
  });

  if (!match) {
    throw new Error(
      `Unable to find tune type "${tuneTypeName}" for this pattern`
    );
  }

  return match.id;
}

function buildInsertValues(
  input: SaveEditableRhythmPatternInput,
  resolvedGenreId: string,
  resolvedTuneTypeId: string,
  now: string,
  existingId?: string
): typeof rhythmPatterns.$inferInsert {
  const isTuneScoped = input.scope === "user_tune" && input.tuneId?.trim();

  return {
    id: existingId ?? generateId(),
    genreId: resolvedGenreId,
    tuneTypeId: resolvedTuneTypeId,
    name: normalizeName(input.name),
    abcString: normalizeAbcString(input.abcString),
    sampleKit: input.sampleKit,
    patternType: input.patternType,
    userId: input.userId,
    tuneId: isTuneScoped ? (input.tuneId?.trim() ?? null) : null,
    partTarget: "*",
    isDefault: input.scope === "user_default" ? 1 : 0,
    premiumAudioUrl: null,
    lastModifiedAt: now,
  };
}

export async function getEditableRhythmPatternById(
  db: SqliteDatabase,
  patternId: string,
  userId: string
): Promise<EditableRhythmPattern | null> {
  const rows = await db
    .select()
    .from(rhythmPatterns)
    .where(
      and(eq(rhythmPatterns.id, patternId), eq(rhythmPatterns.userId, userId))
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function createEditableRhythmPattern(
  db: SqliteDatabase,
  input: SaveEditableRhythmPatternInput
): Promise<EditableRhythmPattern> {
  const now = new Date().toISOString();
  const [resolvedGenreId, resolvedTuneTypeId] = await Promise.all([
    resolveGenreId(db, input.genreName, input.genreId),
    resolveTuneTypeId(db, input.tuneTypeName, input.tuneTypeId),
  ]);

  const insertValues = buildInsertValues(
    input,
    resolvedGenreId,
    resolvedTuneTypeId,
    now
  );
  const result = await db
    .insert(rhythmPatterns)
    .values(insertValues)
    .returning();

  if (result.length === 0) {
    throw new Error("Failed to create rhythm pattern");
  }

  await persistDb();
  return result[0];
}

export async function updateEditableRhythmPattern(
  db: SqliteDatabase,
  patternId: string,
  userId: string,
  input: SaveEditableRhythmPatternInput
): Promise<EditableRhythmPattern> {
  const existing = await getEditableRhythmPatternById(db, patternId, userId);
  if (!existing) {
    throw new Error("Custom rhythm pattern not found");
  }

  const now = new Date().toISOString();
  const [resolvedGenreId, resolvedTuneTypeId] = await Promise.all([
    resolveGenreId(db, input.genreName, input.genreId),
    resolveTuneTypeId(db, input.tuneTypeName, input.tuneTypeId),
  ]);

  const updateValues = buildInsertValues(
    input,
    resolvedGenreId,
    resolvedTuneTypeId,
    now,
    patternId
  );
  const result = await db
    .update(rhythmPatterns)
    .set(updateValues)
    .where(
      and(eq(rhythmPatterns.id, patternId), eq(rhythmPatterns.userId, userId))
    )
    .returning();

  if (result.length === 0) {
    throw new Error("Failed to update rhythm pattern");
  }

  await persistDb();
  return result[0];
}

export async function deleteEditableRhythmPattern(
  db: SqliteDatabase,
  patternId: string,
  userId: string
): Promise<void> {
  await db
    .delete(rhythmPatterns)
    .where(
      and(eq(rhythmPatterns.id, patternId), eq(rhythmPatterns.userId, userId))
    );

  await persistDb();
}
