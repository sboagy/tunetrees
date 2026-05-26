import type { RhythmPatternType } from "./pattern-types";

export interface StructurePart {
  label: string;
  bars: number;
  hasExplicitBars?: boolean;
}

export interface StructureSection {
  label: string;
  bars: number;
  repeatCount: number;
}

interface SectionTemplate {
  label: string;
  bars: number;
  bodyBars: string[];
}

interface LabeledAbcSection {
  label: string;
  bodyBars: string[];
}

export interface RhythmTuneContext {
  structure?: string | null;
  mode?: string | null;
  rhythmSignature?: string | null;
}

export interface CanonicalRhythmAbcInput {
  sourceAbc: string;
  patternType: RhythmPatternType;
  tuneContext: RhythmTuneContext;
}

export interface CanonicalRhythmAbc {
  fullAbc: string;
  structure: string | null;
  rhythmSignature: string | null;
  totalBars: number;
}

const DEFAULT_BARS_PER_PART = 8;
const STRUCTURE_TOKEN = /([^\d\s])(\d*)/g;

export function normalizeStructure(structure?: string | null): string | null {
  const trimmed = structure?.trim();
  return trimmed || null;
}

export function parseStructure(structure?: string | null): StructurePart[] {
  if (!structure) {
    return [
      { label: "Loop", bars: DEFAULT_BARS_PER_PART, hasExplicitBars: false },
    ];
  }

  const parts: StructurePart[] = [];
  for (const match of structure.matchAll(STRUCTURE_TOKEN)) {
    const [, rawLabel, rawBars] = match;
    const bars = Number.parseInt(rawBars, 10);
    parts.push({
      label: rawLabel.toUpperCase(),
      bars: Number.isFinite(bars) ? bars : DEFAULT_BARS_PER_PART,
      hasExplicitBars: Boolean(rawBars?.trim()),
    });
  }

  return parts.length > 0
    ? parts
    : [
        {
          label: "Loop",
          bars: DEFAULT_BARS_PER_PART,
          hasExplicitBars: false,
        },
      ];
}

export function normalizeAbcBodyBars(abcBody: string): string[] {
  return abcBody
    .replace(/^\s*\|:/, "")
    .replace(/:\|\s*$/, "")
    .split("|")
    .map((segment) => segment.replace(/^:+|:+$/g, "").trim())
    .filter(Boolean);
}

export function getNormalizedAbcBodyLines(abc: string): string[] {
  return abc
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .filter((line) => !/^[A-Z]:/.test(line))
    .filter((line) => !/^\s*%/.test(line))
    .map((line) => line.replace(/\s+%.*$/, "").trimEnd())
    .filter(Boolean);
}

export function splitAbcSections(abc: string): {
  headerLines: string[];
  bodyBars: string[];
} {
  const lines = abc
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);

  return {
    headerLines: lines.filter(
      (line) => /^[A-Z]:/.test(line) && !line.startsWith("P:")
    ),
    bodyBars: normalizeAbcBodyBars(getNormalizedAbcBodyLines(abc).join(" ")),
  };
}

export function getAbcBodyLines(abc: string): string[] {
  return getNormalizedAbcBodyLines(abc);
}

export function getLabeledAbcSections(abc: string): LabeledAbcSection[] {
  const lines = abc
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);

  const sections: LabeledAbcSection[] = [];
  let currentLabel: string | null = null;
  let currentBodyBars: string[] = [];

  const flushSection = () => {
    if (!currentLabel || currentBodyBars.length === 0) {
      return;
    }

    sections.push({ label: currentLabel, bodyBars: currentBodyBars });
  };

  for (const line of lines) {
    if (line.startsWith("P:")) {
      flushSection();
      currentLabel = line.slice(2).trim().toUpperCase();
      currentBodyBars = [];
      continue;
    }

    if (/^[A-Z]:/.test(line)) {
      continue;
    }

    currentBodyBars.push(...normalizeAbcBodyBars(line));
  }

  flushSection();
  return sections;
}

