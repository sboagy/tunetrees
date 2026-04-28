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

export function buildBaseTuneUpdateInput(
  tuneData: Partial<TuneEditorData>
): Partial<CreateTuneInput> {
  const input: Partial<CreateTuneInput> = {};

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
  return {
    learned: tuneData.learned || null,
    goal: tuneData.goal || null,
    scheduled: tuneData.scheduled || null,
  };
}
