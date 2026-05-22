import {
  buildStructuredPlaybackBodyFromAbc,
  countBarEvents,
  getDistinctStructureParts,
  normalizeStructure,
  resolveStructurePartsForAbc,
  splitAbcSections,
} from "./canonical-abc";
import { resolveEffectivePlaybackParts } from "./structured-playback-model";

export interface StartSectionOption {
  value: string;
  label: string;
  barsBefore: number;
}

interface PlaybackStartState {
  barsBefore: number;
  beatIndex: number;
}

export interface PlaybackRhythmAbcInput {
  fullAbc: string;
  structure?: string | null;
  startSectionValue?: string | null;
  rhythmSignature?: string | null;
  tempoQpm: number;
}

export interface PlaybackRhythmPlan {
  playbackAbc: string;
  startPositionMs: number;
  startBeatIndex: number;
  startMeasure: number;
  startSectionOptions: StartSectionOption[];
}

export function getMeasureDurationMs(
  rhythmSignature?: string | null,
  tempoQpm = 100
): number {
  const [rawNumerator, rawDenominator] = (rhythmSignature ?? "").split("/");
  const numerator = Number.parseInt(rawNumerator ?? "", 10);
  const denominator = Number.parseInt(rawDenominator ?? "", 10);

  if (
    !Number.isFinite(numerator) ||
    numerator <= 0 ||
    !Number.isFinite(denominator) ||
    denominator <= 0
  ) {
    return 0;
  }

  return numerator * ((60_000 / Math.max(1, tempoQpm)) * (4 / denominator));
}

export function getStructureStartOptions(
  structure?: string | null,
  fullAbc?: string | null
): StartSectionOption[] {
  if (!normalizeStructure(structure)) {
    return [{ value: "start", label: "Start", barsBefore: 0 }];
  }

  const parts = resolveEffectivePlaybackParts(structure, fullAbc);
  const sectionCounts = new Map<string, number>();
  let barsBefore = 0;

  return parts.map((part) => {
    const nextCount = (sectionCounts.get(part.label) ?? 0) + 1;
    sectionCounts.set(part.label, nextCount);

    const option = {
      value: `${part.label}${nextCount}`,
      label: `${part.label}${nextCount}`,
      barsBefore,
    };
    barsBefore += part.bars;
    return option;
  });
}

function getStructuredPlaybackStartState(
  fullAbc: string | null,
  structure: string | null | undefined,
  option: StartSectionOption | null | undefined
): PlaybackStartState {
  const barsBefore = Math.max(0, option?.barsBefore ?? 0);
  if (!fullAbc || !normalizeStructure(structure) || barsBefore <= 0) {
    return { barsBefore, beatIndex: 0 };
  }

  const structuredBars = buildStructuredPlaybackBodyFromAbc(
    fullAbc,
    resolveEffectivePlaybackParts(structure, fullAbc)
  );

  const beatIndex = structuredBars
    .slice(0, barsBefore)
    .reduce((sum, bar) => sum + countBarEvents(bar), 0);

  return {
    barsBefore,
    beatIndex,
  };
}

function rotatePlaybackRhythmAbc(
  abc: string | null,
  barsBefore: number
): string | null {
  if (!abc || barsBefore <= 0) {
    return abc;
  }

  const { headerLines, bodyBars } = splitAbcSections(abc);
  if (bodyBars.length === 0) {
    return abc;
  }

  const normalizedBarsBefore = barsBefore % bodyBars.length;
  if (normalizedBarsBefore <= 0) {
    return abc;
  }

  const rotatedBars = [
    ...bodyBars.slice(normalizedBarsBefore),
    ...bodyBars.slice(0, normalizedBarsBefore),
  ];

  return [...headerLines, `| ${rotatedBars.join(" | ")} |`].join("\n");
}

function flattenCanonicalRhythmAbc(
  fullAbc: string,
  structure?: string | null
): string {
  const normalizedStructure = normalizeStructure(structure);
  if (!normalizedStructure) {
    return fullAbc;
  }

  const parts = resolveStructurePartsForAbc(normalizedStructure, fullAbc);
  const structuredBars = buildStructuredPlaybackBodyFromAbc(fullAbc, parts);
  if (structuredBars.length === 0) {
    return fullAbc;
  }

  const { headerLines, bodyBars } = splitAbcSections(fullAbc);
  const hasLabeledTemplates = fullAbc
    .split("\n")
    .some((line) => /^P:/.test(line.trim()));
  const distinctStructureBarCount = getDistinctStructureParts(parts).reduce(
    (sum, part) => sum + part.bars,
    0
  );
  const shouldFlattenCompactStructuredForm =
    hasLabeledTemplates || bodyBars.length <= distinctStructureBarCount;

  if (
    shouldFlattenCompactStructuredForm &&
    structuredBars.length !== bodyBars.length
  ) {
    return [...headerLines, `| ${structuredBars.join(" | ")} |`].join("\n");
  }

  return fullAbc;
}

export function buildPlaybackRhythmPlan(
  input: PlaybackRhythmAbcInput
): PlaybackRhythmPlan {
  const normalizedStructure = normalizeStructure(input.structure);
  const startSectionOptions = getStructureStartOptions(
    normalizedStructure,
    input.fullAbc
  );
  const selectedOption = startSectionOptions.find(
    (option) => option.value === (input.startSectionValue ?? "start")
  ) ??
    startSectionOptions[0] ?? { value: "start", label: "Start", barsBefore: 0 };

  const startState = getStructuredPlaybackStartState(
    input.fullAbc,
    normalizedStructure,
    selectedOption
  );
  const flattenedAbc = flattenCanonicalRhythmAbc(
    input.fullAbc,
    normalizedStructure
  );
  const playbackAbc =
    startState.barsBefore > 0
      ? (rotatePlaybackRhythmAbc(flattenedAbc, startState.barsBefore) ??
        flattenedAbc)
      : flattenedAbc;

  return {
    playbackAbc,
    startPositionMs:
      startState.barsBefore *
      getMeasureDurationMs(input.rhythmSignature, input.tempoQpm),
    startBeatIndex: startState.beatIndex,
    startMeasure: startState.barsBefore,
    startSectionOptions,
  };
}
