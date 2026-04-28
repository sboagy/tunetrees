import type { TuneEditorData } from "../../components/tunes";
import type { TuneOverrideInput } from "../../lib/db/queries/tune-overrides";
import type { CreateTuneInput } from "../../lib/db/types";

const REPERTOIRE_TUNE_FIELDS = ["learned", "goal", "scheduled"] as const;

type BaseTuneField =
  | "title"
  | "type"
  | "mode"
  | "structure"
  | "incipit"
  | "genre"
  | "composer"
  | "artist"
  | "idForeign"
  | "releaseYear";
type RepertoireTuneField = (typeof REPERTOIRE_TUNE_FIELDS)[number];

function normalizeOptionalText(
  value: string | null | undefined
): string | null {
  return value === undefined || value === null || value === "" ? null : value;
}

export function buildBaseTuneUpdateInput(
  tuneData: Partial<TuneEditorData>
): Partial<CreateTuneInput> {
  return {
    title: tuneData.title ?? undefined,
    type: tuneData.type ?? undefined,
    mode: tuneData.mode ?? undefined,
    structure: tuneData.structure ?? undefined,
    incipit: tuneData.incipit ?? undefined,
    genre: tuneData.genre ?? undefined,
    composer: tuneData.composer ?? undefined,
    artist: tuneData.artist ?? undefined,
    idForeign: tuneData.idForeign ?? undefined,
    releaseYear: tuneData.releaseYear ?? undefined,
  };
}

export function buildChangedTuneOverrideInput(
  tuneData: Partial<TuneEditorData>,
  currentTune: Pick<TuneEditorData, BaseTuneField>
): TuneOverrideInput {
  const overrideInput: TuneOverrideInput = {};

  if (tuneData.title !== currentTune.title)
    overrideInput.title = tuneData.title ?? undefined;
  if (tuneData.type !== currentTune.type)
    overrideInput.type = tuneData.type ?? undefined;
  if (tuneData.mode !== currentTune.mode)
    overrideInput.mode = tuneData.mode ?? undefined;
  if (tuneData.structure !== currentTune.structure)
    overrideInput.structure = tuneData.structure ?? undefined;
  if (tuneData.incipit !== currentTune.incipit)
    overrideInput.incipit = tuneData.incipit ?? undefined;
  if (tuneData.genre !== currentTune.genre)
    overrideInput.genre = tuneData.genre ?? undefined;
  if (tuneData.composer !== currentTune.composer)
    overrideInput.composer = tuneData.composer ?? undefined;
  if (tuneData.artist !== currentTune.artist)
    overrideInput.artist = tuneData.artist ?? undefined;
  if (tuneData.idForeign !== currentTune.idForeign)
    overrideInput.idForeign = tuneData.idForeign ?? undefined;
  if (tuneData.releaseYear !== currentTune.releaseYear)
    overrideInput.releaseYear = tuneData.releaseYear ?? undefined;

  return overrideInput;
}

export function hasRepertoireTuneChanges(
  tuneData: Partial<TuneEditorData>
): boolean {
  return REPERTOIRE_TUNE_FIELDS.some((field) => tuneData[field] !== undefined);
}

export function buildRepertoireTuneUpdate(
  tuneData: Partial<TuneEditorData>
): Partial<Record<RepertoireTuneField, string | null>> {
  const update: Partial<Record<RepertoireTuneField, string | null>> = {};

  // Only write fields the caller actually supplied, while still preserving the
  // edit form's blank-to-null clearing behavior for included keys.
  if ("learned" in tuneData) {
    update.learned = normalizeOptionalText(tuneData.learned);
  }
  if ("goal" in tuneData) {
    update.goal = normalizeOptionalText(tuneData.goal);
  }
  if ("scheduled" in tuneData) {
    update.scheduled = normalizeOptionalText(tuneData.scheduled);
  }

  return update;
}
