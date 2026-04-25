import { MapPin, Pause, Play, Repeat, Scissors, Trash2 } from "lucide-solid";
import type { Component } from "solid-js";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { toast } from "solid-sonner";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { attachMediaAuthTokenToUrl } from "@/components/notes/media-auth";
import { useAuth } from "@/lib/auth/AuthContext";
import { updateMediaAssetByReferenceId } from "@/lib/db/queries/media-assets";
import type { AudioPlayerTrack } from "./AudioPlayerContext";

const DEFAULT_REGION_COLOR = "rgba(37, 99, 235, 0.18)";
const DEFAULT_MARKER_COLOR = "rgba(245, 158, 11, 0.28)";
const DEFAULT_BEAT_COLOR = "rgba(16, 185, 129, 0.26)";
const DEFAULT_MEASURE_COLOR = "rgba(249, 115, 22, 0.26)";
const DEFAULT_SECTION_COLOR = "rgba(168, 85, 247, 0.2)";
const DEFAULT_REGION_SECONDS = 4;
const MAX_ZOOM_LEVEL = 200;

type AudioAnnotationKind = "loop" | "marker" | "beat" | "measure" | "section";

type RegionsPluginInstance = ReturnType<typeof RegionsPlugin.create>;
type AudioRegion = ReturnType<RegionsPluginInstance["addRegion"]>;

interface StoredAudioRegion {
  id: string;
  start: number;
  end?: number | null;
  label?: string | null;
  color?: string | null;
  kind?: AudioAnnotationKind | null;
}

interface StoredAudioPlayerSettings {
  playbackRate: number;
  zoomLevel: number;
  loopEnabled: boolean;
}

interface StoredAudioPlayerState {
  version: 2;
  regions: StoredAudioRegion[];
  settings: StoredAudioPlayerSettings;
}

interface WaveformAudioPlayerProps {
  track: AudioPlayerTrack;
}

function formatTime(totalSeconds: number): string {
  const safeSeconds = Number.isFinite(totalSeconds)
    ? Math.max(0, Math.floor(totalSeconds))
    : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function stripRegionLabel(region: AudioRegion): string | null {
  const content = region.content as unknown;
  if (typeof content === "string") {
    return content.trim() || null;
  }
  if (content instanceof HTMLElement) {
    return content.textContent?.trim() || null;
  }
  return null;
}

function isAudioAnnotationKind(value: unknown): value is AudioAnnotationKind {
  return (
    value === "loop" ||
    value === "marker" ||
    value === "beat" ||
    value === "measure" ||
    value === "section"
  );
}

function isRangeAnnotation(kind: AudioAnnotationKind): boolean {
  return kind === "loop";
}

function buildAnnotationId(kind: AudioAnnotationKind): string {
  return `${kind}-${crypto.randomUUID()}`;
}

function inferAudioAnnotationKind(region: {
  id: string;
  end?: number | null;
  kind?: unknown;
}): AudioAnnotationKind {
  if (isAudioAnnotationKind(region.kind)) {
    return region.kind;
  }

  const prefix = region.id.split("-")[0];
  if (isAudioAnnotationKind(prefix)) {
    return prefix;
  }

  return region.end !== null && region.end !== undefined ? "loop" : "marker";
}

function getAnnotationColor(kind: AudioAnnotationKind): string {
  switch (kind) {
    case "beat":
      return DEFAULT_BEAT_COLOR;
    case "measure":
      return DEFAULT_MEASURE_COLOR;
    case "section":
      return DEFAULT_SECTION_COLOR;
    case "marker":
      return DEFAULT_MARKER_COLOR;
    default:
      return DEFAULT_REGION_COLOR;
  }
}

function getAnnotationKindLabel(kind: AudioAnnotationKind): string {
  switch (kind) {
    case "beat":
      return "Beat";
    case "measure":
      return "Measure";
    case "section":
      return "Section";
    case "marker":
      return "Marker";
    default:
      return "Loop";
  }
}

function getDefaultDuration(): number {
  return DEFAULT_REGION_SECONDS;
}

function shouldIgnoreAnnotationHotkeys(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

function normalizePlaybackRate(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }

  return Math.min(1.5, Math.max(0.5, value));
}

function normalizeZoomLevel(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.min(MAX_ZOOM_LEVEL, Math.max(0, value));
}

function normalizeLoopEnabled(value: unknown): boolean {
  return value === true;
}

function parseStoredAudioRegions(entries: unknown): StoredAudioRegion[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .filter((entry): entry is StoredAudioRegion => {
      if (!entry || typeof entry !== "object") {
        return false;
      }

      const candidate = entry as Partial<StoredAudioRegion>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.start === "number" &&
        Number.isFinite(candidate.start)
      );
    })
    .map((entry) => ({
      kind: inferAudioAnnotationKind(entry),
      id: entry.id,
      start: entry.start,
      end:
        typeof entry.end === "number" && Number.isFinite(entry.end)
          ? entry.end
          : null,
      label: typeof entry.label === "string" ? entry.label : null,
      color: typeof entry.color === "string" ? entry.color : null,
    }));
}

