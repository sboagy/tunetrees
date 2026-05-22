import {
  buildStructuredPlaybackBodyFromAbc,
  buildStructuredPlaybackSections,
  buildStructuredPlaybackSectionsFromAbc,
  collapseStructureSections,
  countAbcEvents,
  countBarEvents,
  getAbcBodyLines,
  getDistinctStructureParts,
  getSectionTemplateKey,
  normalizeAbcBodyBars,
  normalizeStructure,
  resolveStructurePartsForAbc,
  type StructurePart,
  splitAbcSections,
} from "./canonical-abc";

export interface StartSectionOption {
  value: string;
  label: string;
  barsBefore: number;
}

interface PlaybackStartState {
  barsBefore: number;
  beatIndex: number;
}

interface StructuredPlaybackPosition {
  activePartIndex: number;
  displaySectionIndex: number;
  remainingBeatIndex: number;
  sectionPass: number;
  part: StructurePart;
}

interface DisplayPartLabelTarget {
  lineIndex: number;
  elements: SVGTextElement[];
}

interface CompactDisplaySectionTemplate {
  key: string;
  startLineIndex: number;
  lineEventCounts: number[];
}

interface DisplayPartTemplate {
  startLineIndex: number;
  lineEventCounts: number[];
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

function resolveEffectivePlaybackParts(
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

function getNoteheadLineIndex(notehead: SVGElement): number | null {
  const className =
    notehead.closest(".abcjs-note")?.getAttribute("class") ??
    notehead.closest(".abcjs-staff-wrapper")?.getAttribute("class") ??
    notehead.getAttribute("class") ??
    "";
  const match = className.match(/abcjs-l(\d+)/);
  if (!match) {
    return null;
  }

  const lineIndex = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(lineIndex) ? lineIndex : null;
}

function groupNoteheadsByDisplayLine(noteheads: SVGElement[]): SVGElement[][] {
  const groups = new Map<number, SVGElement[]>();

  for (const notehead of noteheads) {
    const lineIndex = getNoteheadLineIndex(notehead);
    if (lineIndex == null) {
      return [];
    }

    const lineGroup = groups.get(lineIndex) ?? [];
    lineGroup.push(notehead);
    groups.set(lineIndex, lineGroup);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left - right)
    .map(([, lineGroup]) => lineGroup);
}

function getSvgLineIndex(element: Element): number | null {
  const className = element.getAttribute("class") ?? "";
  const match = className.match(/abcjs-l(\d+)/);
  if (!match) {
    return null;
  }

  const lineIndex = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(lineIndex) ? lineIndex : null;
}

function getDisplayPartLabelTargets(
  container: HTMLDivElement
): DisplayPartLabelTarget[] {
  const labels = Array.from(
    container.querySelectorAll<SVGTextElement>("text.abcjs-part")
  );
  const groups = new Map<number, SVGTextElement[]>();

  for (const label of labels) {
    const lineIndex = getSvgLineIndex(label);
    if (lineIndex == null) {
      continue;
    }

    const lineGroup = groups.get(lineIndex) ?? [];
    lineGroup.push(label);
    groups.set(lineIndex, lineGroup);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left - right)
    .map(([lineIndex, elements]) => ({ lineIndex, elements }));
}

function buildDisplayedPartTemplates(
  displayAbc: string,
  parts: StructurePart[]
): DisplayPartTemplate[] {
  const bodyLines = getAbcBodyLines(displayAbc).filter(
    (line) => !/^P:/.test(line.trim())
  );
  if (bodyLines.length === 0 || parts.length === 0) {
    return [];
  }

  const templates: DisplayPartTemplate[] = [];
  let lineOffset = 0;

  for (const part of parts) {
    let consumedBars = 0;
    const lineEventCounts: number[] = [];
    const startLineIndex = lineOffset;

    while (lineOffset < bodyLines.length && consumedBars < part.bars) {
      const line = bodyLines[lineOffset] ?? "";
      const lineBars = normalizeAbcBodyBars(line);
      const eventCount = lineBars.reduce(
        (sum, bar) => sum + countBarEvents(bar),
        0
      );

      consumedBars += lineBars.length;
      lineEventCounts.push(eventCount);
      lineOffset += 1;
    }

    if (lineEventCounts.length === 0 || consumedBars < part.bars) {
      return [];
    }

    templates.push({
      startLineIndex,
      lineEventCounts,
    });
  }

  return templates;
}

function buildCompactDisplaySectionTemplates(
  abc: string,
  parts: StructurePart[]
): CompactDisplaySectionTemplate[] {
  const { bodyBars } = splitAbcSections(abc);
  const distinctParts = getDistinctStructureParts(parts);
  const totalStructuredBarCount = parts.reduce(
    (sum, part) => sum + part.bars,
    0
  );
  const distinctStructureBarCount = distinctParts.reduce(
    (sum, part) => sum + part.bars,
    0
  );

  if (
    distinctParts.length === 0 ||
    distinctParts.length === parts.length ||
    bodyBars.length > distinctStructureBarCount ||
    bodyBars.length >= totalStructuredBarCount
  ) {
    return [];
  }

  const bodyLines = getAbcBodyLines(abc).filter(
    (line) => !/^P:/.test(line.trim())
  );
  if (bodyLines.length === 0) {
    return [];
  }

  const templates: CompactDisplaySectionTemplate[] = [];
  let lineOffset = 0;

  for (const part of distinctParts) {
    let consumedBars = 0;
    const lineEventCounts: number[] = [];
    const startLineIndex = lineOffset;

    while (lineOffset < bodyLines.length && consumedBars < part.bars) {
      const line = bodyLines[lineOffset] ?? "";
      const lineBars = normalizeAbcBodyBars(line);
      const eventCount = lineBars.reduce(
        (sum, bar) => sum + countBarEvents(bar),
        0
      );

      consumedBars += lineBars.length;
      lineEventCounts.push(eventCount);
      lineOffset += 1;
    }

    if (lineEventCounts.length === 0 || consumedBars < part.bars) {
      return [];
    }

    templates.push({
      key: getSectionTemplateKey(part),
      startLineIndex,
      lineEventCounts,
    });
  }

  return templates;
}

function getStructuredPlaybackPosition(
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

export function updateStructuredDisplayPartLabels(
  container: HTMLDivElement,
  fullAbc: string | null,
  structure: string | null | undefined,
  currentBeatIndex: number
): void {
  if (!fullAbc || !structure) {
    return;
  }

  const parts = resolveStructurePartsForAbc(structure, fullAbc);
  const collapsedSections = collapseStructureSections(parts);
  const labelTargets = getDisplayPartLabelTargets(container);
  const displaySections =
    labelTargets.length === parts.length ? parts : collapsedSections;
  if (
    displaySections.length === 0 ||
    labelTargets.length === 0 ||
    labelTargets.length !== displaySections.length
  ) {
    return;
  }

  for (const [index, target] of labelTargets.entries()) {
    const baseLabel = displaySections[index]?.label ?? "";
    for (const element of target.elements) {
      element.textContent = baseLabel;
    }
  }

  const position = getStructuredPlaybackPosition(
    fullAbc,
    structure,
    currentBeatIndex
  );
  if (!position) {
    return;
  }

  const activeLabel =
    position.sectionPass > 1
      ? `${position.part.label}${position.sectionPass}`
      : position.part.label;
  const activeTarget =
    labelTargets.length === parts.length
      ? labelTargets[position.activePartIndex]
      : labelTargets[position.displaySectionIndex];
  if (!activeTarget) {
    return;
  }

  for (const element of activeTarget.elements) {
    element.textContent = activeLabel;
  }
}

export function resolveStructuredDisplayNotehead(
  noteheads: SVGElement[],
  fullAbc: string | null,
  structure: string | null | undefined,
  currentBeatIndex: number,
  displayAbc?: string | null
): SVGElement | null {
  if (
    !fullAbc ||
    !structure ||
    currentBeatIndex < 1 ||
    noteheads.length === 0
  ) {
    return null;
  }

  const position = getStructuredPlaybackPosition(
    fullAbc,
    structure,
    currentBeatIndex
  );
  const parts = resolveStructurePartsForAbc(structure, fullAbc);
  if (!position || parts.length === 0) {
    return null;
  }

  const structuredEventCount = buildStructuredPlaybackSections(
    splitAbcSections(fullAbc).bodyBars,
    parts
  ).reduce(
    (sum, sectionBars) =>
      sum +
      sectionBars.reduce(
        (sectionSum, bar) => sectionSum + countBarEvents(bar),
        0
      ),
    0
  );
  const displayedEventCount = countAbcEvents(displayAbc ?? fullAbc);

  if (
    structuredEventCount > 0 &&
    displayedEventCount === structuredEventCount &&
    noteheads.length >= structuredEventCount
  ) {
    return noteheads[(currentBeatIndex - 1) % structuredEventCount] ?? null;
  }

  const lineGroups = groupNoteheadsByDisplayLine(noteheads);
  const displayedPartTemplates = buildDisplayedPartTemplates(
    displayAbc ?? fullAbc,
    parts
  );
  const displayedPartTemplate =
    displayedPartTemplates[position.activePartIndex];
  if (displayedPartTemplate) {
    let remainingBeatIndex = position.remainingBeatIndex;
    for (
      let lineOffset = 0;
      lineOffset < displayedPartTemplate.lineEventCounts.length;
      lineOffset += 1
    ) {
      const lineEventCount =
        displayedPartTemplate.lineEventCounts[lineOffset] ?? 0;
      if (remainingBeatIndex < lineEventCount) {
        const lineGroup =
          lineGroups[displayedPartTemplate.startLineIndex + lineOffset];
        if (!lineGroup || lineGroup.length === 0) {
          return null;
        }

        return lineGroup[remainingBeatIndex % lineGroup.length] ?? null;
      }

      remainingBeatIndex -= lineEventCount;
    }
  }

  const compactTemplates = buildCompactDisplaySectionTemplates(
    displayAbc ?? fullAbc,
    parts
  );
  if (compactTemplates.length > 0) {
    const template = compactTemplates.find(
      (candidate) => candidate.key === getSectionTemplateKey(position.part)
    );

    if (!template) {
      return null;
    }

    let remainingBeatIndex = position.remainingBeatIndex;
    for (
      let lineOffset = 0;
      lineOffset < template.lineEventCounts.length;
      lineOffset += 1
    ) {
      const lineEventCount = template.lineEventCounts[lineOffset] ?? 0;
      if (remainingBeatIndex < lineEventCount) {
        const lineGroup = lineGroups[template.startLineIndex + lineOffset];
        if (!lineGroup || lineGroup.length === 0) {
          return null;
        }

        return lineGroup[remainingBeatIndex % lineGroup.length] ?? null;
      }

      remainingBeatIndex -= lineEventCount;
    }

    return null;
  }

  const displayLineIndex =
    lineGroups.length === parts.length
      ? position.activePartIndex
      : position.displaySectionIndex;
  if (displayLineIndex < 0 || displayLineIndex >= lineGroups.length) {
    return null;
  }

  const lineGroup = lineGroups[displayLineIndex];
  if (!lineGroup || lineGroup.length === 0) {
    return null;
  }

  return lineGroup[position.remainingBeatIndex % lineGroup.length] ?? null;
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
