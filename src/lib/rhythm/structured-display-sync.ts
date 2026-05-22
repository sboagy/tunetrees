import {
  buildStructuredPlaybackSections,
  collapseStructureSections,
  countAbcEvents,
  countBarEvents,
  getAbcBodyLines,
  getDistinctStructureParts,
  getSectionTemplateKey,
  normalizeAbcBodyBars,
  resolveStructurePartsForAbc,
  type StructurePart,
  splitAbcSections,
} from "./canonical-abc";
import { getStructuredPlaybackPosition } from "./structured-playback-model";

export interface DisplayPartLabelTarget {
  lineIndex: number;
  elements: SVGTextElement[];
}

export interface CompactDisplaySectionTemplate {
  key: string;
  startLineIndex: number;
  lineEventCounts: number[];
}

export interface DisplayPartTemplate {
  startLineIndex: number;
  lineEventCounts: number[];
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

export function groupNoteheadsByDisplayLine(
  noteheads: SVGElement[]
): SVGElement[][] {
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

export function getDisplayPartLabelTargets(
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

export function buildDisplayedPartTemplates(
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

// Compact notation can render only the distinct section templates even when
// playback traverses the expanded structure, so we keep a separate mapping.
export function buildCompactDisplaySectionTemplates(
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

// This module owns DOM synchronization now, but runtime position math still
// lives in playback-abc until the dedicated model module is extracted.
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
