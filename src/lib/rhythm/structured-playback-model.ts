import {
  buildStructuredPlaybackSectionsFromAbc,
  collapseStructureSections,
  countBarEvents,
  getDistinctStructureParts,
  resolveStructurePartsForAbc,
  type StructurePart,
  splitAbcSections,
} from "./canonical-abc";

export interface StructuredPlaybackPosition {
  activePartIndex: number;
  displaySectionIndex: number;
  remainingBeatIndex: number;
  sectionPass: number;
  part: StructurePart;
}

export function resolveEffectivePlaybackParts(
  structure: string | null | undefined,
  fullAbc: string | null | undefined
): StructurePart[] {
  const parts = resolveStructurePartsForAbc(structure, fullAbc);
  if (!structure || !fullAbc) {
    return parts;
  }

  const hasLabeledSections = fullAbc
    .split("\n")
    .some((line) => /^P:/.test(line.trim()));
  if (hasLabeledSections) {
    return parts;
  }

  const distinctParts = getDistinctStructureParts(parts);
  if (distinctParts.length === parts.length) {
    return parts;
  }

  const distinctBarCount = distinctParts.reduce(
    (sum, part) => sum + part.bars,
    0
  );
  const { bodyBars } = splitAbcSections(fullAbc);

  return bodyBars.length === distinctBarCount ? distinctParts : parts;
}

// The runtime cursor model stays pure so playback planning and notation sync
// can share the same section math without touching DOM-specific logic.
export function getStructuredPlaybackPosition(
  fullAbc: string | null,
  structure: string | null | undefined,
  currentBeatIndex: number
): StructuredPlaybackPosition | null {
  if (!fullAbc || !structure || currentBeatIndex < 1) {
    return null;
  }

  const parts = resolveStructurePartsForAbc(structure, fullAbc);
  const collapsedSections = collapseStructureSections(parts);
  if (parts.length === 0 || collapsedSections.length === 0) {
    return null;
  }

  const structuredSections = buildStructuredPlaybackSectionsFromAbc(
    fullAbc,
    parts
  );
  if (structuredSections.length === 0) {
    return null;
  }

  const partEventCounts = structuredSections.map((sectionBars) =>
    sectionBars.reduce((sum, bar) => sum + countBarEvents(bar), 0)
  );

  const totalEventCount = partEventCounts.reduce(
    (sum, eventCount) => sum + eventCount,
    0
  );
  if (totalEventCount <= 0) {
    return null;
  }

  let remainingBeatIndex = (currentBeatIndex - 1) % totalEventCount;
  let activePartIndex = -1;
  for (let index = 0; index < partEventCounts.length; index += 1) {
    const eventCount = partEventCounts[index] ?? 0;
    if (remainingBeatIndex < eventCount) {
      activePartIndex = index;
      break;
    }
    remainingBeatIndex -= eventCount;
  }

  if (activePartIndex < 0) {
    return null;
  }

  let displaySectionIndex = 0;
  for (let index = 1; index <= activePartIndex; index += 1) {
    const previous = parts[index - 1];
    const current = parts[index];
    if (
      previous &&
      current &&
      (previous.label !== current.label || previous.bars !== current.bars)
    ) {
      displaySectionIndex += 1;
    }
  }

  let sectionPass = 1;
  for (let index = activePartIndex - 1; index >= 0; index -= 1) {
    const previous = parts[index];
    const current = parts[activePartIndex];
    if (
      !previous ||
      !current ||
      previous.label !== current.label ||
      previous.bars !== current.bars
    ) {
      break;
    }

    sectionPass += 1;
  }

  return {
    activePartIndex,
    displaySectionIndex,
    remainingBeatIndex,
    sectionPass,
    part: parts[activePartIndex]!,
  };
}

export function getStructuredSectionLabel(
  fullAbc: string | null,
  structure: string | null | undefined,
  currentBeatIndex: number
): string | null {
  const position = getStructuredPlaybackPosition(
    fullAbc,
    structure,
    currentBeatIndex
  );

  if (!position) {
    return null;
  }

  return position.sectionPass > 1
    ? `${position.part.label}${position.sectionPass}`
    : position.part.label;
}
