import abcjs from "abcjs";
import { LoaderCircle, Pause, Play, RotateCcw } from "lucide-solid";
import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  Show,
} from "solid-js";
import { toast } from "solid-sonner";
import { buildRhythmSampleUrl } from "@/components/notes/media-auth";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  beatsPerMeasureFromSignature,
  createRhythmService,
  expandRhythmAbc,
  parseStructureTotalBars,
} from "@/lib/services/RhythmService";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { StructureBar } from "./StructureBar";

export interface RhythmPlayerProps {
  tuneTypeName: string | null;
  structure?: string | null;
  genreName?: string | null;
  class?: string;
}

function normalizeStructure(structure?: string | null): string | null {
  const trimmed = structure?.trim();
  return trimmed ? trimmed : null;
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
  const { localDb } = useAuth();
  let activeBeatTargets: SVGElement[] = [];
  let lastToastError: string | null = null;

  const [isPatternLoading, setIsPatternLoading] = createSignal(false);
  const [notationError, setNotationError] = createSignal<string | null>(null);
  const [svgContainerRef, setSvgContainerRef] = createSignal<HTMLDivElement>();

  const service = createMemo(() => {
    const db = localDb();
    return db
      ? createRhythmService({
          db,
          sampleUrlBuilder: (sampleKit, fileName) =>
            buildRhythmSampleUrl(sampleKit, fileName),
        })
      : null;
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
    const structure = effectiveStructure();
    if (!abc) return null;

    const structuredBarCount = parseStructureTotalBars(structure);
    if (structuredBarCount <= 0) return abc;

    return expandRhythmAbc(abc, structuredBarCount, 4, structure);
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

  const clearActiveBeatTargets = () => {
    for (const element of activeBeatTargets) {
      element.classList.remove("tnt-active-note");
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
        (element, index) => element === activeBeatTargets[index]
      );

    if (isSameTargetSet) {
      return;
    }

    clearActiveBeatTargets();
    for (const element of nextTargets) {
      element.classList.add("tnt-active-note");
    }
    activeBeatTargets = nextTargets;
  });

  onCleanup(() => {
    clearActiveBeatTargets();
    const container = svgContainerRef();
    if (container) {
      container.innerHTML = "";
    }
  });

  return (
    <>
      <style>{`
        .rhythm-player-notation .abcjs-notehead,
        .rhythm-player-notation .abcjs-note,
        .rhythm-player-notation .abcjs-stem,
        .rhythm-player-notation .abcjs-rest,
        .rhythm-player-notation .abcjs-decoration,
        .rhythm-player-notation .abcjs-dynamic,
        .rhythm-player-notation .abcjs-annotation,
        .rhythm-player-notation .abcjs-slur,
        .rhythm-player-notation .abcjs-tie {
          transition:
            fill 100ms ease,
            transform 100ms ease;
          transform-box: fill-box;
          transform-origin: center;
          fill: rgb(15 23 42);
          stroke: rgb(15 23 42);
          opacity: 1;
        }

        .rhythm-player-notation .tnt-active-note {
          fill: #60a5fa !important;
          stroke: #60a5fa !important;
          filter: drop-shadow(0 0 8px rgb(96 165 250 / 0.5));
          transform: scale(1.15);
        }

        .rhythm-player-notation .abcjs-staff,
        .rhythm-player-notation .abcjs-bar,
        .rhythm-player-notation .abcjs-ledger,
        .rhythm-player-notation .abcjs-clef {
          stroke: rgb(100 116 139);
        }

        .dark .rhythm-player-notation .abcjs-notehead,
        .dark .rhythm-player-notation .abcjs-note,
        .dark .rhythm-player-notation .abcjs-stem,
        .dark .rhythm-player-notation .abcjs-rest,
        .dark .rhythm-player-notation .abcjs-decoration,
        .dark .rhythm-player-notation .abcjs-dynamic,
        .dark .rhythm-player-notation .abcjs-annotation,
        .dark .rhythm-player-notation .abcjs-slur,
        .dark .rhythm-player-notation .abcjs-tie {
          fill: rgb(226 232 240);
          stroke: rgb(226 232 240);
        }

        .rhythm-player-notation svg {
          min-width: 100%;
          height: auto;
        }
      `}</style>

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
                      <>
                        <span class="px-1 text-slate-400">/</span>
                        {totalBars()}
                      </>
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
                    {isReady()
                      ? "Samples loaded and ready."
                      : "Samples load on first playback."}
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
    </>
  );
};

export default RhythmPlayer;
