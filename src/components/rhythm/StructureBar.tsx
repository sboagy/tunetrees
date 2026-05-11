import { createMemo, For, type JSX } from "solid-js";

export interface StructureBarProps {
  structure?: string | null;
  currentMeasure: number;
  class?: string;
}

interface StructurePart {
  label: string;
  bars: number;
}

const DEFAULT_BARS_PER_PART = 8;
const STRUCTURE_TOKEN = /([^\d\s])(\d*)/g;

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

function getActivePartIndex(
  parts: StructurePart[],
  currentMeasure: number
): number {
  if (parts.length === 0 || currentMeasure < 1) {
    return -1;
  }

  const totalBars = parts.reduce((sum, part) => sum + part.bars, 0);
  if (totalBars < 1) {
    return -1;
  }

  const normalizedMeasure = ((currentMeasure - 1) % totalBars) + 1;
  let completedBars = 0;

  for (const [index, part] of parts.entries()) {
    completedBars += part.bars;
    if (normalizedMeasure <= completedBars) {
      return index;
    }
  }

  return parts.length - 1;
}

function getBlockClass(isActive: boolean): string {
  return isActive
    ? "border-blue-500 bg-blue-600 text-white shadow-sm"
    : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200";
}

export function StructureBar(props: StructureBarProps): JSX.Element {
  const parts = createMemo(() => parseStructure(props.structure));
  const activePartIndex = createMemo(() =>
    getActivePartIndex(parts(), props.currentMeasure)
  );

  return (
    <div class={props.class} data-testid="structure-bar">
      <ul class="flex flex-wrap gap-2" aria-label="Tune structure">
        <For each={parts()}>
          {(part, index) => {
            const isActive = () => index() === activePartIndex();

            return (
              <li
                class={`min-w-20 rounded-xl border px-3 py-2 transition-colors ${getBlockClass(isActive())}`}
                aria-current={isActive() ? "step" : undefined}
                aria-label={`${part.label} section, ${part.bars} ${
                  part.bars === 1 ? "bar" : "bars"
                }`}
                data-testid={`structure-bar-part-${index()}`}
              >
                <div class="text-sm font-semibold tracking-[0.16em] uppercase">
                  {part.label}
                </div>
                <div class="text-xs opacity-80">
                  {part.bars} {part.bars === 1 ? "bar" : "bars"}
                </div>
              </li>
            );
          }}
        </For>
      </ul>
    </div>
  );
}

export { getActivePartIndex, parseStructure };
