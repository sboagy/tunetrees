import {
  MapPin,
  Pause,
  Pencil,
  Play,
  Repeat,
  Scissors,
  Trash2,
  X,
} from "lucide-solid";
import type { Component } from "solid-js";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { toast } from "solid-sonner";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { attachMediaAuthTokenToUrl } from "@/components/notes/media-auth";
import { useAuth } from "@/lib/auth/AuthContext";
import { getDb } from "@/lib/db/client-sqlite";
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
type AudioRegionInstance = AudioRegion & {
  ttKind?: AudioAnnotationKind;
  content?: string | HTMLElement | null;
  color?: string | null;
};

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
  onPersistRequestChange?:
    | ((handler: (() => Promise<void>) | null) => void)
    | undefined;
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
  ttKind?: unknown;
}): AudioAnnotationKind {
  if (isAudioAnnotationKind(region.ttKind)) {
    return region.ttKind;
  }

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

function getAudioRegionEnd(region: { end?: number | null }): number | null {
  return typeof region.end === "number" && Number.isFinite(region.end)
    ? region.end
    : null;
}

function getAudioRegionKind(region: {
  id: string;
  end?: number | null;
  kind?: unknown;
  ttKind?: unknown;
}): AudioAnnotationKind {
  return inferAudioAnnotationKind({
    id: region.id,
    end: getAudioRegionEnd(region),
    kind: region.kind,
    ttKind: region.ttKind,
  });
}

function getRegionDisplayLabel(region: StoredAudioRegion): string {
  return region.label || getAnnotationKindLabel(getAudioRegionKind(region));
}

function sortStoredAudioRegions(
  entries: StoredAudioRegion[]
): StoredAudioRegion[] {
  return [...entries].sort((left, right) => left.start - right.start);
}

function setAudioRegionMetadata(
  region: AudioRegionInstance,
  kind: AudioAnnotationKind,
  label: string,
  color: string
) {
  const regionWithMutableContent = region as unknown as {
    content?: string | HTMLElement | null;
  };

  region.ttKind = kind;
  region.color = color;

  if (regionWithMutableContent.content instanceof HTMLElement) {
    regionWithMutableContent.content.textContent = label;
    return;
  }

  regionWithMutableContent.content = label;
}

function buildRetypedAnnotationLabel(
  currentLabel: string | null | undefined,
  previousKind: AudioAnnotationKind,
  nextKind: AudioAnnotationKind
): string {
  const previousLabel = getAnnotationKindLabel(previousKind);
  const nextLabel = getAnnotationKindLabel(nextKind);

  if (!currentLabel) {
    return nextLabel;
  }

  const defaultLabelMatch = currentLabel.match(
    new RegExp(`^${previousLabel}(\\s+\\d+)?$`)
  );
  if (defaultLabelMatch) {
    return `${nextLabel}${defaultLabelMatch[1] ?? ""}`;
  }

  return currentLabel;
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

  return sortStoredAudioRegions(
    entries
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
      }))
  );
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
  const [selectedRegionIds, setSelectedRegionIds] = createSignal<string[]>([]);
  const [selectionAnchorId, setSelectionAnchorId] = createSignal<string | null>(
    null
  );
  const [isDragSelecting, setIsDragSelecting] = createSignal(false);
  const [dragSelectionAnchorId, setDragSelectionAnchorId] = createSignal<
    string | null
  >(null);
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
  let isDisposing = false;
  let didDragSelectionChange = false;
  let suppressNextRowClick = false;

  type RegionListModifiers = {
    shiftKey: boolean;
    metaKey: boolean;
    ctrlKey: boolean;
  };

  const getRegionOrderIds = (entries: StoredAudioRegion[] = regions()) =>
    sortStoredAudioRegions(entries).map((entry) => entry.id);

  const getSelectionRangeIds = (
    startId: string,
    endId: string,
    entries: StoredAudioRegion[] = regions()
  ) => {
    const orderedIds = getRegionOrderIds(entries);
    const startIndex = orderedIds.indexOf(startId);
    const endIndex = orderedIds.indexOf(endId);

    if (startIndex === -1 || endIndex === -1) {
      return [];
    }

    const [fromIndex, toIndex] =
      startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];

    return orderedIds.slice(fromIndex, toIndex + 1);
  };

  const disableLoopIfSelectionIsInvalid = (shouldPersist: boolean) => {
    const selectedRegion = getSelectedRegion();
    const selectedKind = selectedRegion
      ? getAudioRegionKind(selectedRegion as AudioRegionInstance)
      : null;

    if (selectedKind === "loop" || !loopEnabled()) {
      return;
    }

    setLoopEnabled(false);
    if (shouldPersist) {
      schedulePersist();
    }
  };

  const clearSelection = (shouldPersistLoopReset = false) => {
    setSelectedRegionId(null);
    setSelectedRegionIds([]);
    setSelectionAnchorId(null);
    setDragSelectionAnchorId(null);
    setIsDragSelecting(false);

    if (shouldPersistLoopReset) {
      disableLoopIfSelectionIsInvalid(true);
    } else if (loopEnabled()) {
      setLoopEnabled(false);
    }
  };

  const setSingleSelection = (regionId: string) => {
    setSelectedRegionId(regionId);
    setSelectedRegionIds([regionId]);
    setSelectionAnchorId(regionId);
  };

  const setRangeSelection = (targetRegionId: string) => {
    const anchorId = selectionAnchorId() || targetRegionId;
    const rangeIds = getSelectionRangeIds(anchorId, targetRegionId);

    if (rangeIds.length === 0) {
      setSingleSelection(targetRegionId);
      return;
    }

    setSelectedRegionId(targetRegionId);
    setSelectedRegionIds(rangeIds);
    setSelectionAnchorId(anchorId);
  };

  const toggleSelectionMembership = (regionId: string) => {
    setSelectedRegionIds((currentIds) => {
      if (currentIds.includes(regionId)) {
        const nextIds = currentIds.filter((id) => id !== regionId);
        if (selectedRegionId() === regionId) {
          setSelectedRegionId(nextIds.at(-1) ?? null);
        }
        return nextIds;
      }

      return [...currentIds, regionId];
    });
    setSelectionAnchorId(regionId);
    if (!selectedRegionIds().includes(regionId)) {
      setSelectedRegionId(regionId);
    }
  };

  const reconcileSelection = (nextRegions: StoredAudioRegion[]) => {
    const nextRegionIds = new Set(nextRegions.map((region) => region.id));

    setSelectedRegionIds((currentIds) =>
      currentIds.filter((regionId) => nextRegionIds.has(regionId))
    );

    if (selectedRegionId() && !nextRegionIds.has(selectedRegionId()!)) {
      setSelectedRegionId(null);
    }

    if (selectionAnchorId() && !nextRegionIds.has(selectionAnchorId()!)) {
      setSelectionAnchorId(null);
    }

    if (
      dragSelectionAnchorId() &&
      !nextRegionIds.has(dragSelectionAnchorId()!)
    ) {
      setDragSelectionAnchorId(null);
    }
  };

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

  const stopPlayback = () => {
    waveSurfer?.pause();
    audioElement?.pause();
    setIsPlaying(false);
  };

  const collectSerializedRegions = () => {
    if (!regionsPlugin) {
      return sortStoredAudioRegions(regions());
    }

    return sortStoredAudioRegions(
      regionsPlugin.getRegions().map((region) => ({
        kind: getAudioRegionKind(region as AudioRegionInstance),
        id: region.id,
        start: region.start,
        end: getAudioRegionEnd(region),
        label: stripRegionLabel(region),
        color: typeof region.color === "string" ? region.color : null,
      }))
    );
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
    reconcileSelection(nextRegions);
    return nextRegions;
  };

  const buildAnnotationLabel = (kind: AudioAnnotationKind) => {
    const existingCount =
      regions().filter((entry) => inferAudioAnnotationKind(entry) === kind)
        .length + 1;

    return `${getAnnotationKindLabel(kind)} ${existingCount}`;
  };

  const schedulePersist = () => {
    hasPendingStateChanges = true;

    if (persistTimer) {
      window.clearTimeout(persistTimer);
    }

    persistTimer = window.setTimeout(async () => {
      persistTimer = undefined;
      try {
        await persistCurrentState();
      } catch (error) {
        console.error("Failed to persist audio player state:", error);
        toast.error("Could not save audio player state.");
      }
    }, 300);
  };

  const persistCurrentState = async () => {
    const db = localDb() ?? getDb();
    if (!db) {
      throw new Error(
        "Local database not available for audio player persistence"
      );
    }

    const nextRegions = [...regions()];
    const nextDuration = audioElement?.duration;

    await updateMediaAssetByReferenceId(db, props.track.referenceId, {
      regionsJson: JSON.stringify(buildStoredAudioPlayerState(nextRegions)),
      durationSeconds:
        typeof nextDuration === "number" && Number.isFinite(nextDuration)
          ? nextDuration
          : (props.track.durationSeconds ?? null),
    });
    hasPendingStateChanges = false;
  };

  const flushPendingPersist = async (showToastOnError: boolean) => {
    if (persistTimer) {
      window.clearTimeout(persistTimer);
      persistTimer = undefined;
    }

    if (!hasPendingStateChanges) {
      return;
    }

    try {
      await persistCurrentState();
    } catch (error) {
      console.error("Failed to persist audio player state on close:", error);
      if (showToastOnError) {
        toast.error("Could not save audio player state.");
      }
      throw error;
    }
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

  const getLoopBoundsFromSelectedMarks = () => {
    const selectedIds = new Set(selectedRegionIds());
    const selectedMarks = regions()
      .filter((region) => selectedIds.has(region.id))
      .filter((region) => !isRangeAnnotation(getAudioRegionKind(region)))
      .sort((left, right) => left.start - right.start);

    if (selectedMarks.length < 2) {
      return null;
    }

    const start = selectedMarks[0].start;
    const end = selectedMarks[selectedMarks.length - 1].start;
    if (end <= start) {
      return null;
    }

    return { start, end };
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

    const selectedLoopBounds =
      kind === "loop" ? getLoopBoundsFromSelectedMarks() : null;
    const start = selectedLoopBounds?.start ?? currentTime();
    const safeDuration = duration();
    const end = selectedLoopBounds
      ? selectedLoopBounds.end
      : safeDuration
        ? Math.min(start + getDefaultDuration(), safeDuration)
        : start + getDefaultDuration();
    const label = buildAnnotationLabel(kind);
    const color = getAnnotationColor(kind);

    const region = regionsPlugin.addRegion({
      id: buildAnnotationId(kind),
      start,
      ...(isRangeAnnotation(kind) ? { end } : {}),
      content: label,
      color,
      drag: true,
      resize: isRangeAnnotation(kind),
    });
    setAudioRegionMetadata(region as AudioRegionInstance, kind, label, color);
  };

  const removeRegionById = (regionId: string) => {
    const region =
      regionsPlugin
        ?.getRegions()
        .find((candidate) => candidate.id === regionId) || null;
    if (!region) {
      return;
    }

    region.remove();
  };

  const removeSelectedRegions = () => {
    const regionIds = [...selectedRegionIds()];
    if (regionIds.length === 0) {
      return;
    }

    for (const regionId of regionIds) {
      removeRegionById(regionId);
    }

    clearSelection();
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

  const focusRegion = (regionId: string) => {
    const selectedRegion =
      regionsPlugin?.getRegions().find((region) => region.id === regionId) ||
      null;

    if (selectedRegion && waveSurfer) {
      waveSurfer.setTime(selectedRegion.start);
    }
  };

  const applyRegionListSelection = (
    regionId: string,
    modifiers: RegionListModifiers,
    startDrag = false
  ) => {
    if (modifiers.shiftKey) {
      setRangeSelection(regionId);
      focusRegion(regionId);
      disableLoopIfSelectionIsInvalid(true);
      return;
    }

    if (modifiers.metaKey || modifiers.ctrlKey) {
      toggleSelectionMembership(regionId);
      focusRegion(regionId);
      disableLoopIfSelectionIsInvalid(true);
      return;
    }

    if (startDrag) {
      didDragSelectionChange = false;
      setDragSelectionAnchorId(regionId);
      setIsDragSelecting(true);
    }

    setSingleSelection(regionId);
    focusRegion(regionId);
    disableLoopIfSelectionIsInvalid(true);
  };

  const handleRegionListPointerDown = (
    regionId: string,
    event: PointerEvent
  ) => {
    if (event.button !== 0) {
      return;
    }

    suppressNextRowClick = false;
    event.preventDefault();
    applyRegionListSelection(regionId, event, true);
  };

  const handleRegionListClick = (regionId: string, event: MouseEvent) => {
    if (suppressNextRowClick) {
      suppressNextRowClick = false;
      return;
    }

    applyRegionListSelection(regionId, event);
  };

  const handleRegionListKeyDown = (regionId: string, event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    applyRegionListSelection(regionId, event);
  };

  const handleRegionListPointerEnter = (regionId: string) => {
    if (!isDragSelecting()) {
      return;
    }

    const anchorId = dragSelectionAnchorId();
    if (!anchorId) {
      return;
    }

    const rangeIds = getSelectionRangeIds(anchorId, regionId);
    if (rangeIds.length === 0) {
      return;
    }

    didDragSelectionChange = rangeIds.length > 1;
    setSelectedRegionId(regionId);
    setSelectedRegionIds(rangeIds);
  };

  const updatePointAnnotationKind = (
    regionId: string,
    nextKind: Extract<AudioAnnotationKind, "beat" | "measure" | "section">
  ) => {
    const region =
      regionsPlugin
        ?.getRegions()
        .find((candidate) => candidate.id === regionId) || null;
    if (!region) {
      return;
    }

    const currentKind = getAudioRegionKind(region as AudioRegionInstance);
    if (currentKind === nextKind || isRangeAnnotation(currentKind)) {
      return;
    }

    const nextLabel = buildRetypedAnnotationLabel(
      stripRegionLabel(region),
      currentKind,
      nextKind
    );
    setAudioRegionMetadata(
      region as AudioRegionInstance,
      nextKind,
      nextLabel,
      getAnnotationColor(nextKind)
    );
    syncSerializedRegions();
    schedulePersist();
  };

  const renameRegionById = (regionId: string) => {
    const currentRegion = regions().find(
      (candidate) => candidate.id === regionId
    );
    if (!currentRegion) {
      return;
    }

    const currentLabel = getRegionDisplayLabel(currentRegion);
    const nextLabel = window.prompt("Rename mark or region", currentLabel);
    if (nextLabel === null) {
      return;
    }

    const trimmedLabel = nextLabel.trim();
    if (!trimmedLabel || trimmedLabel === currentLabel) {
      return;
    }

    const region =
      regionsPlugin
        ?.getRegions()
        .find((candidate) => candidate.id === regionId) || null;
    const kind = getAudioRegionKind(currentRegion);

    if (region) {
      setAudioRegionMetadata(
        region as AudioRegionInstance,
        kind,
        trimmedLabel,
        typeof region.color === "string"
          ? region.color
          : getAnnotationColor(kind)
      );
      syncSerializedRegions();
      schedulePersist();
      return;
    }

    const nextRegions = sortStoredAudioRegions(
      regions().map((candidate) =>
        candidate.id === regionId
          ? {
              ...candidate,
              label: trimmedLabel,
            }
          : candidate
      )
    );
    setRegions(nextRegions);
    reconcileSelection(nextRegions);
    schedulePersist();
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
      case "backspace":
      case "delete":
        if (selectedRegionIds().length > 0) {
          event.preventDefault();
          removeSelectedRegions();
        }
        break;
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

  const handlePointerUp = () => {
    setIsDragSelecting(false);
    setDragSelectionAnchorId(null);
    suppressNextRowClick = didDragSelectionChange;
    didDragSelectionChange = false;
  };

  onMount(() => {
    props.onPersistRequestChange?.(() => flushPendingPersist(true));

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
        const kind = getAudioRegionKind(region);
        const label = region.label || getAnnotationKindLabel(kind);
        const restoredRegion = regionsPlugin?.addRegion({
          id: region.id,
          start: region.start,
          ...(isRangeAnnotation(kind) &&
          region.end !== null &&
          region.end !== undefined
            ? { end: region.end }
            : {}),
          content: label,
          color: region.color || getAnnotationColor(kind),
          drag: true,
          resize: isRangeAnnotation(kind),
        });
        if (restoredRegion) {
          setAudioRegionMetadata(
            restoredRegion as AudioRegionInstance,
            kind,
            label,
            region.color || getAnnotationColor(kind)
          );
        }
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
      if (isRestoringRegions || isDisposing) {
        return;
      }
      setSingleSelection(region.id);
      syncSerializedRegions();
      schedulePersist();
    });

    regionsPlugin.on("region-updated", () => {
      if (isRestoringRegions || isDisposing) {
        return;
      }
      syncSerializedRegions();
      schedulePersist();
    });

    regionsPlugin.on("region-removed", (region) => {
      if (isDisposing) {
        return;
      }

      if (selectedRegionId() === region.id) {
        setSelectedRegionId(null);
      }
      if (isRestoringRegions) {
        return;
      }
      syncSerializedRegions();
      disableLoopIfSelectionIsInvalid(false);
      schedulePersist();
    });

    regionsPlugin.on("region-clicked", (region, event) => {
      event.stopPropagation();
      setSingleSelection(region.id);
      if (
        getAudioRegionKind(region as AudioRegionInstance) === "loop" &&
        typeof region.end === "number" &&
        waveSurfer
      ) {
        void waveSurfer.play(region.start, region.end);
      } else if (waveSurfer) {
        waveSurfer.setTime(region.start);
      }
      disableLoopIfSelectionIsInvalid(true);
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
    document.addEventListener("pointerup", handlePointerUp);
  });

  onCleanup(() => {
    isDisposing = true;
    stopPlayback();
    props.onPersistRequestChange?.(null);

    document.removeEventListener("keydown", handleAnnotationHotkeys);
    document.removeEventListener("pointerup", handlePointerUp);

    void flushPendingPersist(false).catch(() => undefined);

    waveSurfer?.destroy();
    waveSurfer = null;
    audioElement = null;
    regionsPlugin = null;
  });

  return (
    <div
      class="flex h-full min-h-0 flex-col gap-4"
      data-testid="audio-player-panel"
    >
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

          <label
            class="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
            classList={{
              "cursor-not-allowed opacity-60":
                !getSelectedRegion() ||
                getAudioRegionKind(
                  getSelectedRegion() as AudioRegionInstance
                ) !== "loop",
            }}
          >
            <input
              type="checkbox"
              checked={loopEnabled()}
              disabled={
                !getSelectedRegion() ||
                getAudioRegionKind(
                  getSelectedRegion() as AudioRegionInstance
                ) !== "loop"
              }
              onChange={(event) => {
                setLoopEnabled(event.currentTarget.checked);
                schedulePersist();
              }}
              class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              data-testid="audio-player-loop-toggle"
            />
            <Repeat class="h-4 w-4" />
            Loop Selected Region
          </label>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
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
              onClick={removeSelectedRegions}
              disabled={selectedRegionIds().length === 0}
              class="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/70 dark:text-red-300 dark:hover:bg-red-950/40"
              data-testid="audio-player-remove-region-button"
            >
              <Trash2 class="h-4 w-4" />
              Remove Selected
            </button>
          </div>

          <p class="text-sm text-slate-500 dark:text-slate-400">
            Click a saved mark or region to select it. Shift-click or drag
            across rows to multi-select. Use Clear to drop the current
            selection. Looping only applies to the active selected loop region.
          </p>
        </div>

        <div class="flex h-72 min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <div class="mb-3 flex items-center justify-between gap-2">
            <h4 class="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              Saved Marks & Regions
            </h4>

            <Show when={selectedRegionIds().length > 0}>
              <button
                type="button"
                onClick={() => clearSelection(true)}
                class="inline-flex h-7 items-center gap-1 rounded-md border border-slate-300 px-2 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                data-testid="audio-player-clear-selection-button"
              >
                <X class="h-3.5 w-3.5" />
                Clear
              </button>
            </Show>
          </div>

          <div
            class="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) {
                clearSelection(true);
              }
            }}
            role="listbox"
            aria-label="Saved marks and regions"
            aria-multiselectable="true"
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
                    const kind = getAudioRegionKind(region);
                    return (
                      <div
                        onPointerDown={(event) =>
                          handleRegionListPointerDown(
                            region.id,
                            event as unknown as PointerEvent
                          )
                        }
                        onClick={(event) =>
                          handleRegionListClick(
                            region.id,
                            event as unknown as MouseEvent
                          )
                        }
                        onKeyDown={(event) =>
                          handleRegionListKeyDown(
                            region.id,
                            event as unknown as KeyboardEvent
                          )
                        }
                        onPointerEnter={() =>
                          handleRegionListPointerEnter(region.id)
                        }
                        class="grid w-full grid-cols-[minmax(0,1fr)_6.5rem_auto] items-center gap-2 rounded-lg border px-2 py-1 text-left transition-colors"
                        role="option"
                        tabIndex={0}
                        aria-selected={selectedRegionIds().includes(region.id)}
                        classList={{
                          "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/40":
                            selectedRegionIds().includes(region.id),
                          "ring-1 ring-inset ring-blue-500 dark:ring-blue-400":
                            selectedRegionId() === region.id,
                          "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900":
                            !selectedRegionIds().includes(region.id),
                        }}
                        data-testid={`audio-player-region-${region.id}`}
                      >
                        <div class="min-w-0 overflow-hidden text-left text-[13px] font-medium text-slate-900 dark:text-slate-100">
                          <span class="truncate">
                            {getRegionDisplayLabel(region)}
                          </span>
                          <span class="ml-2 text-[11px] font-normal text-slate-500 dark:text-slate-400">
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
                          </span>
                        </div>

                        <Show
                          when={!isRangeAnnotation(kind)}
                          fallback={
                            <span class="rounded-full bg-slate-100 px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              Loop
                            </span>
                          }
                        >
                          <select
                            value={kind}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              updatePointAnnotationKind(
                                region.id,
                                event.currentTarget.value as Extract<
                                  AudioAnnotationKind,
                                  "beat" | "measure" | "section"
                                >
                              )
                            }
                            class="h-7 rounded-md border border-slate-300 bg-white px-2 text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            data-testid={`audio-player-region-type-${region.id}`}
                          >
                            <option value="beat">Beat</option>
                            <option value="measure">Measure</option>
                            <option value="section">Section</option>
                          </select>
                        </Show>

                        <div class="flex items-center gap-1">
                          <button
                            type="button"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              renameRegionById(region.id);
                            }}
                            class="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            data-testid={`audio-player-region-rename-${region.id}`}
                          >
                            <span class="sr-only">Rename mark or region</span>
                            <Pencil class="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              removeRegionById(region.id);
                            }}
                            class="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                            data-testid={`audio-player-region-remove-${region.id}`}
                          >
                            <span class="sr-only">Delete mark or region</span>
                            <Trash2 class="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
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