function parseStoredAudioState(
  regionsJson: string | null | undefined
): StoredAudioPlayerState {
  const fallbackSettings: StoredAudioPlayerSettings = {
    playbackRate: 1,
    zoomLevel: 0,
    loopEnabled: false,
  };

  if (!regionsJson) {
    return {
      version: 2,
      regions: [],
      settings: fallbackSettings,
    };
  }

  try {
    const parsed = JSON.parse(regionsJson) as unknown;

    if (Array.isArray(parsed)) {
      return {
        version: 2,
        regions: parseStoredAudioRegions(parsed),
        settings: fallbackSettings,
      };
    }

    if (!parsed || typeof parsed !== "object") {
      return {
        version: 2,
        regions: [],
        settings: fallbackSettings,
      };
    }

    const candidate = parsed as {
      regions?: unknown;
      settings?: {
        playbackRate?: unknown;
        zoomLevel?: unknown;
        loopEnabled?: unknown;
      } | null;
    };

    return {
      version: 2,
      regions: parseStoredAudioRegions(candidate.regions),
      settings: {
        playbackRate: normalizePlaybackRate(candidate.settings?.playbackRate),
        zoomLevel: normalizeZoomLevel(candidate.settings?.zoomLevel),
        loopEnabled: normalizeLoopEnabled(candidate.settings?.loopEnabled),
      },
    };
  } catch {
    return {
      version: 2,
      regions: [],
      settings: fallbackSettings,
    };
  }
}