export function resolveStructurePartsForAbc(
  structure: string | null | undefined,
  abc: string | null | undefined
): StructurePart[] {
  const parts = parseStructure(structure);
  if (!abc) {
    return parts;
  }

  const labeledSections = getLabeledAbcSections(abc);
  if (labeledSections.length === 0) {
    return parts;
  }

  const barsByLabel = new Map<string, number>();
  for (const section of labeledSections) {
    if (!section.label || section.bodyBars.length === 0) {
      continue;
    }

    if (!barsByLabel.has(section.label)) {
      barsByLabel.set(section.label, section.bodyBars.length);
    }
  }

  return parts.map((part) => {
    if (part.hasExplicitBars) {
      return part;
    }

    const inferredBars = barsByLabel.get(part.label);
    return inferredBars && inferredBars > 0
      ? { ...part, bars: inferredBars }
      : part;
  });
}

export function collapseStructureSections(
  parts: StructurePart[]
): StructureSection[] {
  const sections: StructureSection[] = [];

  for (const part of parts) {
    const previous = sections.at(-1);
    if (previous?.label === part.label && previous.bars === part.bars) {
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

export function parseStructureTotalBars(
  structure?: string | null,
  abc?: string | null
): number {
  return resolveStructurePartsForAbc(structure, abc).reduce(
    (sum: number, part: { bars: number }) => sum + part.bars,
    0
  );
}

export function getSectionTemplateKey(
  part: Pick<StructurePart, "label" | "bars">
): string {
  return `${part.label}:${part.bars}`;
}

export function getDistinctStructureParts(
  parts: StructurePart[]
): StructurePart[] {
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

function getDistinctStructureLabels(parts: StructurePart[]): string[] {
  return Array.from(new Set(parts.map((part) => part.label)));
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

export function getLabeledSectionTemplates(abc: string): SectionTemplate[] {
  const templates: SectionTemplate[] = [];

  for (const section of getLabeledAbcSections(abc)) {
    if (
      !section.label ||
      section.bodyBars.length === 0 ||
      templates.some((template) => template.label === section.label)
    ) {
      continue;
    }

    templates.push({
      label: section.label,
      bars: section.bodyBars.length,
      bodyBars: section.bodyBars,
    });
  }

  return templates;
}

function buildAlignedSectionTemplates(
  abc: string,
  bodyBars: string[],
  parts: StructurePart[]
): Map<string, SectionTemplate> | null {
  const labeledTemplates = getLabeledSectionTemplates(abc);
  if (labeledTemplates.length === 0) {
    return null;
  }

  const templatesByLabel = new Map(
    labeledTemplates.map((template) => [template.label, template])
  );
  const alignedTemplates = new Map<string, SectionTemplate>();

  for (const [index, label] of getDistinctStructureLabels(parts).entries()) {
    const mappedTemplate =
      templatesByLabel.get(label) ??
      labeledTemplates[index % labeledTemplates.length] ??
      null;

    if (!mappedTemplate) {
      continue;
    }

    alignedTemplates.set(label, {
      label,
      bars: mappedTemplate.bodyBars.length,
      bodyBars: mappedTemplate.bodyBars,
    });
  }

  if (alignedTemplates.size === 0) {
    return null;
  }

  const firstTemplate = labeledTemplates[0];
  for (const part of parts) {
    if (alignedTemplates.has(part.label)) {
      continue;
    }

    alignedTemplates.set(part.label, {
      label: part.label,
      bars: firstTemplate?.bodyBars.length ?? part.bars,
      bodyBars:
        firstTemplate?.bodyBars ?? getSectionBodyBars(bodyBars, part.bars),
    });
  }

  return alignedTemplates;
}

export function buildStructuredPlaybackSectionsFromAbc(
  abc: string,
  parts: StructurePart[]
): string[][] {
  const { bodyBars } = splitAbcSections(abc);
  if (bodyBars.length === 0 || parts.length === 0) {
    return [];
  }

  const alignedTemplates = buildAlignedSectionTemplates(abc, bodyBars, parts);
  if (alignedTemplates) {
    return parts.map((part) => {
      const template = alignedTemplates.get(part.label);
      return getSectionBodyBars(template?.bodyBars ?? bodyBars, part.bars);
    });
  }

  return buildStructuredPlaybackSections(bodyBars, parts);
}

export function buildStructuredPlaybackBodyFromAbc(
  abc: string,
  parts: StructurePart[]
): string[] {
  return buildStructuredPlaybackSectionsFromAbc(abc, parts).flat();
}

export function buildStructuredPlaybackSections(
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

export function countBarEvents(bar: string): number {
  const matches = bar
    .replace(/![^!]+!/g, "")
    .replace(/"[^"]*"/g, "")
    .match(/[_^=]*[A-Ga-gxzXZ]/g);

  return matches?.length ?? 0;
}

export function countAbcEvents(abc: string | null | undefined): number {
  if (!abc) {
    return 0;
  }

  const { bodyBars } = splitAbcSections(abc);
  return bodyBars.reduce((sum, bar) => sum + countBarEvents(bar), 0);
}

function buildStructuredFullTrackBody(
  abc: string,
  parts: StructurePart[],
  includePartLabels = true
): string[] {
  const structuredSections = buildStructuredPlaybackSectionsFromAbc(abc, parts);
  if (structuredSections.length === 0) {
    return [];
  }

  let sectionIndex = 0;

  return collapseStructureSections(parts).flatMap((section) => {
    const sectionBars = structuredSections[sectionIndex] ?? [];
    sectionIndex += section.repeatCount;
    const body = sectionBars.join(" | ");
    const sectionBody =
      section.repeatCount > 1 ? `|: ${body} :|` : `| ${body} |`;

    return includePartLabels
      ? [`P:${section.label}`, sectionBody]
      : [sectionBody];
  });
}

export function buildStructuredFullTrackAbc(
  abc: string,
  structure: string | null | undefined,
  options?: {
    includePartLabels?: boolean;
  }
): string {
  if (!normalizeStructure(structure)) {
    return abc;
  }

  const parts = resolveStructurePartsForAbc(structure, abc);
  const { headerLines, bodyBars } = splitAbcSections(abc);
  const totalStructuredBarCount = parts.reduce(
    (sum, part) => sum + part.bars,
    0
  );
  const hasLabeledTemplates = getLabeledSectionTemplates(abc).length > 0;
  if (bodyBars.length === 0) {
    return abc;
  }

  if (!hasLabeledTemplates && bodyBars.length >= totalStructuredBarCount) {
    return abc;
  }

  const bodyLines = buildStructuredFullTrackBody(
    abc,
    parts,
    options?.includePartLabels ?? true
  );

  return bodyLines.length > 0 ? [...headerLines, ...bodyLines].join("\n") : abc;
}

export function assembleCanonicalRhythmAbc(
  input: CanonicalRhythmAbcInput
): CanonicalRhythmAbc {
  const structure = normalizeStructure(input.tuneContext.structure);
  const structuredAbc = buildStructuredFullTrackAbc(
    input.sourceAbc,
    structure,
    {
      includePartLabels: true,
    }
  );
  const fullAbc =
    input.patternType === "full_track" && structure
      ? (() => {
          const resolvedParts = resolveStructurePartsForAbc(
            structure,
            structuredAbc
          );
          const parts = getDistinctStructureParts(resolvedParts);
          if (parts.length !== resolvedParts.length) {
            return structuredAbc;
          }

          const { bodyBars, headerLines } = splitAbcSections(structuredAbc);
          const distinctBarCount = parts.reduce(
            (sum, part) => sum + part.bars,
            0
          );
          if (bodyBars.length > distinctBarCount) {
            return structuredAbc;
          }

          const structuredBars = buildStructuredPlaybackBodyFromAbc(
            structuredAbc,
            parts
          );
          if (structuredBars.length === 0) {
            return structuredAbc;
          }

          return [...headerLines, `| ${structuredBars.join(" | ")} |`].join(
            "\n"
          );
        })()
      : structuredAbc;

  return {
    fullAbc,
    structure,
    rhythmSignature: input.tuneContext.rhythmSignature ?? null,
    totalBars: parseStructureTotalBars(structure, fullAbc),
  };
}
