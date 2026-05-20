import { Dialog as DialogPrimitive } from "@kobalte/core/dialog";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import abcjs from "abcjs";
import {
  EllipsisVertical,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Square,
  SquarePen,
  Trash2,
  X,
} from "lucide-solid";
import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { toast } from "solid-sonner";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  createEditableRhythmPattern,
  deleteEditableRhythmPattern,
  type EditableRhythmPatternScope,
  getEditableRhythmPatternById,
  updateEditableRhythmPattern,
} from "@/lib/db/queries/rhythm-patterns";
import { createIsMobile } from "@/lib/hooks/useIsMobile";
import type {
  RhythmPatternCandidate,
  RhythmPatternCandidateScope,
  RhythmPatternType,
} from "@/lib/services/RhythmService";
import { createRhythmService } from "@/lib/services/RhythmService";
import { cn } from "@/lib/utils";
import { AbcNotation } from "../tunes/AbcNotation";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Switch, SwitchControl, SwitchLabel, SwitchThumb } from "../ui/switch";
import "./rhythm-player.css";

export interface RhythmPlayerProps {
  tuneTypeName: string | null;
  tuneId?: string | null;
  structure?: string | null;
  genreId?: string | null;
  genreName?: string | null;
  class?: string;
  onClose?: () => void;
}

interface ActiveBeatTarget {
  element: SVGElement;
  previousFill: string;
  previousStroke: string;
}

interface StructurePart {
  label: string;
  bars: number;
}

interface StructureSection {
  label: string;
  bars: number;
  repeatCount: number;
}

