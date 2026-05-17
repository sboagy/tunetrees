import { LoaderCircle, Pause, Play, RotateCcw, Square } from "lucide-solid";
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
import type { RhythmPatternType } from "@/lib/services/RhythmService";
import { createRhythmService } from "@/lib/services/RhythmService";
import { cn } from "@/lib/utils";
import { AbcNotation } from "../tunes/AbcNotation";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Switch, SwitchControl, SwitchLabel, SwitchThumb } from "../ui/switch";
import "./rhythm-player.css";

export interface RhythmPlayerProps {
  tuneTypeName: string | null;
  tuneId?: string | null;
  structure?: string | null;
  genreName?: string | null;
  class?: string;
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

const DEFAULT_BARS_PER_PART = 8;
const STRUCTURE_TOKEN = /([^\d\s])(\d*)/g;
const ACTIVE_NOTE_COLOR = "#60a5fa";

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
    .map((segment) => segment.trim())
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

  const collapsedSections = collapseStructureSections(
    parseStructure(structure)
  );
  const labelTargets = getDisplayPartLabelTargets(container);
  if (
    collapsedSections.length === 0 ||
    labelTargets.length === 0 ||
    labelTargets.length !== collapsedSections.length
  ) {
    return;
  }

  for (const [index, target] of labelTargets.entries()) {
    const baseLabel = collapsedSections[index]?.label ?? "";
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
  const activeTarget = labelTargets[position.displaySectionIndex];
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
  const collapsedSections = collapseStructureSections(parts);
  if (!position || parts.length === 0 || collapsedSections.length === 0) {
    return null;
  }

  const lineGroups = groupNoteheadsByDisplayLine(noteheads);
  if (lineGroups.length !== collapsedSections.length) {
    return null;
  }

  const lineGroup = lineGroups[position.displaySectionIndex];
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

function buildSectionDisplayBody(
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

    const body = sectionBars.join("|");
    const sectionBody = section.repeatCount > 1 ? `|:${body}:|` : `|${body}|`;

    return [`P:${section.label}`, sectionBody];
  });
}

