import type { PlaybackEventMarker } from "@/lib/services/rhythm-service/RhythmService";
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
  lineNoteheadEventMaps: number[][];
}

export interface DisplayPartTemplate {
  startLineIndex: number;
  lineNoteheadEventMaps: number[][];
}

function tokenizeBarEvents(bar: string): string[] {
  const tokens: string[] = [];
  let accidentalPrefix = "";

  for (const char of bar) {
    if (char === "_" || char === "^" || char === "=") {
      accidentalPrefix += char;
      continue;
    }

    const isEventSymbol =
      (char >= "A" && char <= "G") ||
      (char >= "a" && char <= "g") ||
      char === "x" ||
      char === "X" ||
      char === "z" ||
      char === "Z";

    if (isEventSymbol) {
      tokens.push(`${accidentalPrefix}${char}`);
    }

    accidentalPrefix = "";
  }

  return tokens;
}

function getBarDisplayEventMap(bar: string): number[] {
  const sanitizedBar = bar.replace(/![^!]+!/g, "").replace(/"[^"]*"/g, "");
  const eventTokens = tokenizeBarEvents(sanitizedBar);
  if (eventTokens.length === 0) {
    return [];
  }

  const noteheadEventMap: number[] = [];
  let currentNoteheadIndex = -1;

  for (const token of eventTokens) {
    const symbol = token.at(-1) ?? "";
    const isRest =
      symbol === "x" || symbol === "X" || symbol === "z" || symbol === "Z";
    if (!isRest) {
      currentNoteheadIndex += 1;
    }

    noteheadEventMap.push(Math.max(currentNoteheadIndex, 0));
  }

  return noteheadEventMap;
}

function getLineDisplayEventMap(line: string): number[] {
  const lineBars = normalizeAbcBodyBars(line);
  if (lineBars.length === 0) {
    return [];
  }

  const lineEventMap: number[] = [];
  let lineNoteheadOffset = 0;

  for (const bar of lineBars) {
    const barEventMap = getBarDisplayEventMap(bar);
    lineEventMap.push(
      ...barEventMap.map((index) => index + lineNoteheadOffset)
    );

    const barNoteheadCount =
      barEventMap.length === 0 ? 0 : Math.max(...barEventMap) + 1;
    lineNoteheadOffset += barNoteheadCount;
  }

  return lineEventMap;
}

function getNoteheadLineIndex(notehead: SVGElement): number | null {
  const className =
    notehead.closest(".abcjs-note")?.getAttribute("class") ??
    notehead.closest(".abcjs-staff-wrapper")?.getAttribute("class") ??
    notehead.getAttribute("class") ??
    "";
  const match = /abcjs-l(\d+)/.exec(className);
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
  const match = /abcjs-l(\d+)/.exec(className);
  if (!match) {
    return null;
  }

  const lineIndex = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(lineIndex) ? lineIndex : null;
}