interface SectionTemplate {
  label: string;
  bars: number;
  bodyBars: string[];
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

interface StartSectionOption {
  value: string;
  label: string;
  barsBefore: number;
}

interface PlaybackStartState {
  barsBefore: number;
  beatIndex: number;
}

type CustomPatternEditorMode = "create" | "edit";

const DEFAULT_BARS_PER_PART = 8;
const STRUCTURE_TOKEN = /([^\d\s])(\d*)/g;
const ACTIVE_NOTE_COLOR = "#60a5fa";
const CUSTOM_PATTERN_SAMPLE_KIT_OPTIONS = [
  { value: "bodhran", label: "Bodhran" },
  { value: "generic_click", label: "Generic click" },
] as const;
const CUSTOM_PATTERN_SCOPE_OPTIONS = {
  user_default: "All tunes of this type",
  user_tune: "This tune only",
} as const;

function normalizeStructure(structure?: string | null): string | null {
  const trimmed = structure?.trim();
  return trimmed ? trimmed : null;
}

function parseStructure(structure?: string | null): StructurePart[] {
  if (!structure) {
    return [{ label: "Loop", bars: DEFAULT_BARS_PER_PART }];
  }

  const parts: StructurePart[] = [];
  for (const match of structure.matchAll(STRUCTURE_TOKEN)) {
    const [, rawLabel, rawBars] = match;
    const bars = Number.parseInt(rawBars, 10);
    parts.push({
      label: rawLabel.toUpperCase(),
      bars: Number.isFinite(bars) ? bars : DEFAULT_BARS_PER_PART,
    });
  }

  return parts.length > 0
    ? parts
    : [{ label: "Loop", bars: DEFAULT_BARS_PER_PART }];
}

function collapseStructureSections(parts: StructurePart[]): StructureSection[] {
  const sections: StructureSection[] = [];

  for (const part of parts) {
    const previous = sections.at(-1);
    if (
      previous &&
      previous.label === part.label &&
      previous.bars === part.bars
    ) {
      previous.repeatCount += 1;
      continue;
    }

    sections.push({
      label: part.label,
      bars: part.bars,
      repeatCount: 1,
    });
  }

  return sections;
}

function parseStructureTotalBars(structure?: string | null): number {
  return parseStructure(structure).reduce(
    (sum: number, part: { bars: number }) => sum + part.bars,
    0
  );
}

function getStructureStartOptions(
  structure?: string | null
): StartSectionOption[] {
  if (!normalizeStructure(structure)) {
    return [{ value: "start", label: "Start", barsBefore: 0 }];
  }

  const parts = parseStructure(structure);
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

function beatsPerMeasureFromSignature(rhythmSignature?: string | null): number {
  const numerator = Number.parseInt(rhythmSignature?.split("/")[0] ?? "", 10);
  return Number.isFinite(numerator) && numerator > 0 ? numerator : 4;
}

function getMeasureDurationMs(
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

function getStructuredPlaybackStartState(
  abc: string | null,
  structure: string | null | undefined,
  option: StartSectionOption | null | undefined
): PlaybackStartState {
  const barsBefore = Math.max(0, option?.barsBefore ?? 0);
  if (!abc || !normalizeStructure(structure) || barsBefore <= 0) {
    return { barsBefore, beatIndex: 0 };
  }

  const { bodyBars } = splitAbcSections(abc);
  const structuredBars = buildStructuredPlaybackBody(
    bodyBars,
    parseStructure(structure)
  );

  const beatIndex = structuredBars
    .slice(0, barsBefore)
    .reduce((sum, bar) => sum + countBarEvents(bar), 0);

  return {
    barsBefore,
    beatIndex,
  };
}

function normalizeAbcBodyBars(abcBody: string): string[] {
  return abcBody
    .replace(/^\s*\|:/, "")
    .replace(/:\|\s*$/, "")
    .split("|")
    .map((segment) => segment.replace(/^:+|:+$/g, "").trim())
    .filter(Boolean);
}

function expandSeedRhythmAbc(abc: string, structuredBarCount: number): string {
  if (structuredBarCount <= 0) {
    return abc;
  }

  const lines = abc
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const headerLines = lines.filter((line) => /^[A-Z]:/.test(line));
  const bodyLines = lines.filter((line) => !/^[A-Z]:/.test(line));
  const bodyBars = normalizeAbcBodyBars(bodyLines.join(" "));

  if (bodyBars.length === 0 || structuredBarCount <= bodyBars.length) {
    return abc;
  }

  const expandedBars = Array.from(
    { length: structuredBarCount },
    (_value, index) => bodyBars[index % bodyBars.length]
  );

  return [...headerLines, `| ${expandedBars.join(" | ")} |`].join("\n");
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

function getSectionTemplateKey(
  part: Pick<StructurePart, "label" | "bars">
): string {
  return `${part.label}:${part.bars}`;
}

function getDistinctStructureParts(parts: StructurePart[]): StructurePart[] {
  const distinctParts: StructurePart[] = [];

  for (const part of parts) {
    const key = getSectionTemplateKey(part);
    if (
      !distinctParts.some(
        (candidate) => getSectionTemplateKey(candidate) === key
      )
    ) {
      distinctParts.push(part);
    }
  }

  return distinctParts;
}

function getSectionBodyBars(sectionBars: string[], bars: number): string[] {
  if (sectionBars.length === 0 || bars <= 0) {
    return [];
  }

  return Array.from(
    { length: bars },
    (_value, index) =>
      sectionBars[index % sectionBars.length] ?? sectionBars[0] ?? ""
  );
}

function buildSectionTemplates(
  bodyBars: string[],
  parts: StructurePart[]
): Map<string, SectionTemplate> {
  const templates = new Map<string, SectionTemplate>();
  if (bodyBars.length === 0 || parts.length === 0) {
    return templates;
  }

  const uniqueParts = getDistinctStructureParts(parts);

  let bodyOffset = 0;
  for (const part of uniqueParts) {
    const remainingBars = bodyBars.slice(bodyOffset);
    const directBars = remainingBars.slice(0, part.bars);
    const templateBars = getSectionBodyBars(
      directBars.length > 0 ? directBars : bodyBars,
      part.bars
    );

    templates.set(getSectionTemplateKey(part), {
      label: part.label,
      bars: part.bars,
      bodyBars: templateBars,
    });

    bodyOffset += Math.min(part.bars, remainingBars.length);
  }

  return templates;
}

function buildStructuredPlaybackSections(
  bodyBars: string[],
  parts: StructurePart[]
): string[][] {
  if (bodyBars.length === 0 || parts.length === 0) {
    return [];
  }

  const totalStructuredBarCount = parts.reduce(
    (sum, part) => sum + part.bars,
    0
  );

  // If the source ABC already contains the full structured form, preserve the
  // sequential part boundaries instead of re-deriving templates from only the
  // first distinct section instances.
  if (bodyBars.length >= totalStructuredBarCount) {
    let bodyOffset = 0;

    return parts.map((part) => {
      const sectionBars = bodyBars.slice(bodyOffset, bodyOffset + part.bars);
      bodyOffset += part.bars;
      return getSectionBodyBars(sectionBars, part.bars);
    });
  }

  const templates = buildSectionTemplates(bodyBars, parts);
  return parts.map((part) => {
    const template = templates.get(getSectionTemplateKey(part));
    return template?.bodyBars ?? getSectionBodyBars(bodyBars, part.bars);
  });
}

function buildStructuredPlaybackBody(
  bodyBars: string[],
  parts: StructurePart[]
): string[] {
  return buildStructuredPlaybackSections(bodyBars, parts).flat();
}

function countBarEvents(bar: string): number {
  const matches = bar
    .replace(/![^!]+!/g, "")
    .replace(/"[^"]*"/g, "")
    .match(/[_^=]*[A-Ga-gxzXZ]/g);

  return matches?.length ?? 0;
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

function getStructuredPlaybackPosition(
  sourceAbc: string | null,
  structure: string | null | undefined,
  currentBeatIndex: number
): StructuredPlaybackPosition | null {
  if (!sourceAbc || !structure || currentBeatIndex < 1) {
    return null;
  }

  const parts = parseStructure(structure);
  const collapsedSections = collapseStructureSections(parts);
  if (parts.length === 0 || collapsedSections.length === 0) {
    return null;
  }

  const { bodyBars } = splitAbcSections(sourceAbc);
  if (bodyBars.length === 0) {
    return null;
  }

  const partEventCounts = buildStructuredPlaybackSections(bodyBars, parts).map(
    (sectionBars) =>
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
  sourceAbc: string | null,
  structure: string | null | undefined,
  currentBeatIndex: number
): string | null {
  const position = getStructuredPlaybackPosition(
    sourceAbc,
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
  sourceAbc: string | null,
  structure: string | null | undefined,
  currentBeatIndex: number
): void {
  if (!sourceAbc || !structure) {
    return;
  }

  const parts = parseStructure(structure);
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
    sourceAbc,
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
  sourceAbc: string | null,
  structure: string | null | undefined,
  currentBeatIndex: number
): SVGElement | null {
  if (
    !sourceAbc ||
    !structure ||
    currentBeatIndex < 1 ||
    noteheads.length === 0
  ) {
    return null;
  }

  const position = getStructuredPlaybackPosition(
    sourceAbc,
    structure,
    currentBeatIndex
  );
  const parts = parseStructure(structure);
  if (!position || parts.length === 0) {
    return null;
  }

  const lineGroups = groupNoteheadsByDisplayLine(noteheads);
  const compactTemplates = buildCompactDisplaySectionTemplates(
    sourceAbc,
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

function splitAbcSections(abc: string): {
  headerLines: string[];
  bodyBars: string[];
} {
  const lines = abc
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);

  return {
    headerLines: lines.filter((line) => /^[A-Z]:/.test(line)),
    bodyBars: normalizeAbcBodyBars(
      lines.filter((line) => !/^[A-Z]:/.test(line)).join(" ")
    ),
  };
}

function getAbcBodyLines(abc: string): string[] {
  return abc
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .filter((line) => !/^[A-Z]:/.test(line));
}

interface CompactDisplaySectionTemplate {
  key: string;
  startLineIndex: number;
  lineEventCounts: number[];
}

function buildCompactDisplaySectionTemplates(
  abc: string,
  parts: StructurePart[]
): CompactDisplaySectionTemplate[] {
  const { bodyBars } = splitAbcSections(abc);
  const distinctParts = getDistinctStructureParts(parts);
  const distinctStructureBarCount = distinctParts.reduce(
    (sum, part) => sum + part.bars,
    0
  );

  if (
    distinctParts.length === 0 ||
    distinctParts.length === parts.length ||
    bodyBars.length > distinctStructureBarCount
  ) {
    return [];
  }

  const bodyLines = getAbcBodyLines(abc);
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

function normalizeDisplayHeaderLine(line: string): string | null {
  if (line.startsWith("X:")) {
    return "X:1";
  }

  if (line.startsWith("T:")) {
    return null;
  }

  if (line.startsWith("Q:")) {
    return null;
  }

  return line;
}

function wrapDisplayBodyLine(line: string, maxBarsPerLine = 4): string[] {
  const trimmed = line.trim();
  if (!trimmed || /^P:/.test(trimmed)) {
    return trimmed ? [trimmed] : [];
  }

  const bodyBars = normalizeAbcBodyBars(trimmed);
  if (bodyBars.length === 0 || bodyBars.length <= maxBarsPerLine) {
    return [trimmed];
  }

  const hasRepeatStart = /^\|:/.test(trimmed);
  const hasRepeatEnd = /:\|\s*$/.test(trimmed);
  const wrappedLines: string[] = [];

  for (let index = 0; index < bodyBars.length; index += maxBarsPerLine) {
    const chunk = bodyBars.slice(index, index + maxBarsPerLine);
    const isFirstChunk = index === 0;
    const isLastChunk = index + maxBarsPerLine >= bodyBars.length;
    const prefix = isFirstChunk && hasRepeatStart ? "|: " : "| ";
    const suffix = isLastChunk && hasRepeatEnd ? " :|" : " |";

    wrappedLines.push(`${prefix}${chunk.join(" | ")}${suffix}`);
  }

  return wrappedLines;
}

function buildStructuredFullTrackBody(
  bodyBars: string[],
  parts: StructurePart[]
): string[] {
  if (bodyBars.length === 0) {
    return [];
  }

  const templates = buildSectionTemplates(bodyBars, parts);

  return collapseStructureSections(parts).flatMap((section) => {
    const sectionBars =
      templates.get(getSectionTemplateKey(section))?.bodyBars ??
      getSectionBodyBars(bodyBars, section.bars);
    const body = sectionBars.join(" | ");
    const sectionBody =
      section.repeatCount > 1 ? `|: ${body} :|` : `| ${body} |`;

    return [`P:${section.label}`, sectionBody];
  });
}

function buildStructuredFullTrackAbc(
  abc: string,
  structure: string | null | undefined
): string {
  if (!normalizeStructure(structure)) {
    return abc;
  }

  const parts = parseStructure(structure);
  const { headerLines, bodyBars } = splitAbcSections(abc);
  const totalStructuredBarCount = parts.reduce(
    (sum, part) => sum + part.bars,
    0
  );

  if (bodyBars.length === 0 || bodyBars.length >= totalStructuredBarCount) {
    return abc;
  }

  const bodyLines = buildStructuredFullTrackBody(bodyBars, parts);

  return bodyLines.length > 0 ? [...headerLines, ...bodyLines].join("\n") : abc;
}

function normalizeFullTrackDisplayAbc(abc: string): string {
  return abc
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .flatMap((line) => {
      if (!/^[A-Z]:/.test(line)) {
        return wrapDisplayBodyLine(line);
      }

      const normalizedLine = normalizeDisplayHeaderLine(line);
      return normalizedLine ? [normalizedLine] : [];
    })
    .join("\n");
}

function buildDisplayRhythmAbc(
  abc: string,
  patternType: RhythmPatternType,
  structure: string | null | undefined
): string {
  const displaySourceAbc =
    patternType === "seed" ? buildStructuredFullTrackAbc(abc, structure) : abc;

  return normalizeFullTrackDisplayAbc(displaySourceAbc);
}

function expandRhythmAbcByPatternType(
  abc: string,
  patternType: RhythmPatternType,
  structuredBarCount: number,
  structure?: string | null
): string {
  if (!normalizeStructure(structure)) {
    return abc;
  }

  const { headerLines, bodyBars } = splitAbcSections(abc);
  const parts = parseStructure(structure);
  const structuredBars = buildStructuredPlaybackBody(bodyBars, parts);
  if (structuredBars.length > 0) {
    const distinctStructureBarCount = getDistinctStructureParts(parts).reduce(
      (sum, part) => sum + part.bars,
      0
    );
    const shouldExpandCompactFullTrack =
      patternType !== "full_track" ||
      bodyBars.length <= distinctStructureBarCount;

    // Some full-track uploads only encode each distinct section once (for
    // example A+B with a tune structure of AABB). Expand those to the full
    // repeated form for playback so section-start offsets land on the intended
    // occurrence. Keep already-expanded full tracks unchanged.
    if (
      shouldExpandCompactFullTrack &&
      structuredBars.length !== bodyBars.length
    ) {
      return [...headerLines, `| ${structuredBars.join(" | ")} |`].join("\n");
    }

    if (patternType !== "full_track") {
      return [...headerLines, `| ${structuredBars.join(" | ")} |`].join("\n");
    }
  }

  return patternType === "seed"
    ? expandSeedRhythmAbc(abc, structuredBarCount)
    : abc;
}

function getBeatNoteTargets(container: HTMLDivElement): SVGElement[] {
  return Array.from(container.querySelectorAll<SVGElement>(".abcjs-notehead"));
}

function collectHighlightTargets(notehead: SVGElement): SVGElement[] {
  const targets: SVGElement[] = [notehead];
  const noteGroup = notehead.closest(".abcjs-note");

  if (noteGroup instanceof SVGElement && noteGroup !== notehead) {
    targets.push(noteGroup);
  }

  return targets;
}

function getPatternScopeLabel(scope: RhythmPatternCandidateScope): string {
  switch (scope) {
    case "user_tune":
      return "Your tune override";
    case "tune_default":
      return "Tune override";
    case "user_default":
      return "Your default";
    case "system_default":
      return "System default";
    default:
      return "Shared pattern";
  }
}

function getPatternOptionLabel(candidate: RhythmPatternCandidate): string {
  const descriptors = [getPatternScopeLabel(candidate.scope)];
  if (candidate.patternType === "full_track") {
    descriptors.push("Full track");
  }
  if (candidate.hasPremiumAudio) {
    descriptors.push("Premium loop");
  }

  return `${candidate.name} (${descriptors.join(" - ")})`;
}

function buildCustomPatternTemplate(
  title: string,
  rhythmSignature?: string | null
): string {
  const safeTitle = title.trim() || "Custom Rhythm Pattern";

  return [
    "X:1",
    `T:${safeTitle}`,
    `M:${rhythmSignature?.trim() || "4/4"}`,
    "L:1/8",
    "K:clef=perc",
    "|: z2 z2 z2 z2 :|",
  ].join("\n");
}

function validateCustomPatternDraft(input: {
  name: string;
  abcString: string;
}): string | null {
  if (!input.name.trim()) {
    return "Enter a pattern name before saving.";
  }

  const abcString = input.abcString.trim();
  if (!abcString) {
    return "Enter ABC notation before saving this pattern.";
  }

  const requiredHeaders = ["M:", "L:", "K:"];
  const missingHeader = requiredHeaders.find(
    (header) => !new RegExp(`^\\s*${header}`, "m").test(abcString)
  );
  if (missingHeader) {
    return `ABC notation must include a ${missingHeader} header.`;
  }

  try {
    const parsed = abcjs.parseOnly(abcString);
    if (!Array.isArray(parsed) || !parsed[0]) {
      return "ABC notation could not be parsed.";
    }
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "ABC notation could not be parsed.";
  }

  return null;
}

export const RhythmPlayer: Component<RhythmPlayerProps> = (props) => {
  const { localDb, user } = useAuth();
  const isMobile = createIsMobile();
  let activeBeatTargets: ActiveBeatTarget[] = [];
  let lastToastError: string | null = null;
  let customPatternNameInputRef: HTMLInputElement | undefined;

  const [isPatternLoading, setIsPatternLoading] = createSignal(false);
  const [notationHostRef, setNotationHostRef] = createSignal<HTMLDivElement>();
  const [sourceRhythmAbc, setSourceRhythmAbc] = createSignal<string | null>(
    null
  );
  const [usePremiumLoop, setUsePremiumLoop] = createSignal(false);
  const [requestedPatternId, setRequestedPatternId] = createSignal<
    string | null
  >(null);
  const [currentPatternId, setCurrentPatternId] = createSignal<string | null>(
    null
  );
  const [selectedStartSection, setSelectedStartSection] = createSignal("start");
  const [showOverflowMenu, setShowOverflowMenu] = createSignal(false);
  const [patternReloadKey, setPatternReloadKey] = createSignal(0);
  const [isCustomPatternEditorOpen, setIsCustomPatternEditorOpen] =
    createSignal(false);
  const [customPatternMode, setCustomPatternMode] =
    createSignal<CustomPatternEditorMode>("create");
  const [customPatternId, setCustomPatternId] = createSignal<string | null>(
    null
  );
  const [customPatternName, setCustomPatternName] = createSignal("");
  const [customPatternAbc, setCustomPatternAbc] = createSignal("");
  const [customPatternPatternType, setCustomPatternPatternType] =
    createSignal<RhythmPatternType>("seed");
  const [customPatternSampleKit, setCustomPatternSampleKit] =
    createSignal("bodhran");
  const [customPatternScope, setCustomPatternScope] =
    createSignal<EditableRhythmPatternScope>(
      props.tuneId?.trim() ? "user_tune" : "user_default"
    );
  const [customPatternError, setCustomPatternError] = createSignal<
    string | null
  >(null);
  const [isCustomPatternLoading, setIsCustomPatternLoading] =
    createSignal(false);
  const [isCustomPatternSaving, setIsCustomPatternSaving] = createSignal(false);
  const [isCustomPatternDeleting, setIsCustomPatternDeleting] =
    createSignal(false);
  const [isDeleteCustomPatternDialogOpen, setIsDeleteCustomPatternDialogOpen] =
    createSignal(false);

  const service = createMemo(() => {
    const db = localDb();
    return db
      ? createRhythmService({
          db,
          initialCountInMeasures: 1,
          preferPremiumLoop: usePremiumLoop,
        })
      : null;
  });

  const metadata = createMemo(() => service()?.metadata() ?? null);
  const tempoQpm = createMemo(() => service()?.tempoQpm() ?? 100);
  const isPlaying = createMemo(() => service()?.isPlaying() ?? false);
  const isPaused = createMemo(() => service()?.isPaused() ?? false);
  const isReady = createMemo(() => service()?.isReady() ?? false);
  const isCountIn = createMemo(() => service()?.isCountIn() ?? false);
  const countInPulse = createMemo(() => service()?.countInPulse() ?? 0);
  const countInTotalPulses = createMemo(
    () => service()?.countInTotalPulses() ?? 0
  );
  const currentBeatIndex = createMemo(() => service()?.currentBeatIndex() ?? 0);
  const currentPulse = createMemo(() => service()?.currentPulse() ?? 0);
  const currentMeasure = createMemo(() => service()?.currentMeasure() ?? 0);
  const error = createMemo(() => service()?.error() ?? null);
  const effectiveStructure = createMemo(
    () =>
      normalizeStructure(props.structure) ?? metadata()?.tuneStructure ?? null
  );
  const totalBars = createMemo(() =>
    parseStructureTotalBars(effectiveStructure())
  );
  const pulsesPerBar = createMemo(() =>
    beatsPerMeasureFromSignature(metadata()?.rhythmSignature ?? null)
  );
  const patternCandidates = createMemo(
    () => metadata()?.patternCandidates ?? []
  );
  const displayedPatternId = createMemo(
    () => currentPatternId() ?? requestedPatternId() ?? null
  );
  const currentPattern = createMemo(
    () =>
      patternCandidates().find(
        (candidate) => candidate.id === displayedPatternId()
      ) ?? null
  );
  const currentPatternChoiceId = createMemo(() => displayedPatternId() ?? "");
  const selectedEditablePatternId = createMemo(() => {
    const candidate = currentPattern();
    if (!candidate) {
      return null;
    }

    return candidate.scope === "user_default" || candidate.scope === "user_tune"
      ? candidate.id
      : null;
  });
  const rhythmPatternContext = createMemo(() => ({
    genreName: metadata()?.genreName ?? props.genreName?.trim() ?? null,
    genreId: metadata()?.genreId ?? props.genreId?.trim() ?? null,
    tuneTypeName:
      metadata()?.tuneTypeName ?? props.tuneTypeName?.trim() ?? null,
    tuneTypeId: metadata()?.tuneTypeId ?? null,
    rhythmSignature: metadata()?.rhythmSignature ?? null,
    sampleKit: metadata()?.sampleKit ?? "bodhran",
    patternType: metadata()?.patternType ?? "seed",
  }));
  const canManageCustomPatterns = createMemo(() =>
    Boolean(
      localDb() &&
        user()?.id &&
        rhythmPatternContext().genreName &&
        rhythmPatternContext().tuneTypeName
    )
  );
  const startSectionOptions = createMemo(() =>
    getStructureStartOptions(effectiveStructure())
  );
  const selectedStartSectionOption = createMemo(
    () =>
      startSectionOptions().find(
        (option) => option.value === selectedStartSection()
      ) ??
      startSectionOptions()[0] ?? {
        value: "start",
        label: "Start",
        barsBefore: 0,
      }
  );
  const unifiedSourceAbc = createMemo(() => {
    const abc = sourceRhythmAbc();
    if (!abc) {
      return null;
    }

    return (metadata()?.patternType ?? "seed") === "seed"
      ? buildStructuredFullTrackAbc(abc, effectiveStructure())
      : abc;
  });
  const selectedPlaybackStartState = createMemo(() =>
    getStructuredPlaybackStartState(
      unifiedSourceAbc(),
      effectiveStructure(),
      selectedStartSectionOption()
    )
  );
  const selectedStartPositionMs = createMemo(
    () =>
      selectedPlaybackStartState().barsBefore *
      getMeasureDurationMs(metadata()?.rhythmSignature ?? null, tempoQpm())
  );

  /**
   * Expand the rhythm ABC to fill every measure of the tune structure so the
   * rendered staff shows the full multi-section pattern, not just a 1-2 bar loop.
   */
  const expandedAbc = createMemo(() => {
    const abc = unifiedSourceAbc();
    const structure = effectiveStructure();
    if (!abc) return null;
    if (!structure) return abc;

    const structuredBarCount = parseStructureTotalBars(structure);
    if (structuredBarCount <= 0) return abc;

    return expandRhythmAbcByPatternType(
      abc,
      "full_track",
      structuredBarCount,
      structure
    );
  });

  const displayAbc = createMemo(() => {
    const abc = unifiedSourceAbc();
    if (!abc) return null;

    return buildDisplayRhythmAbc(abc, "full_track", effectiveStructure());
  });

  const playbackAbc = createMemo(() => {
    return expandedAbc();
  });

  const selectedPlaybackStartAbc = createMemo(() =>
    rotatePlaybackRhythmAbc(
      playbackAbc(),
      selectedPlaybackStartState().barsBefore
    )
  );

  const currentBar = createMemo(() => currentMeasure() || 0);
  const currentSectionLabel = createMemo(() =>
    getStructuredSectionLabel(
      unifiedSourceAbc(),
      effectiveStructure(),
      currentBeatIndex()
    )
  );
  const playbackReadyLabel = createMemo(() => {
    if (metadata()?.premiumAudioUrl && usePremiumLoop()) {
      return isReady()
        ? "Premium loop loaded and ready."
        : "Premium loop loads on first playback.";
    }

    return isReady()
      ? "Samples loaded and ready."
      : "Samples load on first playback.";
  });
  const playerTitle = createMemo(() => {
    const tuneTypeName = props.tuneTypeName?.trim();
    return tuneTypeName ? `Rhythm Player: ${tuneTypeName}` : "Rhythm Player";
  });

  const closeCustomPatternEditor = () => {
    setIsCustomPatternEditorOpen(false);
    setIsDeleteCustomPatternDialogOpen(false);
    setCustomPatternError(null);
    setCustomPatternId(null);
  };

  const openCreateCustomPatternEditor = () => {
    const tuneTypeName = rhythmPatternContext().tuneTypeName ?? "Custom";
    const selectedCandidateName = currentPattern()?.name?.trim();
    const baseName = selectedCandidateName
      ? `${selectedCandidateName} copy`
      : `My ${tuneTypeName} pattern`;

    setCustomPatternMode("create");
    setCustomPatternId(null);
    setCustomPatternScope(props.tuneId?.trim() ? "user_tune" : "user_default");
    setCustomPatternName(baseName);
    setCustomPatternAbc(
      sourceRhythmAbc() ??
        buildCustomPatternTemplate(
          baseName,
          rhythmPatternContext().rhythmSignature
        )
    );
    setCustomPatternPatternType(rhythmPatternContext().patternType);
    setCustomPatternSampleKit(rhythmPatternContext().sampleKit);
    setCustomPatternError(null);
    setIsCustomPatternEditorOpen(true);
  };

  const openEditCustomPatternEditor = async () => {
    const db = localDb();
    const editablePatternId = selectedEditablePatternId();
    const currentUserId = user()?.id ?? null;

    if (!db || !editablePatternId || !currentUserId) {
      return;
    }

    setIsCustomPatternLoading(true);
    setCustomPatternError(null);

    try {
      const existingPattern = await getEditableRhythmPatternById(
        db,
        editablePatternId,
        currentUserId
      );

      if (!existingPattern) {
        throw new Error("The selected custom pattern could not be loaded.");
      }

      setCustomPatternMode("edit");
      setCustomPatternId(existingPattern.id);
      setCustomPatternScope(
        existingPattern.tuneId ? "user_tune" : "user_default"
      );
      setCustomPatternName(existingPattern.name);
      setCustomPatternAbc(existingPattern.abcString);
      setCustomPatternPatternType(
        existingPattern.patternType === "full_track" ? "full_track" : "seed"
      );
      setCustomPatternSampleKit(existingPattern.sampleKit);
      setIsCustomPatternEditorOpen(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load the selected custom pattern.";
      setCustomPatternError(message);
      toast.error(message, { id: "rhythm-player-custom-pattern-error" });
    } finally {
      setIsCustomPatternLoading(false);
    }
  };

  const saveCustomPattern = async () => {
    const db = localDb();
    const currentUserId = user()?.id ?? null;
    const context = rhythmPatternContext();

    if (!db || !currentUserId || !context.genreName || !context.tuneTypeName) {
      const message =
        "Custom patterns need a resolved genre and tune type before they can be saved.";
      setCustomPatternError(message);
      toast.error(message, { id: "rhythm-player-custom-pattern-error" });
      return;
    }

    const validationError = validateCustomPatternDraft({
      name: customPatternName(),
      abcString: customPatternAbc(),
    });
    if (validationError) {
      setCustomPatternError(validationError);
      return;
    }

    setIsCustomPatternSaving(true);
    setCustomPatternError(null);

    try {
      const payload = {
        genreName: context.genreName,
        genreId: context.genreId,
        tuneTypeName: context.tuneTypeName,
        tuneTypeId: context.tuneTypeId,
        name: customPatternName(),
        abcString: customPatternAbc(),
        sampleKit: customPatternSampleKit(),
        patternType: customPatternPatternType(),
        userId: currentUserId,
        scope: customPatternScope(),
        tuneId: props.tuneId?.trim() || null,
      };

      const savedPattern =
        customPatternMode() === "edit" && customPatternId()
          ? await updateEditableRhythmPattern(
              db,
              customPatternId() as string,
              currentUserId,
              payload
            )
          : await createEditableRhythmPattern(db, payload);

      setCustomPatternId(savedPattern.id);
      setRequestedPatternId(savedPattern.id);
      setCurrentPatternId(null);
      setPatternReloadKey((current) => current + 1);
      closeCustomPatternEditor();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to save the custom rhythm pattern.";
      setCustomPatternError(message);
      toast.error(message, { id: "rhythm-player-custom-pattern-error" });
    } finally {
      setIsCustomPatternSaving(false);
    }
  };

  const deleteCustomPattern = async () => {
    const db = localDb();
    const currentUserId = user()?.id ?? null;
    const patternId = customPatternId();

    if (!db || !currentUserId || !patternId) {
      return;
    }

    setIsCustomPatternDeleting(true);
    setCustomPatternError(null);

    try {
      await deleteEditableRhythmPattern(db, patternId, currentUserId);

      if (currentPatternChoiceId() === patternId) {
        setRequestedPatternId(null);
        setCurrentPatternId(null);
      }

      setPatternReloadKey((current) => current + 1);
      closeCustomPatternEditor();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to delete the custom rhythm pattern.";
      setCustomPatternError(message);
      toast.error(message, { id: "rhythm-player-custom-pattern-error" });
    } finally {
      setIsCustomPatternDeleting(false);
      setIsDeleteCustomPatternDialogOpen(false);
    }
  };

  const updateTempo = (value: string) => {
    const parsedTempo = Number.parseInt(value, 10);
    if (!Number.isFinite(parsedTempo)) {
      return;
    }

    const currentService = service();
    if (currentService) {
      void currentService.setTempoQpm(parsedTempo);
    }
  };

  const handlePatternSelectionChange = (value: string) => {
    const nextPatternId = value.trim() || null;

    if (nextPatternId === currentPatternChoiceId()) {
      return;
    }

    setCurrentPatternId(null);
    setRequestedPatternId(nextPatternId);
  };

  createEffect(() => {
    const options = startSectionOptions();
    if (!options.some((option) => option.value === selectedStartSection())) {
      setSelectedStartSection(options[0]?.value ?? "start");
    }
  });

  createEffect<string | undefined>((previousRequestKey) => {
    const nextRequestKey = [
      props.genreId?.trim() || "",
      props.genreName?.trim() || "",
      props.tuneTypeName?.trim() || "",
      props.tuneId?.trim() || "",
      user()?.id ?? "",
    ].join("|");

    if (
      previousRequestKey !== undefined &&
      previousRequestKey !== nextRequestKey &&
      (requestedPatternId() !== null || currentPatternId() !== null)
    ) {
      setRequestedPatternId(null);
      setCurrentPatternId(null);
    }

    if (
      previousRequestKey !== undefined &&
      previousRequestKey !== nextRequestKey
    ) {
      closeCustomPatternEditor();
    }

    return nextRequestKey;
  });

  const clearActiveBeatTargets = () => {
    for (const target of activeBeatTargets) {
      target.element.classList.remove("tnt-active-note");

      if (target.previousFill) {
        target.element.style.setProperty("fill", target.previousFill);
      } else {
        target.element.style.removeProperty("fill");
      }

      if (target.previousStroke) {
        target.element.style.setProperty("stroke", target.previousStroke);
      } else {
        target.element.style.removeProperty("stroke");
      }
    }
    activeBeatTargets = [];
  };

  const getNotationContainer = (): HTMLDivElement | null => {
    const host = notationHostRef();
    if (!host) {
      return null;
    }

    return host.querySelector<HTMLDivElement>(
      "[data-testid='abc-notation-container']"
    );
  };

  createEffect(() => {
    const nextError = error();
    if (!nextError) {
      lastToastError = null;
      return;
    }

    if (nextError === lastToastError) {
      return;
    }

    lastToastError = nextError;
    toast.error(nextError, {
      id: "rhythm-player-error",
    });
  });

  createEffect(() => {
    patternReloadKey();
    const currentRequestedPatternId = requestedPatternId();
    const currentService = service();
    const tuneTypeName = props.tuneTypeName?.trim();

    if (!currentService || !tuneTypeName) {
      setIsPatternLoading(false);
      setSourceRhythmAbc(null);
      return;
    }

    setIsPatternLoading(true);
    void currentService
      .loadPattern({
        genreId: props.genreId?.trim() || null,
        genreName: props.genreName?.trim() || null,
        tuneTypeName,
        tuneId: props.tuneId?.trim() || null,
        userId: user()?.id ?? null,
        ...(currentRequestedPatternId
          ? { selectedPatternId: currentRequestedPatternId }
          : {}),
      })
      .then((nextMetadata) => {
        setCurrentPatternId(nextMetadata?.selectedPatternId?.trim() || null);
        setSourceRhythmAbc(nextMetadata?.rhythmAbc ?? null);
      })
      .finally(() => {
        setIsPatternLoading(false);
      });
  });

  // Push explicit playback ABC to the service so seed-pattern timing does not
  // depend on repeat markers in the rendered notation.
  createEffect(() => {
    const svc = service();
    const abc = playbackAbc();
    if (svc && abc) {
      svc.updateRhythmAbc(abc);
    }
  });

  createEffect(() => {
    if (!metadata()?.premiumAudioUrl && usePremiumLoop()) {
      setUsePremiumLoop(false);
    }
  });

  createEffect(() => {
    const container = getNotationContainer();
    const sourceAbc = unifiedSourceAbc();
    const structure = effectiveStructure();
    const beatIndex = currentBeatIndex();

    if (!container || !sourceAbc || !structure) {
      return;
    }

    updateStructuredDisplayPartLabels(
      container,
      sourceAbc,
      structure,
      beatIndex
    );
  });

  createEffect(() => {
    const container = getNotationContainer();
    const beatIndex = currentBeatIndex();
    const rhythmAbc = displayAbc();
    const sourceAbc = unifiedSourceAbc();
    const structure = effectiveStructure();

    if (!container || !rhythmAbc) {
      return;
    }

    const noteheads = getBeatNoteTargets(container);
    if (noteheads.length === 0 || beatIndex < 1) {
      clearActiveBeatTargets();
      return;
    }

    const structuredTarget = resolveStructuredDisplayNotehead(
      noteheads,
      sourceAbc,
      structure,
      beatIndex
    );
    const fallbackTarget =
      noteheads[(beatIndex - 1) % noteheads.length] ?? null;
    const nextNotehead = structuredTarget ?? fallbackTarget;
    if (!nextNotehead) {
      clearActiveBeatTargets();
      return;
    }

    const nextTargets = collectHighlightTargets(nextNotehead);
    const isSameTargetSet =
      nextTargets.length === activeBeatTargets.length &&
      nextTargets.every(
        (element, index) => element === activeBeatTargets[index]?.element
      );

    if (isSameTargetSet) {
      return;
    }

    clearActiveBeatTargets();
    activeBeatTargets = nextTargets.map((element) => {
      const previousFill = element.style.getPropertyValue("fill");
      const previousStroke = element.style.getPropertyValue("stroke");

      element.classList.add("tnt-active-note");
      element.style.setProperty("fill", ACTIVE_NOTE_COLOR);
      element.style.setProperty("stroke", ACTIVE_NOTE_COLOR);

      return {
        element,
        previousFill,
        previousStroke,
      };
    });
  });

  onCleanup(() => {
    clearActiveBeatTargets();
  });

  return (
    <Card
      class={cn(
        "flex h-full min-h-0 flex-col border-slate-200 dark:border-slate-800",
        props.class
      )}
    >
      <CardHeader class="space-y-3">
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p
                class={cn(
                  "hidden text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 md:block",
                  props.onClose ? "md:hidden" : undefined
                )}
              >
                Rhythm Practice
              </p>
              <CardTitle
                class="text-lg leading-tight text-slate-900 dark:text-slate-50 sm:text-xl"
                data-testid="rhythm-player-title"
              >
                {playerTitle()}
              </CardTitle>
            </div>

            <div class="flex items-center gap-2">
              <Show when={isMobile()}>
                <DropdownMenu
                  open={showOverflowMenu()}
                  onOpenChange={setShowOverflowMenu}
                >
                  <DropdownMenu.Trigger
                    type="button"
                    aria-label="Rhythm player options"
                    class="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                    data-testid="rhythm-player-overflow-button"
                  >
                    <EllipsisVertical class="h-4 w-4" />
                    <span class="sr-only">Rhythm player options</span>
                  </DropdownMenu.Trigger>

                  <DropdownMenu.Portal>
                    <DropdownMenu.Content class="z-50 min-w-[16rem] rounded-2xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-950">
                      <div class="space-y-3 p-1">
                        <label class="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <span class="font-medium text-slate-900 dark:text-slate-100">
                            Start section
                          </span>
                          <select
                            value={selectedStartSection()}
                            onChange={(event) => {
                              setSelectedStartSection(
                                event.currentTarget.value
                              );
                            }}
                            class="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            data-testid="rhythm-player-start-section-select"
                          >
                            <For each={startSectionOptions()}>
                              {(option) => (
                                <option value={option.value}>
                                  {option.label}
                                </option>
                              )}
                            </For>
                          </select>
                        </label>

                        <div class="h-px bg-slate-200 dark:bg-slate-800" />

                        <label class="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <span class="font-medium text-slate-900 dark:text-slate-100">
                            Tempo {tempoQpm()} QPM
                          </span>
                          <input
                            type="number"
                            min="30"
                            max="240"
                            step="1"
                            inputMode="numeric"
                            value={tempoQpm()}
                            onChange={(event) => {
                              updateTempo(event.currentTarget.value);
                            }}
                            class="min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            data-testid="rhythm-player-tempo-input"
                          />
                          <input
                            type="range"
                            min="30"
                            max="240"
                            step="1"
                            value={tempoQpm()}
                            onInput={(event) => {
                              updateTempo(event.currentTarget.value);
                            }}
                            class="w-full accent-blue-600"
                            data-testid="rhythm-player-tempo-slider"
                          />
                        </label>
                      </div>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu>
              </Show>

              <Show when={props.onClose}>
                <button
                  type="button"
                  class="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                  aria-label="Close rhythm player"
                  data-testid="rhythm-player-close-button"
                  onClick={() => props.onClose?.()}
                >
                  <X class="h-4 w-4" />
                  <span class="sr-only">Close rhythm player</span>
                </button>
              </Show>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 sm:gap-3 md:flex-nowrap md:items-center md:justify-between">
            <Show when={!isMobile()}>
              <div class="min-w-0 items-center gap-2 text-sm text-slate-600 dark:text-slate-300 md:flex">
                <label class="flex min-w-24 items-center gap-2">
                  <span class="font-medium whitespace-nowrap text-slate-900 dark:text-slate-100">
                    Start section
                  </span>
                  <select
                    value={selectedStartSection()}
                    onChange={(event) => {
                      setSelectedStartSection(event.currentTarget.value);
                    }}
                    class="min-w-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    data-testid="rhythm-player-start-section-select"
                  >
                    <For each={startSectionOptions()}>
                      {(option) => (
                        <option value={option.value}>{option.label}</option>
                      )}
                    </For>
                  </select>
                </label>
              </div>
            </Show>

            <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3 md:justify-center">
              <button
                type="button"
                onClick={() => {
                  const currentService = service();
                  if (!currentService) {
                    return;
                  }

                  if (isPlaying()) {
                    currentService.stop();
                    return;
                  }

                  const usePremiumStartOffset =
                    Boolean(metadata()?.premiumAudioUrl) && usePremiumLoop();

                  void currentService.play({
                    startPositionMs: usePremiumStartOffset
                      ? selectedStartPositionMs()
                      : 0,
                    startBeatIndex: selectedPlaybackStartState().beatIndex,
                    startMeasure: selectedPlaybackStartState().barsBefore,
                    playbackRhythmAbc: usePremiumStartOffset
                      ? undefined
                      : (selectedPlaybackStartAbc() ?? undefined),
                  });
                }}
                disabled={!service() || !metadata() || isPatternLoading()}
                class="inline-flex min-h-11 min-w-[7rem] items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                data-testid="rhythm-player-play-toggle"
              >
                <Show
                  when={!isPatternLoading()}
                  fallback={<LoaderCircle class="h-4 w-4 animate-spin" />}
                >
                  {isPlaying() ? (
                    <Square class="h-4 w-4" />
                  ) : (
                    <Play class="h-4 w-4" />
                  )}
                </Show>
                {isPatternLoading() ? "Loading" : isPlaying() ? "Stop" : "Play"}
              </button>

              <button
                type="button"
                onClick={() => {
                  const currentService = service();
                  if (!currentService) {
                    return;
                  }

                  if (isPlaying()) {
                    currentService.pause();
                    return;
                  }

                  if (isPaused()) {
                    void currentService.resume();
                  }
                }}
                disabled={
                  !service() ||
                  !metadata() ||
                  isPatternLoading() ||
                  (!isPlaying() && !isPaused())
                }
                class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 md:h-auto md:w-auto md:min-w-[7rem] md:gap-2 md:px-4 md:py-2"
                data-testid="rhythm-player-pause-button"
                aria-label={isPlaying() ? "Pause" : "Resume"}
                title={isPlaying() ? "Pause" : "Resume"}
              >
                <Pause class="h-4 w-4" />
                <span class="sr-only">{isPlaying() ? "Pause" : "Resume"}</span>
                <span class="hidden md:inline">
                  {isPlaying() ? "Pause" : "Resume"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const currentService = service();
                  if (currentService) {
                    const usePremiumStartOffset =
                      Boolean(metadata()?.premiumAudioUrl) && usePremiumLoop();

                    void currentService.restart({
                      startPositionMs: usePremiumStartOffset
                        ? selectedStartPositionMs()
                        : 0,
                      startBeatIndex: selectedPlaybackStartState().beatIndex,
                      startMeasure: selectedPlaybackStartState().barsBefore,
                      playbackRhythmAbc: usePremiumStartOffset
                        ? undefined
                        : (selectedPlaybackStartAbc() ?? undefined),
                    });
                  }
                }}
                disabled={
                  !service() ||
                  !metadata() ||
                  isPatternLoading() ||
                  isPlaying() ||
                  !isPaused()
                }
                class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 md:h-auto md:w-auto md:min-w-[7rem] md:gap-2 md:px-4 md:py-2"
                data-testid="rhythm-player-restart-button"
                aria-label="Restart"
                title="Restart"
              >
                <RotateCcw class="h-4 w-4" />
                <span class="sr-only">Restart</span>
                <span class="hidden md:inline">Restart</span>
              </button>

              <Show when={!isMobile()}>
                <div class="ml-auto items-center gap-3 md:flex">
                  <label class="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <span class="font-medium text-slate-900 dark:text-slate-100">
                      Tempo {tempoQpm()} QPM
                    </span>
                    <input
                      type="number"
                      min="30"
                      max="240"
                      step="1"
                      inputMode="numeric"
                      value={tempoQpm()}
                      onChange={(event) => {
                        updateTempo(event.currentTarget.value);
                      }}
                      class="w-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      data-testid="rhythm-player-tempo-input"
                    />
                    <input
                      type="range"
                      min="30"
                      max="240"
                      step="1"
                      value={tempoQpm()}
                      onInput={(event) => {
                        updateTempo(event.currentTarget.value);
                      }}
                      class="w-full accent-blue-600 md:w-56"
                      data-testid="rhythm-player-tempo-slider"
                    />
                  </label>
                </div>
              </Show>
            </div>
          </div>
        </div>

        <Show when={metadata()}>
          {(currentMetadata) => (
            <div class="space-y-3">
              <div class="flex flex-wrap items-center gap-2 md:gap-3">
                <Show when={patternCandidates().length > 1}>
                  <label class="flex min-w-[18rem] flex-1 items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <span class="shrink-0 font-medium text-slate-900 dark:text-slate-100">
                      Pattern:
                    </span>
                    <select
                      value={currentPatternChoiceId()}
                      onChange={(event) => {
                        handlePatternSelectionChange(event.currentTarget.value);
                      }}
                      disabled={isPatternLoading()}
                      class="min-h-11 w-full max-w-[20rem] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900"
                      data-testid="rhythm-player-pattern-select"
                    >
                      <For each={currentMetadata().patternCandidates ?? []}>
                        {(candidate) => (
                          <option value={candidate.id}>
                            {getPatternOptionLabel(candidate)}
                          </option>
                        )}
                      </For>
                    </select>
                  </label>
                </Show>

                <Show when={canManageCustomPatterns()}>
                  <Button
                    type="button"
                    onClick={openCreateCustomPatternEditor}
                    disabled={
                      isCustomPatternSaving() || isCustomPatternLoading()
                    }
                    variant="accent"
                    class="min-h-11 rounded-full px-4"
                    data-testid="rhythm-player-custom-pattern-open-button"
                  >
                    <Plus class="h-4 w-4" />
                    New Custom Pattern
                  </Button>

                  <Show when={selectedEditablePatternId()}>
                    <Button
                      type="button"
                      onClick={() => {
                        void openEditCustomPatternEditor();
                      }}
                      disabled={
                        isCustomPatternSaving() || isCustomPatternLoading()
                      }
                      variant="outline"
                      class="min-h-11 rounded-full px-4"
                      data-testid="rhythm-player-custom-pattern-edit-button"
                    >
                      <SquarePen class="h-4 w-4" />
                      Edit selected custom
                    </Button>
                  </Show>
                </Show>

                <Show when={!canManageCustomPatterns()}>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    Custom patterns need a resolved genre and tune type.
                  </p>
                </Show>
              </div>

              <div class="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  Meter {currentMetadata().rhythmSignature || "Unknown"}
                </span>
                <Show when={effectiveStructure()}>
                  {(structure) => (
                    <span
                      class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      data-testid="rhythm-player-structure"
                    >
                      Structure {structure()}
                    </span>
                  )}
                </Show>
                <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  Bar {currentBar() || 0}
                  <Show when={totalBars() > 0}>
                    <span class="px-1 text-slate-400">/</span>
                    {totalBars()}
                  </Show>
                </span>
                <span
                  class={cn(
                    "rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
                    currentPulse() > 0 ? "visible" : "invisible"
                  )}
                >
                  Pulse {Math.max(1, currentPulse())}
                  <span class="px-1 text-slate-400">/</span>
                  {Math.max(1, pulsesPerBar())}
                </span>
              </div>

              <div class="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300 md:flex-row md:items-start md:justify-between md:gap-4">
                <div class="min-w-0 space-y-1">
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    {playbackReadyLabel()}
                  </p>
                </div>

                <Show when={currentMetadata().premiumAudioUrl}>
                  <Switch
                    checked={usePremiumLoop()}
                    onChange={(checked) => {
                      const currentService = service();
                      const shouldResume = Boolean(
                        currentService && isPlaying()
                      );

                      if (shouldResume) {
                        currentService?.pause();
                      }

                      setUsePremiumLoop(checked);

                      if (shouldResume) {
                        void currentService?.resume();
                      }
                    }}
                    class="flex items-center gap-2 md:justify-end"
                    data-testid="rhythm-player-premium-loop-switch"
                  >
                    <SwitchLabel class="flex-1 cursor-pointer select-none text-sm font-medium text-slate-900 dark:text-slate-100">
                      Use premium loop
                    </SwitchLabel>
                    <span class="text-xs text-slate-500 dark:text-slate-400">
                      {usePremiumLoop() ? "On" : "Off"}
                    </span>
                    <SwitchControl class="ml-1">
                      <SwitchThumb />
                    </SwitchControl>
                  </Switch>
                </Show>
              </div>
            </div>
          )}
        </Show>
      </CardHeader>

      <CardContent class="flex min-h-0 flex-1 flex-col">
        <Show
          when={localDb()}
          fallback={
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Local database is still loading.
            </p>
          }
        >
          <Show
            when={props.tuneTypeName?.trim()}
            fallback={
              <p class="text-sm text-slate-500 dark:text-slate-400">
                Select a tune type to load a rhythm pattern.
              </p>
            }
          >
            <div class="flex min-h-0 flex-1 flex-col gap-4">
              <Show when={error()}>
                <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                  {error()}
                </div>
              </Show>

              <div class="relative flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
                <Show when={isCountIn()}>
                  <div
                    class="pointer-events-none absolute left-4 right-4 top-4 z-10 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
                    data-testid="rhythm-player-count-in-indicator"
                  >
                    <div class="flex items-center justify-between gap-3">
                      <div class="flex min-w-0 items-baseline gap-3 whitespace-nowrap">
                        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                          Count-In
                        </p>
                        <p class="text-sm font-semibold text-amber-900">
                          {countInPulse()} / {countInTotalPulses()}
                        </p>
                      </div>

                      <div class="flex shrink-0 items-center gap-2">
                        <For
                          each={Array.from({ length: countInTotalPulses() })}
                        >
                          {(_value, index) => (
                            <span
                              class={cn(
                                "h-3 w-3 rounded-full border transition-colors",
                                index() < countInPulse()
                                  ? "border-amber-500 bg-amber-500"
                                  : "border-amber-300 bg-white"
                              )}
                            />
                          )}
                        </For>
                      </div>
                    </div>
                  </div>
                </Show>
                <div class="mb-3 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Live Section
                    </span>
                    <Show
                      when={currentSectionLabel()}
                      fallback={
                        <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-400">
                          Waiting
                        </span>
                      }
                    >
                      {(sectionLabel) => (
                        <span
                          class="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700"
                          data-testid="rhythm-player-current-section-badge"
                        >
                          {sectionLabel()}
                        </span>
                      )}
                    </Show>
                  </div>

                  <Show when={effectiveStructure()}>
                    {(structure) => (
                      <span class="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                        {structure()}
                      </span>
                    )}
                  </Show>
                </div>
                <div
                  ref={setNotationHostRef}
                  class="rhythm-player-notation min-h-0 flex-1 overflow-auto bg-white"
                  data-testid="rhythm-player-notation"
                >
                  <AbcNotation
                    notation={displayAbc() ?? ""}
                    class="h-full w-full"
                    scale={0.62}
                  />
                </div>
              </div>
            </div>
          </Show>
        </Show>
      </CardContent>

      <DialogPrimitive
        open={isCustomPatternEditorOpen()}
        onOpenChange={(open) => {
          if (!open) {
            closeCustomPatternEditor();
          }
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay class="fixed inset-0 z-[60] bg-black/50 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0" />
          <DialogPrimitive.Content
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              requestAnimationFrame(() => {
                customPatternNameInputRef?.focus();
              });
            }}
            class="fixed left-[50%] top-[50%] z-[70] flex h-[min(88vh,960px)] w-[min(96vw,980px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border bg-background shadow-xl outline-none data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 data-[closed]:slide-out-to-left-1/2 data-[closed]:slide-out-to-top-[48%] data-[expanded]:slide-in-from-left-1/2 data-[expanded]:slide-in-from-top-[48%]"
            data-testid="rhythm-player-custom-pattern-editor"
          >
            <DialogPrimitive.Title class="sr-only">
              {customPatternMode() === "edit"
                ? "Edit custom rhythm pattern"
                : "Create custom rhythm pattern"}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description class="sr-only">
              Create or edit a personal rhythm pattern in ABC notation.
            </DialogPrimitive.Description>

            <div class="flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6">
              <div class="min-w-0">
                <p class="text-base font-semibold text-foreground">
                  {customPatternMode() === "edit"
                    ? "Edit custom rhythm pattern"
                    : "Create custom rhythm pattern"}
                </p>
                <p class="text-sm text-muted-foreground">
                  Save an ABC rhythm pattern to your local library and reuse it
                  from the selector.
                </p>
              </div>

              <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <Show
                  when={customPatternMode() === "edit" && customPatternId()}
                >
                  <Button
                    type="button"
                    variant="destructive-ghost"
                    onClick={() => setIsDeleteCustomPatternDialogOpen(true)}
                    disabled={
                      isCustomPatternDeleting() || isCustomPatternSaving()
                    }
                    class="min-h-11 px-3"
                    data-testid="rhythm-player-custom-pattern-delete-button"
                  >
                    <Trash2 class="h-4 w-4" />
                    Delete
                  </Button>
                </Show>

                <Button
                  type="button"
                  variant="outline"
                  onClick={closeCustomPatternEditor}
                  class="min-h-11 px-4"
                  data-testid="rhythm-player-custom-pattern-cancel-button"
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  variant="default"
                  onClick={() => {
                    void saveCustomPattern();
                  }}
                  disabled={
                    isCustomPatternSaving() || isCustomPatternDeleting()
                  }
                  class="min-h-11 px-4"
                  data-testid="rhythm-player-custom-pattern-save-button"
                >
                  <Show
                    when={!isCustomPatternSaving()}
                    fallback={<LoaderCircle class="h-4 w-4 animate-spin" />}
                  >
                    <Save class="h-4 w-4" />
                  </Show>
                  {customPatternMode() === "edit"
                    ? "Save changes"
                    : "Save pattern"}
                </Button>
              </div>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <div class="grid gap-4 md:grid-cols-2">
                <label class="flex flex-col gap-2 text-sm text-muted-foreground">
                  <span class="font-medium text-foreground">Name</span>
                  <input
                    ref={customPatternNameInputRef}
                    type="text"
                    value={customPatternName()}
                    onInput={(event) =>
                      setCustomPatternName(event.currentTarget.value)
                    }
                    class="min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-[color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring"
                    data-testid="rhythm-player-custom-pattern-name-input"
                  />
                </label>

                <label class="flex flex-col gap-2 text-sm text-muted-foreground">
                  <span class="font-medium text-foreground">Apply to</span>
                  <select
                    value={customPatternScope()}
                    onChange={(event) => {
                      setCustomPatternScope(
                        event.currentTarget.value as EditableRhythmPatternScope
                      );
                    }}
                    class="min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-[color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring"
                    data-testid="rhythm-player-custom-pattern-scope-select"
                  >
                    <option value="user_default">
                      {CUSTOM_PATTERN_SCOPE_OPTIONS.user_default}
                    </option>
                    <Show when={props.tuneId?.trim()}>
                      <option value="user_tune">
                        {CUSTOM_PATTERN_SCOPE_OPTIONS.user_tune}
                      </option>
                    </Show>
                  </select>
                </label>

                <label class="flex flex-col gap-2 text-sm text-muted-foreground">
                  <span class="font-medium text-foreground">Pattern type</span>
                  <select
                    value={customPatternPatternType()}
                    onChange={(event) => {
                      setCustomPatternPatternType(
                        event.currentTarget.value as RhythmPatternType
                      );
                    }}
                    class="min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-[color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring"
                    data-testid="rhythm-player-custom-pattern-type-select"
                  >
                    <option value="seed">Seed loop</option>
                    <option value="full_track">Full track</option>
                  </select>
                </label>

                <label class="flex flex-col gap-2 text-sm text-muted-foreground">
                  <span class="font-medium text-foreground">Sample kit</span>
                  <select
                    value={customPatternSampleKit()}
                    onChange={(event) => {
                      setCustomPatternSampleKit(event.currentTarget.value);
                    }}
                    class="min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-[color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring"
                    data-testid="rhythm-player-custom-pattern-sample-kit-select"
                  >
                    <For each={CUSTOM_PATTERN_SAMPLE_KIT_OPTIONS}>
                      {(option) => (
                        <option value={option.value}>{option.label}</option>
                      )}
                    </For>
                  </select>
                </label>
              </div>

              <label class="mt-5 flex flex-col gap-2 text-sm text-muted-foreground">
                <span class="font-medium text-foreground">ABC notation</span>
                <textarea
                  value={customPatternAbc()}
                  onInput={(event) =>
                    setCustomPatternAbc(event.currentTarget.value)
                  }
                  rows="10"
                  class="min-h-[14rem] rounded-md border border-input bg-background px-3 py-3 font-mono text-sm text-foreground shadow-sm transition-[color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring"
                  data-testid="rhythm-player-custom-pattern-abc-input"
                />
              </label>

              <Show when={customPatternError()}>
                {(message) => (
                  <div
                    class="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                    data-testid="rhythm-player-custom-pattern-error"
                  >
                    {message()}
                  </div>
                )}
              </Show>

              <div class="mt-5 rounded-2xl border border-border bg-card p-4">
                <p class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Live preview
                </p>
                <AbcNotation
                  notation={customPatternAbc()}
                  showErrors
                  class="w-full"
                />
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive>

      <AlertDialog
        open={isDeleteCustomPatternDialogOpen()}
        onOpenChange={setIsDeleteCustomPatternDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete custom pattern?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the selected custom rhythm pattern from your library.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter class="gap-2 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteCustomPatternDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive-ghost"
              onClick={() => {
                void deleteCustomPattern();
              }}
              disabled={isCustomPatternDeleting()}
            >
              <Show
                when={!isCustomPatternDeleting()}
                fallback={<LoaderCircle class="h-4 w-4 animate-spin" />}
              >
                <Trash2 class="h-4 w-4" />
              </Show>
              Delete pattern
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default RhythmPlayer;
