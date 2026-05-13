import abcjs from "abcjs";
import { LoaderCircle, Pause, Play, RotateCcw } from "lucide-solid";
import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  onCleanup,
  Show,
} from "solid-js";
import { toast } from "solid-sonner";
import { useAuth } from "@/lib/auth/AuthContext";
import type { RhythmPatternType } from "@/lib/services/RhythmService";
import { createRhythmService } from "@/lib/services/RhythmService";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
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

interface StructureBarProps {
  structure?: string | null;
  currentMeasure: number;
  class?: string;
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

function StructureBar(props: StructureBarProps): JSX.Element {
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

function parseStructureTotalBars(structure?: string | null): number {
  return parseStructure(structure).reduce(
    (sum: number, part: { bars: number }) => sum + part.bars,
    0
  );
}

function beatsPerMeasureFromSignature(rhythmSignature?: string | null): number {
  const numerator = Number.parseInt(rhythmSignature?.split("/")[0] ?? "", 10);
  return Number.isFinite(numerator) && numerator > 0 ? numerator : 4;
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

function expandRhythmAbcByPatternType(
  abc: string,
  patternType: RhythmPatternType,
  structuredBarCount: number,
  structure?: string | null
): string {
  if (patternType === "full_track" || !normalizeStructure(structure)) {
    return abc;
  }

  return expandSeedRhythmAbc(abc, structuredBarCount);
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

/**
 * Strip the Title (T:) and Tempo (Q:) headers from an ABC string so the
 * rendered staff shows only clean percussion notation. The TuneTrees UI
 * already displays this metadata above the SVG.
 */
function stripAbcHeaders(abc: string): string {
  return abc
    .split("\n")
    .filter((line) => !line.startsWith("T:") && !line.startsWith("Q:"))
    .join("\n");
}

function convertRhythmAbcForDisplay(abc: string): string {
  return abc
    .split("\n")
    .map((line) => {
      if (line.startsWith("K:")) {
        return "K:C clef=treble";
      }

      if (/^[A-Za-z]:/.test(line.trim())) {
        return line;
      }

      return line.replace(
        /(?:\^|_|=)?([A-Ga-g])([',]*)/g,
        (_match, note, octave) => {
          const normalizedNote = String(note).toLowerCase();
          const displayNote = normalizedNote === "c" ? "B" : "G";
          return `${displayNote}${String(octave)}`;
        }
      );
    })
    .join("\n");
}

export const RhythmPlayer: Component<RhythmPlayerProps> = (props) => {
  const { localDb, user } = useAuth();
  let activeBeatTargets: ActiveBeatTarget[] = [];
  let lastToastError: string | null = null;

  const [isPatternLoading, setIsPatternLoading] = createSignal(false);
  const [notationError, setNotationError] = createSignal<string | null>(null);
  const [svgContainerRef, setSvgContainerRef] = createSignal<HTMLDivElement>();

  const service = createMemo(() => {
    const db = localDb();
    return db ? createRhythmService({ db }) : null;
  });

  const metadata = createMemo(() => service()?.metadata() ?? null);
  const tempoQpm = createMemo(() => service()?.tempoQpm() ?? 100);
  const isPlaying = createMemo(() => service()?.isPlaying() ?? false);
  const isReady = createMemo(() => service()?.isReady() ?? false);
  const currentBeatIndex = createMemo(() => service()?.currentBeatIndex() ?? 0);
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

  /**
   * Expand the rhythm ABC to fill every measure of the tune structure so the
   * rendered staff shows the full multi-section pattern, not just a 1-2 bar loop.
   */
  const expandedAbc = createMemo(() => {
    const abc = metadata()?.rhythmAbc;
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
    const abc = expandedAbc();
    if (!abc) return null;

    return stripAbcHeaders(convertRhythmAbcForDisplay(abc));
  });

  const currentBar = createMemo(() => currentMeasure() || 0);
  const currentPulse = createMemo(() => {
    const beatIndex = currentBeatIndex();
    const beatCountPerBar = pulsesPerBar();
    if (beatIndex <= 0 || beatCountPerBar <= 0) {
      return 0;
    }

    return ((beatIndex - 1) % beatCountPerBar) + 1;
  });
  const playbackReadyLabel = createMemo(() => {
    if (metadata()?.premiumAudioUrl) {
      return isReady()
        ? "Premium loop loaded and ready."
        : "Premium loop loads on first playback.";
    }

    return isReady()
      ? "Samples loaded and ready."
      : "Samples load on first playback.";
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

  createEffect(() => {
    const nextError = error() || notationError();
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
      .finally(() => {
        setIsPatternLoading(false);
      });
  });

  // Push expanded ABC to the service so playback matches the rendered measures
  createEffect(() => {
    const svc = service();
    const abc = expandedAbc();
    if (svc && abc) {
      svc.updateRhythmAbc(abc);
    }
  });

  createEffect(() => {
    const container = svgContainerRef();
    const rhythmAbc = displayAbc();

    if (!container) {
      return;
    }

    clearActiveBeatTargets();
    container.innerHTML = "";

    if (!rhythmAbc) {
      setNotationError(null);
      return;
    }

    try {
      setNotationError(null);
      abcjs.renderAbc(container, rhythmAbc, {
        add_classes: true,
        responsive: "resize",
      });
    } catch (cause: unknown) {
      setNotationError(
        cause instanceof Error
          ? cause.message
          : "Failed to render rhythm notation."
      );
    }
  });

  createEffect(() => {
    const container = svgContainerRef();
    const beatIndex = currentBeatIndex();
    const rhythmAbc = displayAbc();

    if (!container || !rhythmAbc) {
      return;
    }

    const noteheads = getBeatNoteTargets(container);
    if (noteheads.length === 0 || beatIndex < 1) {
      clearActiveBeatTargets();
      return;
    }

    const targetIndex = (beatIndex - 1) % noteheads.length;
    const nextTargets = collectHighlightTargets(noteheads[targetIndex]!);
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
    const container = svgContainerRef();
    if (container) {
      container.innerHTML = "";
    }
  });

  return (
    <Card class={cn("border-slate-200 dark:border-slate-800", props.class)}>
      <CardHeader class="space-y-3">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Rhythm Practice
            </p>
            <CardTitle class="text-xl text-slate-900 dark:text-slate-50">
              {props.tuneTypeName?.trim() || "Rhythm Player"}
            </CardTitle>
          </div>

          <button
            type="button"
            onClick={() => {
              const currentService = service();
              if (currentService) {
                void currentService.togglePlayback();
              }
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
                <Pause class="h-4 w-4" />
              ) : (
                <Play class="h-4 w-4" />
              )}
            </Show>
            {isPatternLoading() ? "Loading" : isPlaying() ? "Pause" : "Play"}
          </button>

          <button
            type="button"
            onClick={() => {
              const currentService = service();
              if (currentService) {
                void currentService.restart();
              }
            }}
            disabled={!service() || !metadata() || isPatternLoading()}
            class="inline-flex min-w-28 items-center justify-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            data-testid="rhythm-player-restart-button"
          >
            <RotateCcw class="h-4 w-4" />
            Restart
          </button>
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
                <Show when={currentPulse() > 0}>
                  <p>
                    <span class="font-medium text-slate-900 dark:text-slate-100">
                      Pulse:
                    </span>{" "}
                    {currentPulse()}
                    <span class="px-1 text-slate-400">/</span>
                    {pulsesPerBar()}
                  </p>
                </Show>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  {playbackReadyLabel()}
                </p>
              </div>

              <label class="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                <span class="font-medium text-slate-900 dark:text-slate-100">
                  Tempo {tempoQpm()} QPM
                </span>
                <input
                  type="range"
                  min="30"
                  max="240"
                  step="1"
                  value={tempoQpm()}
                  onInput={(event) => {
                    const currentService = service();
                    if (currentService) {
                      void currentService.setTempoQpm(
                        Number.parseInt(event.currentTarget.value, 10)
                      );
                    }
                  }}
                  class="w-full accent-blue-600 md:w-56"
                  data-testid="rhythm-player-tempo-slider"
                />
              </label>
            </div>
          )}
        </Show>
      </CardHeader>

      <CardContent class="space-y-4">
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
            <div class="space-y-4">
              <StructureBar
                structure={effectiveStructure()}
                currentMeasure={currentMeasure()}
                class="mb-2"
              />

              <Show when={error() || notationError()}>
                <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                  {error() || notationError()}
                </div>
              </Show>

              <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <div
                  ref={setSvgContainerRef}
                  class="rhythm-player-notation flex w-full items-center justify-center overflow-x-auto"
                  data-testid="rhythm-player-notation"
                />
              </div>
            </div>
          </Show>
        </Show>
      </CardContent>
    </Card>
  );
};

export default RhythmPlayer;