function getAbcjsNoteIndex(element: Element): number | null {
  const className = element.getAttribute("class") ?? "";
  const match = /\babcjs-n(\d+)\b/.exec(className);
  if (!match) {
    return null;
  }

  const noteIndex = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(noteIndex) ? noteIndex : null;
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
    (line) => !line.trim().startsWith("P:")
  );
  if (bodyLines.length === 0 || parts.length === 0) {
    return [];
  }

  const templates: DisplayPartTemplate[] = [];
  let lineOffset = 0;

  for (const part of parts) {
    let consumedBars = 0;
    const lineNoteheadEventMaps: number[][] = [];
    const startLineIndex = lineOffset;

    while (lineOffset < bodyLines.length && consumedBars < part.bars) {
      const line = bodyLines[lineOffset] ?? "";
      const lineBars = normalizeAbcBodyBars(line);
      const lineEventMap = getLineDisplayEventMap(line);

      consumedBars += lineBars.length;
      lineNoteheadEventMaps.push(lineEventMap);
      lineOffset += 1;
    }

    if (lineNoteheadEventMaps.length === 0 || consumedBars < part.bars) {
      return [];
    }

    templates.push({
      startLineIndex,
      lineNoteheadEventMaps,
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
    (line) => !line.trim().startsWith("P:")
  );
  if (bodyLines.length === 0) {
    return [];
  }

  const templates: CompactDisplaySectionTemplate[] = [];
  let lineOffset = 0;

  for (const part of distinctParts) {
    let consumedBars = 0;
    const lineNoteheadEventMaps: number[][] = [];
    const startLineIndex = lineOffset;

    while (lineOffset < bodyLines.length && consumedBars < part.bars) {
      const line = bodyLines[lineOffset] ?? "";
      const lineBars = normalizeAbcBodyBars(line);
      const lineEventMap = getLineDisplayEventMap(line);

      consumedBars += lineBars.length;
      lineNoteheadEventMaps.push(lineEventMap);
      lineOffset += 1;
    }

    if (lineNoteheadEventMaps.length === 0 || consumedBars < part.bars) {
      return [];
    }

    templates.push({
      key: getSectionTemplateKey(part),
      startLineIndex,
      lineNoteheadEventMaps,
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

export function resolvePlaybackMarkerNotehead(
  container: HTMLDivElement,
  marker: PlaybackEventMarker | null | undefined
): SVGElement | null {
  if (!marker) {
    return null;
  }

  const exactMatch = container.querySelector<SVGElement>(
    `.abcjs-note.abcjs-mm${marker.measureIndex}.abcjs-n${marker.noteIndex} .abcjs-notehead`
  );
  if (exactMatch) {
    return exactMatch;
  }

  const noteGroups = Array.from(
    container.querySelectorAll<SVGGElement>(
      `.abcjs-note.abcjs-mm${marker.measureIndex}`
    )
  );
  if (noteGroups.length === 0) {
    return null;
  }

  const candidates = noteGroups
    .map((noteGroup) => ({
      noteGroup,
      noteIndex: getAbcjsNoteIndex(noteGroup),
      notehead: noteGroup.querySelector<SVGElement>(".abcjs-notehead"),
    }))
    .filter(
      (
        candidate
      ): candidate is {
        noteGroup: SVGGElement;
        noteIndex: number;
        notehead: SVGElement;
      } => candidate.noteIndex != null && candidate.notehead != null
    )
    .sort((left, right) => left.noteIndex - right.noteIndex);

  const nextCandidate = candidates.find(
    (candidate) => candidate.noteIndex >= marker.noteIndex
  );
  if (nextCandidate) {
    return nextCandidate.notehead;
  }

  return candidates.at(-1)?.notehead ?? null;
}

export function resolveCurrentBeatNotehead(
  container: HTMLDivElement,
  noteheads: SVGElement[],
  playbackMarker: PlaybackEventMarker | null | undefined,
  fullAbc: string | null,
  structure: string | null | undefined,
  currentBeatIndex: number,
  displayAbc?: string | null
): SVGElement | null {
  const structuredTarget = resolveStructuredDisplayNotehead(
    noteheads,
    fullAbc,
    structure,
    currentBeatIndex,
    displayAbc
  );
  const playbackMarkerTarget = resolvePlaybackMarkerNotehead(
    container,
    playbackMarker
  );
  const fallbackTarget =
    noteheads.length > 0
      ? (noteheads[(currentBeatIndex - 1) % noteheads.length] ?? null)
      : null;

  // Compact repeated notation reuses visible staff lines across repeat passes,
  // so prefer structure-aware notehead mapping before raw abcjs markers.
  return structuredTarget ?? playbackMarkerTarget ?? fallbackTarget;
}

function resolveTemplateNotehead(
  lineGroups: SVGElement[][],
  startLineIndex: number,
  lineNoteheadEventMaps: number[][],
  beatIndex: number
): SVGElement | null {
  let remainingBeatIndex = beatIndex;

  for (
    let lineOffset = 0;
    lineOffset < lineNoteheadEventMaps.length;
    lineOffset += 1
  ) {
    const lineEventMap = lineNoteheadEventMaps[lineOffset] ?? [];
    const lineEventCount = lineEventMap.length;
    if (remainingBeatIndex < lineEventCount) {
      const lineGroup = lineGroups[startLineIndex + lineOffset];
      if (!lineGroup || lineGroup.length === 0) {
        return null;
      }

      const noteheadIndex = lineEventMap[remainingBeatIndex] ?? 0;
      return lineGroup[noteheadIndex] ?? lineGroup.at(-1) ?? null;
    }

    remainingBeatIndex -= lineEventCount;
  }

  return null;
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
    // When displayed and structured event counts still match, abcjs notehead
    // order already lines up with playback and we can index directly.
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
    // Expanded rendered output can preserve one visible run per playback pass,
    // so map within the rendered part template before trying compact reuse.
    const mappedNotehead = resolveTemplateNotehead(
      lineGroups,
      displayedPartTemplate.startLineIndex,
      displayedPartTemplate.lineNoteheadEventMaps,
      position.remainingBeatIndex
    );
    if (mappedNotehead) {
      return mappedNotehead;
    }
  }

  const compactTemplates = buildCompactDisplaySectionTemplates(
    displayAbc ?? fullAbc,
    parts
  );
  if (compactTemplates.length > 0) {
    // Compact repeated notation reuses the same visible section template for
    // later passes, so map back onto the matching compact section key.
    const template = compactTemplates.find(
      (candidate) => candidate.key === getSectionTemplateKey(position.part)
    );

    if (!template) {
      return null;
    }

    return resolveTemplateNotehead(
      lineGroups,
      template.startLineIndex,
      template.lineNoteheadEventMaps,
      position.remainingBeatIndex
    );
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

  // Last resort: stay on the resolved display line even when the rendered note
  // shape is not rich enough to classify more precisely.
  return lineGroup[position.remainingBeatIndex % lineGroup.length] ?? null;
}
