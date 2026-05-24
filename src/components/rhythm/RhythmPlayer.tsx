import { Dialog as DialogPrimitive } from "@kobalte/core/dialog";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import abcjs from "abcjs";
import {
  EllipsisVertical,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  Save,
  Square,
  Trash2,
  X,
} from "lucide-solid";
import {
  batch,
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
import {
  assembleCanonicalRhythmAbc,
  normalizeStructure,
} from "@/lib/rhythm/canonical-abc";
import { buildNotationRhythmAbc } from "@/lib/rhythm/notation-abc";
import { buildPlaybackRhythmPlan } from "@/lib/rhythm/playback-abc";
import {
  resolveCurrentBeatNotehead,
  updateStructuredDisplayPartLabels,
} from "@/lib/rhythm/structured-display-sync";
import { getStructuredSectionLabel } from "@/lib/rhythm/structured-playback-model";
import type {
  RhythmPatternMetadata,
  RhythmPatternType,
} from "@/lib/services/rhythm-service/RhythmService";
import { createRhythmService } from "@/lib/services/rhythm-service/RhythmService";
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
import { RhythmPatternPicker } from "./RhythmPatternPicker";
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

type CustomPatternEditorMode = "create" | "edit";

const ACTIVE_NOTE_COLOR = "#60a5fa";
const CUSTOM_PATTERN_SAMPLE_KIT_OPTIONS = [
  { value: "bodhran", label: "Bodhran" },
  { value: "melodicTom", label: "Melodic Tom" },
  { value: "generic_click", label: "Generic click" },
] as const;
const CUSTOM_PATTERN_SCOPE_OPTIONS = {
  user_default: "All tunes of this type",
  user_tune: "This tune only",
} as const;

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
    (header) => !new RegExp(String.raw`^\s*${header}`, "m").test(abcString)
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
  let latestPatternLoadRequestId = 0;
  let customPatternNameInputRef: HTMLInputElement | undefined;

  const [isPatternLoading, setIsPatternLoading] = createSignal(false);
  const [notationHostRef, setNotationHostRef] = createSignal<HTMLDivElement>();
  const [loadedPattern, setLoadedPattern] =
    createSignal<RhythmPatternMetadata | null>(null);
  const [usePremiumLoop, setUsePremiumLoop] = createSignal(false);
  const [selectedPatternId, setSelectedPatternId] = createSignal<string | null>(
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
  const activePatternMetadata = createMemo(() => loadedPattern() ?? metadata());
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
  const currentPlaybackMarker = createMemo(
    () => service()?.currentPlaybackMarker() ?? null
  );
  const currentMeasure = createMemo(() => service()?.currentMeasure() ?? 0);
  const error = createMemo(() => service()?.error() ?? null);
  const effectiveStructure = createMemo(
    () =>
      normalizeStructure(props.structure) ??
      activePatternMetadata()?.tuneStructure ??
      null
  );
  const canonicalAbc = createMemo(() => {
    const pattern = activePatternMetadata();
    if (!pattern?.rhythmAbc) {
      return null;
    }

    return assembleCanonicalRhythmAbc({
      sourceAbc: pattern.rhythmAbc,
      patternType: pattern.patternType ?? "seed",
      tuneContext: {
        structure: effectiveStructure(),
        rhythmSignature: pattern.rhythmSignature ?? null,
      },
    });
  });
  const totalBars = createMemo(() => canonicalAbc()?.totalBars ?? 0);
  const patternCandidates = createMemo(
    () => activePatternMetadata()?.patternCandidates ?? []
  );
  const currentPattern = createMemo(
    () =>
      patternCandidates().find(
        (candidate) => candidate.id === selectedPatternId()
      ) ?? null
  );
  const currentPatternChoiceId = createMemo(() => selectedPatternId() ?? "");
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
    genreName:
      activePatternMetadata()?.genreName ?? props.genreName?.trim() ?? null,
    genreId: activePatternMetadata()?.genreId ?? props.genreId?.trim() ?? null,
    tuneTypeName:
      activePatternMetadata()?.tuneTypeName ??
      props.tuneTypeName?.trim() ??
      null,
    tuneTypeId: activePatternMetadata()?.tuneTypeId ?? null,
    rhythmSignature: activePatternMetadata()?.rhythmSignature ?? null,
    sampleKit: activePatternMetadata()?.sampleKit ?? "bodhran",
    patternType: activePatternMetadata()?.patternType ?? "seed",
  }));
  const canManageCustomPatterns = createMemo(() =>
    Boolean(
      localDb() &&
        user()?.id &&
        rhythmPatternContext().genreName &&
        rhythmPatternContext().tuneTypeName
    )
  );
  const playbackPlan = createMemo(() => {
    const assembled = canonicalAbc();
    const pattern = activePatternMetadata();
    if (!assembled || !pattern) {
      return null;
    }

    return buildPlaybackRhythmPlan({
      fullAbc: assembled.fullAbc,
      structure: assembled.structure,
      startSectionValue: selectedStartSection(),
      rhythmSignature: pattern.rhythmSignature ?? null,
      tempoQpm: tempoQpm(),
    });
  });
  const startSectionOptions = createMemo(
    () =>
      playbackPlan()?.startSectionOptions ?? [
        { value: "start", label: "Start", barsBefore: 0 },
      ]
  );
  const displayAbc = createMemo(() => {
    const assembled = canonicalAbc();
    return assembled
      ? buildNotationRhythmAbc({ fullAbc: assembled.fullAbc })
      : null;
  });

  const playbackAbc = createMemo(() => playbackPlan()?.playbackAbc ?? null);

  const selectedStartPositionMs = createMemo(
    () => playbackPlan()?.startPositionMs ?? 0
  );

  const currentBar = createMemo(() => currentMeasure() || 0);
  const currentSectionLabel = createMemo(() =>
    getStructuredSectionLabel(
      canonicalAbc()?.fullAbc ?? null,
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
  const playToggleLabel = createMemo(() => {
    if (isPatternLoading()) {
      return "Loading";
    }

    return isPlaying() ? "Stop" : "Play";
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
      activePatternMetadata()?.rhythmAbc ??
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
      setSelectedPatternId(savedPattern.id);
      setLoadedPattern(null);
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
        setSelectedPatternId(null);
        setLoadedPattern(null);
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

    batch(() => {
      setSelectedPatternId(nextPatternId);
      setLoadedPattern(null);
      setIsPatternLoading(true);
    });
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
      selectedPatternId() !== null
    ) {
      setSelectedPatternId(null);
      setLoadedPattern(null);
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
    const currentSelectedPatternId = selectedPatternId();
    const currentLoadedPattern = loadedPattern();
    const currentService = service();
    const tuneTypeName = props.tuneTypeName?.trim();
    const requestId = latestPatternLoadRequestId + 1;
    latestPatternLoadRequestId = requestId;

    if (!currentService || !tuneTypeName) {
      setIsPatternLoading(false);
      setLoadedPattern(null);
      return;
    }

    if (
      currentLoadedPattern &&
      (currentLoadedPattern.selectedPatternId?.trim() || null) ===
        currentSelectedPatternId
    ) {
      setIsPatternLoading(false);
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
        ...(currentSelectedPatternId
          ? { selectedPatternId: currentSelectedPatternId }
          : {}),
      })
      .then((nextMetadata) => {
        if (requestId !== latestPatternLoadRequestId) {
          return;
        }

        batch(() => {
          setLoadedPattern(nextMetadata ?? null);
          setSelectedPatternId(nextMetadata?.selectedPatternId?.trim() || null);
        });
      })
      .finally(() => {
        if (requestId !== latestPatternLoadRequestId) {
          return;
        }

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
    if (!activePatternMetadata()?.premiumAudioUrl && usePremiumLoop()) {
      setUsePremiumLoop(false);
    }
  });

  createEffect(() => {
    const container = getNotationContainer();
    const sourceAbc = canonicalAbc()?.fullAbc ?? null;
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
    const sourceAbc = canonicalAbc()?.fullAbc ?? null;
    const structure = effectiveStructure();
    const playbackMarker = currentPlaybackMarker();

    if (!container || !rhythmAbc) {
      return;
    }

    const noteheads = getBeatNoteTargets(container);
    if (noteheads.length === 0 || beatIndex < 1) {
      clearActiveBeatTargets();
      return;
    }

    const nextNotehead = resolveCurrentBeatNotehead(
      container,
      noteheads,
      playbackMarker,
      sourceAbc,
      structure,
      beatIndex,
      rhythmAbc
    );
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
                    Boolean(activePatternMetadata()?.premiumAudioUrl) &&
                    usePremiumLoop();

                  void currentService.play({
                    startPositionMs: usePremiumStartOffset
                      ? selectedStartPositionMs()
                      : 0,
                    startBeatIndex: playbackPlan()?.startBeatIndex ?? 0,
                    startMeasure: playbackPlan()?.startMeasure ?? 0,
                    playbackRhythmAbc: usePremiumStartOffset
                      ? undefined
                      : (playbackAbc() ?? undefined),
                  });
                }}
                disabled={
                  !service() || !activePatternMetadata() || isPatternLoading()
                }
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
                {playToggleLabel()}
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
                  !activePatternMetadata() ||
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
                      Boolean(activePatternMetadata()?.premiumAudioUrl) &&
                      usePremiumLoop();

                    void currentService.restart({
                      startPositionMs: usePremiumStartOffset
                        ? selectedStartPositionMs()
                        : 0,
                      startBeatIndex: playbackPlan()?.startBeatIndex ?? 0,
                      startMeasure: playbackPlan()?.startMeasure ?? 0,
                      playbackRhythmAbc: usePremiumStartOffset
                        ? undefined
                        : (playbackAbc() ?? undefined),
                    });
                  }
                }}
                disabled={
                  !service() ||
                  !activePatternMetadata() ||
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

        <Show when={activePatternMetadata()}>
          {(currentMetadata) => (
            <div class="space-y-3">
              <RhythmPatternPicker
                value={currentPatternChoiceId() || null}
                candidates={patternCandidates()}
                canManageCustomPatterns={canManageCustomPatterns()}
                editablePatternId={selectedEditablePatternId()}
                isLoading={isPatternLoading()}
                isCustomPatternBusy={
                  isCustomPatternSaving() || isCustomPatternLoading()
                }
                onChange={(nextPatternId) => {
                  handlePatternSelectionChange(nextPatternId ?? "");
                }}
                onCreateCustom={openCreateCustomPatternEditor}
                onEditCustom={() => {
                  void openEditCustomPatternEditor();
                }}
              />

              <Show when={!canManageCustomPatterns()}>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  Custom patterns need a resolved genre and tune type.
                </p>
              </Show>

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
                <Show when={currentPattern()}>
                  {(pattern) => (
                    <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      {pattern().name}
                    </span>
                  )}
                </Show>
              </div>

              <Show when={currentMetadata().premiumAudioUrl}>
                <div class="flex flex-wrap items-center gap-2 md:gap-3">
                  <Switch
                    checked={usePremiumLoop()}
                    onChange={setUsePremiumLoop}
                    data-testid="rhythm-player-premium-loop-switch"
                    class="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200"
                  >
                    <SwitchLabel class="cursor-pointer select-none">
                      Premium loop
                    </SwitchLabel>
                    <SwitchControl class="ml-1">
                      <SwitchThumb />
                    </SwitchControl>
                  </Switch>
                  <span class="text-xs text-slate-500 dark:text-slate-400">
                    {playbackReadyLabel()}
                  </span>
                </div>
              </Show>
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
