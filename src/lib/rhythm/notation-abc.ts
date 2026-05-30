import { normalizeAbcBodyBars } from "./canonical-abc";

export interface NotationRhythmAbcInput {
  fullAbc: string;
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

  if (line.startsWith("R:")) {
    return null;
  }

  return line;
}

function wrapDisplayBodyLine(line: string, maxBarsPerLine = 4): string[] {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("P:")) {
    return trimmed ? [trimmed] : [];
  }

  const bodyBars = normalizeAbcBodyBars(trimmed);
  if (bodyBars.length === 0 || bodyBars.length <= maxBarsPerLine) {
    return [trimmed];
  }

  const hasRepeatStart = trimmed.startsWith("|:");
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

export function buildNotationRhythmAbc(input: NotationRhythmAbcInput): string {
  return input.fullAbc
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .flatMap((line) => {
      if (line.startsWith("P:")) {
        return [];
      }

      if (!/^[A-Z]:/.test(line)) {
        return wrapDisplayBodyLine(line);
      }

      const normalizedLine = normalizeDisplayHeaderLine(line);
      return normalizedLine ? [normalizedLine] : [];
    })
    .join("\n");
}
