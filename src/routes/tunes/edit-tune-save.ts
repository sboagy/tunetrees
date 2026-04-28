import type { TuneEditorData } from "../../components/tunes";
import type { TuneOverrideInput } from "../../lib/db/queries/tune-overrides";
import type { CreateTuneInput } from "../../lib/db/types";

const BASE_TUNE_FIELDS = [
  "title",
  "type",
  "mode",
  "structure",
  "incipit",
  "genre",
  "composer",
  "artist",
  "idForeign",
  "releaseYear",
] as const;

const REPERTOIRE_TUNE_FIELDS = ["learned", "goal", "scheduled"] as const;

type BaseTuneField = (typeof BASE_TUNE_FIELDS)[number];
type RepertoireTuneField = (typeof REPERTOIRE_TUNE_FIELDS)[number];

function normalizeOptionalText(
  value: string | null | undefined
): string | null {
  return value === undefined || value === null || value === "" ? null : value;
}

function normalizeGoalValue(value: string | null | undefined): string | null {
  // Goal is enum-like, but the edit form still uses blank values to clear it.
  return normalizeOptionalText(value);
}

export function buildBaseTuneUpdateInput(
  tuneData: Partial<TuneEditorData>
): Partial<CreateTuneInput> {
  const input: Partial<CreateTuneInput> = {};

  // Keep the full editable shape so the direct-update path mirrors the
  // previous inline object literal and stays predictable for future fields.
  for (const field of BASE_TUNE_FIELDS) {
    input[field] = tuneData[field] ?? undefined;
  }

  return input;
}

export function buildChangedTuneOverrideInput(
  tuneData: Partial<TuneEditorData>,
  currentTune: Pick<TuneEditorData, BaseTuneField>
): TuneOverrideInput {
  const overrideInput: TuneOverrideInput = {};

  for (const field of BASE_TUNE_FIELDS) {
    const nextValue = tuneData[field];
    if (nextValue !== currentTune[field]) {
      overrideInput[field] = nextValue ?? undefined;
    }
  }

  return overrideInput;
}

export function hasRepertoireTuneChanges(
  tuneData: Partial<TuneEditorData>
): boolean {
  return REPERTOIRE_TUNE_FIELDS.some((field) => tuneData[field] !== undefined);
}

export function buildRepertoireTuneUpdate(
  tuneData: Partial<TuneEditorData>
): Record<RepertoireTuneField, string | null> {
  // Preserve the route's prior semantics: once any repertoire field is being
  // saved, blank inputs clear their stored values instead of leaving stale data.
  return {
    learned: normalizeOptionalText(tuneData.learned),
    goal: normalizeGoalValue(tuneData.goal),
    scheduled: normalizeOptionalText(tuneData.scheduled),
  };
}