function buildDisplayRhythmAbc(
  abc: string,
  patternType: RhythmPatternType,
  structure: string | null | undefined
): string {
  const { headerLines, bodyBars } = splitAbcSections(abc);
  const normalizedHeaders = headerLines
    .map(normalizeDisplayHeaderLine)
    .filter((line): line is string => Boolean(line));
  const headers = [
    normalizedHeaders.find((line) => line.startsWith("X:")) ?? "X:1",
    ...normalizedHeaders.filter((line) => !line.startsWith("X:")),
  ];

  if (patternType === "seed" && normalizeStructure(structure)) {
    const sectionLines = buildSectionDisplayBody(
      bodyBars,
      parseStructure(structure)
    );
    if (sectionLines.length > 0) {
      return [...headers, ...sectionLines].join("\n");
    }
  }

  const body = bodyBars.length > 0 ? `|:${bodyBars.join("|")}:|` : "";
  return [...headers, body].filter(Boolean).join("\n");
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

export const RhythmPlayer: Component<RhythmPlayerProps> = (props) => {
  const { localDb, user } = useAuth();
  let activeBeatTargets: ActiveBeatTarget[] = [];
  let lastToastError: string | null = null;

  const [isPatternLoading, setIsPatternLoading] = createSignal(false);
  const [notationHostRef, setNotationHostRef] = createSignal<HTMLDivElement>();
  const [sourceRhythmAbc, setSourceRhythmAbc] = createSignal<string | null>(
    null
  );
  const [usePremiumLoop, setUsePremiumLoop] = createSignal(false);
  const [selectedStartSection, setSelectedStartSection] = createSignal("start");

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
  const selectedPlaybackStartState = createMemo(() =>
    getStructuredPlaybackStartState(
      sourceRhythmAbc(),
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
    const abc = sourceRhythmAbc();
    const patternType = metadata()?.patternType ?? "seed";
    const structure = effectiveStructure();
    if (!abc) return null;
    if (!structure) return abc;

    const structuredBarCount = parseStructureTotalBars(structure);
    if (structuredBarCount <= 0) return abc;

    return expandRhythmAbcByPatternType(
      abc,
      patternType,
      structuredBarCount,
      structure
    );
  });

  const displayAbc = createMemo(() => {
    const abc = sourceRhythmAbc();
    if (!abc) return null;

    return buildDisplayRhythmAbc(
      abc,
      metadata()?.patternType ?? "seed",
      effectiveStructure()
    );
  });

  const playbackAbc = createMemo(() => {
    const patternType = metadata()?.patternType ?? "seed";

    if (patternType === "seed") {
      return expandedAbc();
    }

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
      sourceRhythmAbc(),
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

  createEffect(() => {
    const options = startSectionOptions();
    if (!options.some((option) => option.value === selectedStartSection())) {
      setSelectedStartSection(options[0]?.value ?? "start");
    }
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
        genreName: props.genreName?.trim() || null,
        tuneTypeName,
        tuneId: props.tuneId?.trim() || null,
        userId: user()?.id ?? null,
      })
      .then((nextMetadata) => {
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
    const sourceAbc = sourceRhythmAbc();
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
    const sourceAbc = sourceRhythmAbc();
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
        <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-start">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Rhythm Practice
            </p>
            <CardTitle class="text-xl text-slate-900 dark:text-slate-50">
              {props.tuneTypeName?.trim() || "Rhythm Player"}
            </CardTitle>
          </div>

          <div class="flex flex-wrap items-center justify-center gap-4 md:justify-self-center">
            <label class="flex min-w-24 items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
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
              class="inline-flex min-w-28 items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
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
          </div>

          <div class="flex flex-wrap items-center justify-center gap-2 md:justify-self-end">
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
              class="inline-flex min-w-28 items-center justify-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              data-testid="rhythm-player-pause-button"
            >
              <Pause class="h-4 w-4" />
              {isPlaying() ? "Pause" : "Resume"}
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
              class="inline-flex min-w-28 items-center justify-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              data-testid="rhythm-player-restart-button"
            >
              <RotateCcw class="h-4 w-4" />
              Restart
            </button>
          </div>
        </div>

        <Show when={metadata()}>
          {(currentMetadata) => (
            <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div class="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                <p>
                  <span class="font-medium text-slate-900 dark:text-slate-100">
                    Meter:
                  </span>{" "}
                  {currentMetadata().rhythmSignature || "Unknown"}
                </p>
                <Show when={effectiveStructure()}>
                  {(structure) => (
                    <p data-testid="rhythm-player-structure">
                      <span class="font-medium text-slate-900 dark:text-slate-100">
                        Structure:
                      </span>{" "}
                      {structure()}
                    </p>
                  )}
                </Show>
                <p>
                  <span class="font-medium text-slate-900 dark:text-slate-100">
                    Bar:
                  </span>{" "}
                  {currentBar() || 0}
                  <Show when={totalBars() > 0}>
                    <span class="px-1 text-slate-400">/</span>
                    {totalBars()}
                  </Show>
                </p>
                <p class={cn(currentPulse() > 0 ? "visible" : "invisible")}>
                  <span class="font-medium text-slate-900 dark:text-slate-100">
                    Pulse:
                  </span>{" "}
                  {Math.max(1, currentPulse())}
                  <span class="px-1 text-slate-400">/</span>
                  {Math.max(1, pulsesPerBar())}
                </p>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  {playbackReadyLabel()}
                </p>
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
                    class="flex items-center gap-2 pt-1"
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

              <div class="flex flex-wrap items-end justify-end gap-4">
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
                  />
                </div>
              </div>
            </div>
          </Show>
        </Show>
      </CardContent>
    </Card>
  );
};

export default RhythmPlayer;