const WaveformAudioPlayer: Component<WaveformAudioPlayerProps> = (props) => {
  const initialStoredState = parseStoredAudioState(props.track.regionsJson);
  const { session, localDb } = useAuth();
  const [isReady, setIsReady] = createSignal(false);
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [currentTime, setCurrentTime] = createSignal(0);
  const [duration, setDuration] = createSignal(
    props.track.durationSeconds ?? 0
  );
  const [playbackRate, setPlaybackRate] = createSignal(
    initialStoredState.settings.playbackRate
  );
  const [zoomLevel, setZoomLevel] = createSignal(
    initialStoredState.settings.zoomLevel
  );
  const [loopEnabled, setLoopEnabled] = createSignal(
    initialStoredState.settings.loopEnabled
  );
  const [selectedRegionId, setSelectedRegionId] = createSignal<string | null>(
    null
  );
  const [regions, setRegions] = createSignal<StoredAudioRegion[]>(
    initialStoredState.regions
  );
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  let waveformContainerRef: HTMLDivElement | undefined;
  let waveSurfer: WaveSurfer | null = null;
  let regionsPlugin: RegionsPluginInstance | null = null;
  let audioElement: HTMLAudioElement | null = null;
  let persistTimer: number | undefined;
  let isRestoringRegions = false;
  let hasPendingStateChanges = false;


  const setPreservePitch = () => {
    if (!audioElement) {
      return;
    }

    const mediaElement = audioElement as HTMLAudioElement & {
      preservesPitch?: boolean;
      mozPreservesPitch?: boolean;
      webkitPreservesPitch?: boolean;
    };

    mediaElement.preservesPitch = true;
    mediaElement.mozPreservesPitch = true;
    mediaElement.webkitPreservesPitch = true;
  };

  const collectSerializedRegions = () => {
    if (!regionsPlugin) {
      return regions();
    }

    return regionsPlugin.getRegions().map((region) => ({
      kind: inferAudioAnnotationKind({
        id: region.id,
        end:
          typeof region.end === "number" && Number.isFinite(region.end)
            ? region.end
            : null,
      }),
      id: region.id,
      start: region.start,
      end:
        typeof region.end === "number" && Number.isFinite(region.end)
          ? region.end
          : null,
      label: stripRegionLabel(region),
      color: typeof region.color === "string" ? region.color : null,
    }));
  };

  const buildStoredAudioPlayerState = (
    nextRegions: StoredAudioRegion[]
  ): StoredAudioPlayerState => ({
    version: 2,
    regions: nextRegions,
    settings: {
      playbackRate: playbackRate(),
      zoomLevel: zoomLevel(),
      loopEnabled: loopEnabled(),
    },
  });

  const syncSerializedRegions = () => {
    const nextRegions = collectSerializedRegions();

    setRegions(nextRegions);
    return nextRegions;
  };

  const buildAnnotationLabel = (kind: AudioAnnotationKind) => {
    const existingCount =
      regions().filter((entry) => inferAudioAnnotationKind(entry) === kind)
        .length + 1;

    return `${getAnnotationKindLabel(kind)} ${existingCount}`;
  };

  const schedulePersist = () => {
    const db = localDb();
    if (!db) {
      return;
    }

    hasPendingStateChanges = true;

    if (persistTimer) {
      window.clearTimeout(persistTimer);
    }

    persistTimer = window.setTimeout(async () => {
      persistTimer = undefined;
      const nextRegions = syncSerializedRegions();
      const nextDuration = audioElement?.duration;

      try {
        await updateMediaAssetByReferenceId(db, props.track.referenceId, {
          regionsJson: JSON.stringify(buildStoredAudioPlayerState(nextRegions)),
          durationSeconds:
            typeof nextDuration === "number" && Number.isFinite(nextDuration)
              ? nextDuration
              : (props.track.durationSeconds ?? null),
        });
        hasPendingStateChanges = false;
      } catch (error) {
        console.error("Failed to persist audio player state:", error);
        toast.error("Could not save audio player state.");
      }
    }, 300);
  };

  const getSelectedRegion = () => {
    const regionId = selectedRegionId();
    if (!regionId || !regionsPlugin) {
      return null;
    }

    return (
      regionsPlugin.getRegions().find((region) => region.id === regionId) ||
      null
    );
  };

  const playSelectedRegion = () => {
    const selectedRegion = getSelectedRegion();
    if (!waveSurfer || !selectedRegion) {
      return false;
    }

    if (typeof selectedRegion.end === "number") {
      void waveSurfer.play(selectedRegion.start, selectedRegion.end);
    } else {
      waveSurfer.setTime(selectedRegion.start);
      void waveSurfer.play();
    }

    return true;
  };

  const addAnnotation = (kind: AudioAnnotationKind) => {
    if (!regionsPlugin) {
      return;
    }

    const start = currentTime();
    const safeDuration = duration();
    const end = safeDuration
      ? Math.min(start + getDefaultDuration(), safeDuration)
      : start + getDefaultDuration();

    const region = regionsPlugin.addRegion({
      id: buildAnnotationId(kind),
      start,
      ...(isRangeAnnotation(kind) ? { end } : {}),
      content: buildAnnotationLabel(kind),
      color: getAnnotationColor(kind),
      drag: true,
      resize: isRangeAnnotation(kind),
    });
    setSelectedRegionId(region.id);
  };

  const removeSelectedRegion = () => {
    const selectedRegion = getSelectedRegion();
    if (!selectedRegion) {
      return;
    }

    selectedRegion.remove();
  };

  const handlePlayPause = () => {
    if (!waveSurfer) {
      return;
    }

    if (waveSurfer.isPlaying()) {
      waveSurfer.pause();
      return;
    }

    if (loopEnabled() && playSelectedRegion()) {
      return;
    }

    void waveSurfer.play();
  };

  const handleSelectRegion = (regionId: string) => {
    setSelectedRegionId(regionId);
    const selectedRegion =
      regionsPlugin?.getRegions().find((region) => region.id === regionId) ||
      null;

    if (selectedRegion && waveSurfer) {
      waveSurfer.setTime(selectedRegion.start);
    }
  };

  const handleAnnotationHotkeys = (event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.repeat ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      shouldIgnoreAnnotationHotkeys(event.target)
    ) {
      return;
    }

    switch (event.key.toLowerCase()) {
      case "b":
        event.preventDefault();
        addAnnotation("beat");
        break;
      case "m":
        event.preventDefault();
        addAnnotation("measure");
        break;
      case "s":
        event.preventDefault();
        addAnnotation("section");
        break;
      default:
        break;
    }
  };

  onMount(() => {
    const accessToken = session()?.access_token;
    const sourceUrl = accessToken
      ? attachMediaAuthTokenToUrl(props.track.url, accessToken)
      : props.track.url;

    regionsPlugin = RegionsPlugin.create();
    audioElement = new Audio(sourceUrl);
    audioElement.preload = "auto";
    audioElement.crossOrigin = "anonymous";
    setPreservePitch();

    waveSurfer = WaveSurfer.create({
      container: waveformContainerRef!,
      media: audioElement,
      waveColor: "#94a3b8",
      progressColor: "#0f172a",
      cursorColor: "#2563eb",
      barWidth: 2,
      barGap: 1,
      height: 128,
      normalize: true,
      dragToSeek: true,
      plugins: [regionsPlugin],
    });

    waveSurfer.setPlaybackRate(playbackRate(), true);

    waveSurfer.on("ready", () => {
      setIsReady(true);
      setDuration(
        waveSurfer?.getDuration() || props.track.durationSeconds || 0
      );
      if (zoomLevel() > 0) {
        waveSurfer?.zoom(zoomLevel());
      }

      const persistedRegions = parseStoredAudioState(
        props.track.regionsJson
      ).regions;
      isRestoringRegions = true;
      regionsPlugin?.clearRegions();
      for (const region of persistedRegions) {
        const kind = inferAudioAnnotationKind(region);
        regionsPlugin?.addRegion({
          id: region.id,
          start: region.start,
          ...(isRangeAnnotation(kind) &&
          region.end !== null &&
          region.end !== undefined
            ? { end: region.end }
            : {}),
          content: region.label || getAnnotationKindLabel(kind),
          color: region.color || getAnnotationColor(kind),
          drag: true,
          resize: isRangeAnnotation(kind),
        });
      }
      isRestoringRegions = false;
      syncSerializedRegions();
    });

    waveSurfer.on("play", () => setIsPlaying(true));
    waveSurfer.on("pause", () => setIsPlaying(false));
    waveSurfer.on("timeupdate", (time) => setCurrentTime(time));
    waveSurfer.on("error", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message);
    });

    regionsPlugin.on("region-created", (region) => {
      setSelectedRegionId(region.id);
      if (isRestoringRegions) {
        return;
      }
      schedulePersist();
    });

    regionsPlugin.on("region-updated", () => {
      if (isRestoringRegions) {
        return;
      }
      schedulePersist();
    });

    regionsPlugin.on("region-removed", (region) => {
      if (selectedRegionId() === region.id) {
        setSelectedRegionId(null);
      }
      if (isRestoringRegions) {
        return;
      }
      schedulePersist();
    });

    regionsPlugin.on("region-clicked", (region, event) => {
      event.stopPropagation();
      setSelectedRegionId(region.id);
      if (typeof region.end === "number" && waveSurfer) {
        void waveSurfer.play(region.start, region.end);
      } else if (waveSurfer) {
        waveSurfer.setTime(region.start);
      }
    });

    regionsPlugin.on("region-out", (region) => {
      if (!loopEnabled() || selectedRegionId() !== region.id || !waveSurfer) {
        return;
      }

      if (typeof region.end === "number") {
        void waveSurfer.play(region.start, region.end);
      }
    });

    document.addEventListener("keydown", handleAnnotationHotkeys);
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleAnnotationHotkeys);

    if (persistTimer) {
      window.clearTimeout(persistTimer);
      persistTimer = undefined;
    }

    if (hasPendingStateChanges) {
      const db = localDb();
      const nextRegions = syncSerializedRegions();
      const nextDuration = audioElement?.duration;

      if (db) {
        void updateMediaAssetByReferenceId(db, props.track.referenceId, {
          regionsJson: JSON.stringify(buildStoredAudioPlayerState(nextRegions)),
          durationSeconds:
            typeof nextDuration === "number" && Number.isFinite(nextDuration)
              ? nextDuration
              : (props.track.durationSeconds ?? null),
        }).catch((error) => {
          console.error(
            "Failed to persist audio player state on close:",
            error
          );
        });
      }
    }

    waveSurfer?.destroy();
    waveSurfer = null;
    audioElement = null;
    regionsPlugin = null;
  });

  return (
    <div class="space-y-4" data-testid="audio-player-panel">
      <div class="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
        <div
          ref={waveformContainerRef}
          class="min-h-[128px] w-full"
          data-testid="audio-player-waveform"
        />

        <Show when={errorMessage()}>
          <p class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {errorMessage()}
          </p>
        </Show>

        <div class="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handlePlayPause}
            disabled={!isReady()}
            class="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            data-testid="audio-player-play-toggle"
          >
            {isPlaying() ? <Pause class="h-4 w-4" /> : <Play class="h-4 w-4" />}
            {isPlaying() ? "Pause" : "Play"}
          </button>

          <div class="text-sm text-slate-600 dark:text-slate-300">
            <span data-testid="audio-player-current-time">
              {formatTime(currentTime())}
            </span>
            <span class="px-1 text-slate-400">/</span>
            <span data-testid="audio-player-duration">
              {formatTime(duration())}
            </span>
          </div>

          <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            Tempo
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={playbackRate()}
              onInput={(event) => {
                const nextRate = Number.parseFloat(event.currentTarget.value);
                setPlaybackRate(nextRate);
                setPreservePitch();
                waveSurfer?.setPlaybackRate(nextRate, true);
                schedulePersist();
              }}
              data-testid="audio-player-tempo-slider"
            />
            <span class="w-12 text-right font-medium text-slate-900 dark:text-slate-100">
              {playbackRate().toFixed(2)}x
            </span>
          </label>

          <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            Zoom
            <input
              type="range"
              min="0"
              max={String(MAX_ZOOM_LEVEL)}
              step="10"
              value={zoomLevel()}
              onInput={(event) => {
                const nextZoom = Number.parseInt(event.currentTarget.value, 10);
                setZoomLevel(nextZoom);
                if (waveSurfer && isReady()) {
                  waveSurfer.zoom(nextZoom);
                }
                schedulePersist();
              }}
              data-testid="audio-player-zoom-slider"
            />
            <span
              class="w-16 text-right font-medium text-slate-900 dark:text-slate-100"
              data-testid="audio-player-zoom-value"
            >
              {zoomLevel() === 0 ? "Fit" : `${zoomLevel()} px/s`}
            </span>
          </label>

          <button
            type="button"
            onClick={() => {
              setLoopEnabled(!loopEnabled());
              schedulePersist();
            }}
            class="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors"
            classList={{
              "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-200":
                loopEnabled(),
              "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800":
                !loopEnabled(),
            }}
            data-testid="audio-player-loop-toggle"
          >
            <Repeat class="h-4 w-4" />
            {loopEnabled() ? "Looping Selected Region" : "Loop Selected Region"}
          </button>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div class="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => addAnnotation("loop")}
              class="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              data-testid="audio-player-add-region-button"
            >
              <Scissors class="h-4 w-4" />
              Add Loop Region
            </button>
            <button
              type="button"
              onClick={() => addAnnotation("beat")}
              class="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              data-testid="audio-player-add-beat-button"
            >
              <MapPin class="h-4 w-4" />
              Add Beat Mark
              <span class="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 md:inline">
                (B)
              </span>
            </button>
            <button
              type="button"
              onClick={() => addAnnotation("measure")}
              class="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              data-testid="audio-player-add-measure-button"
            >
              <MapPin class="h-4 w-4" />
              Add Measure Mark
              <span class="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 md:inline">
                (M)
              </span>
            </button>
            <button
              type="button"
              onClick={() => addAnnotation("section")}
              class="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              data-testid="audio-player-add-section-button"
            >
              <MapPin class="h-4 w-4" />
              Add Section Mark
              <span class="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 md:inline">
                (S)
              </span>
            </button>
            <button
              type="button"
              onClick={removeSelectedRegion}
              disabled={!selectedRegionId()}
              class="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/70 dark:text-red-300 dark:hover:bg-red-950/40"
              data-testid="audio-player-remove-region-button"
            >
              <Trash2 class="h-4 w-4" />
              Remove Selected
            </button>
          </div>

          <p class="text-sm text-slate-500 dark:text-slate-400">
            Click a saved mark or region to select it. When loop mode is
            enabled, playback repeats the selected loop region.
          </p>
        </div>

        <div class="flex min-h-0 max-h-[26rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <h4 class="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Saved Marks & Regions
          </h4>

          <div
            class="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"
            data-testid="audio-player-region-list"
          >
            <Show
              when={regions().length > 0}
              fallback={
                <p class="text-sm text-slate-500 dark:text-slate-400">
                  Add loop regions, section marks, or beat and measure marks to
                  save them with this audio reference.
                </p>
              }
            >
              <For each={regions()}>
                {(region) =>
                  (() => {
                    const kind = inferAudioAnnotationKind(region);
                    return (
                      <button
                        type="button"
                        onClick={() => handleSelectRegion(region.id)}
                        class="flex w-full items-start justify-between rounded-xl border px-3 py-2 text-left transition-colors"
                        classList={{
                          "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/40":
                            selectedRegionId() === region.id,
                          "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900":
                            selectedRegionId() !== region.id,
                        }}
                        data-testid={`audio-player-region-${region.id}`}
                      >
                        <div>
                          <p class="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {region.label || getAnnotationKindLabel(kind)}
                          </p>
                          <p class="text-xs text-slate-500 dark:text-slate-400">
                            {formatTime(region.start)}
                            <Show
                              when={
                                isRangeAnnotation(kind) &&
                                region.end !== null &&
                                region.end !== undefined
                              }
                            >
                              <span>
                                {` - ${formatTime(region.end || region.start)}`}
                              </span>
                            </Show>
                          </p>
                        </div>

                        <span class="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {getAnnotationKindLabel(kind)}
                        </span>
                      </button>
                    );
                  })()
                }
              </For>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaveformAudioPlayer;
