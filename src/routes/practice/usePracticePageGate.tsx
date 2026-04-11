import {
  type Accessor,
  createEffect,
  createMemo,
  type JSX,
  onCleanup,
} from "solid-js";
import { GridStatusMessage } from "../../components/grids/GridStatusMessage";
import { RepertoireEmptyState } from "../../components/repertoire";
import { STARTER_TEMPLATES } from "../../lib/db/starter-repertoire-templates";
import type { RepertoireWithSummary } from "../../lib/db/types";

export interface PracticePageGateProps {
  diagnosticsEnabled: boolean;
  user: Accessor<unknown>;
  localDb: Accessor<unknown>;
  currentRepertoireId: Accessor<string | null>;
  initialSyncComplete: Accessor<boolean>;
  userId: Accessor<string | null>;
  remoteSyncDownCompletionVersion: Accessor<number>;
  repertoires: Accessor<RepertoireWithSummary[] | undefined>;
  repertoiresLoading: Accessor<boolean>;
  repertoiresVersion: Accessor<string>;
  repertoiresLoadedVersion: Accessor<string | null>;
  setRepertoiresLoadedVersion: (value: string | null) => void;
  onOpenAssistant: () => void;
  onCreateRepertoire: () => void;
  /** Called when the user picks a starter template from the empty-state panel */
  onStarterChosen?: (templateId: string) => void;
  /** Whether a starter repertoire is currently being created */
  isCreatingStarter?: Accessor<boolean>;
  /** User-visible error from starter creation, if any */
  starterError?: Accessor<string | null>;
}

export interface PracticePageGateState {
  isPracticeGateOpen: Accessor<boolean>;
  renderPracticeFallback: () => JSX.Element;
}

export function usePracticePageGate(
  props: PracticePageGateProps
): PracticePageGateState {
  const practiceGateState = createMemo(() => {
    const currentUser = props.user();
    const db = props.localDb();
    const repertoireId = props.currentRepertoireId();
    const syncComplete = props.initialSyncComplete();
    const userIdValue = props.userId();
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    const syncDisabled = import.meta.env.VITE_DISABLE_SYNC === "true";
    const remoteSyncVersion = props.remoteSyncDownCompletionVersion();
    const remoteSyncReady = remoteSyncVersion > 0 || !isOnline || syncDisabled;

    return {
      hasUser: !!currentUser,
      hasLocalDb: !!db,
      hasRepertoire: !!repertoireId,
      syncComplete,
      hasUserId: !!userIdValue,
      remoteSyncVersion,
      remoteSyncReady,
      isOnline,
      syncDisabled,
    };
  });

  const isPracticeGateOpen = createMemo(() => {
    const state = practiceGateState();
    return (
      state.hasUser &&
      state.hasLocalDb &&
      state.hasRepertoire &&
      state.syncComplete &&
      state.hasUserId
    );
  });

  const practiceGateBlockingReasons = createMemo(() => {
    const state = practiceGateState();
    const reasons: string[] = [];

    if (!state.hasUser) reasons.push("auth user");
    if (!state.hasLocalDb) reasons.push("localDb");
    if (!state.hasRepertoire) reasons.push("currentRepertoireId");
    if (!state.syncComplete) reasons.push("initialSyncComplete");
    if (!state.hasUserId) reasons.push("userId()");

    return reasons;
  });

  let lastPracticeGateSignature: string | null = null;
  createEffect(() => {
    if (!props.diagnosticsEnabled) return;

    const state = practiceGateState();
    const signature = JSON.stringify(state);

    if (signature === lastPracticeGateSignature) return;
    lastPracticeGateSignature = signature;

    if (!isPracticeGateOpen()) {
      console.log(
        `[PracticePageGate] blocked=${practiceGateBlockingReasons().join(",") || "none"} state=${signature}`
      );
    }
  });

  createEffect(() => {
    if (
      !props.initialSyncComplete() ||
      !props.user() ||
      !props.localDb() ||
      !props.userId()
    ) {
      props.setRepertoiresLoadedVersion(null);
      return;
    }

    if (!props.repertoiresLoading() && props.repertoires() !== undefined) {
      props.setRepertoiresLoadedVersion(props.repertoiresVersion());
    }
  });

  createEffect(() => {
    window.addEventListener("tt-open-ai-assistant", props.onOpenAssistant);
    onCleanup(() => {
      window.removeEventListener("tt-open-ai-assistant", props.onOpenAssistant);
    });
  });

  const renderPracticeFallback = () => {
    const gateBlocked = !isPracticeGateOpen();
    const blockingReasons = practiceGateBlockingReasons();
    const repertoiresReady =
      props.repertoiresLoadedVersion() === props.repertoiresVersion();
    const repertoiresLoading =
      !repertoiresReady ||
      props.repertoiresLoading() ||
      props.repertoires() === undefined;
    const repertoireCount = props.repertoires()?.length ?? 0;

    if (
      props.initialSyncComplete() &&
      !props.currentRepertoireId() &&
      !repertoiresLoading &&
      repertoireCount === 0
    ) {
      // Show inline starter picker when callbacks are wired in; otherwise fall
      // back to the simple single "Create repertoire" button.
      const hasStarterSupport = !!props.onStarterChosen;
      return (
        <RepertoireEmptyState
          title="Welcome to TuneTrees! 🎵"
          description={
            hasStarterSupport
              ? "Get started with a pre-populated starter repertoire, or create your own from scratch."
              : `Repertoires group tunes by instrument, genre, or goal. ` +
                `Create a new repertoire to start practicing, or select ` +
                `an existing repertoire, if one exists, from the Repertoire ` +
                `menu in the top banner.`
          }
          starterTemplates={hasStarterSupport ? STARTER_TEMPLATES : undefined}
          onStarterChosen={props.onStarterChosen}
          onCreateCustom={props.onCreateRepertoire}
          isCreatingStarter={props.isCreatingStarter?.()}
          starterError={props.starterError?.()}
        />
      );
    }

    return (
      <GridStatusMessage
        variant="loading"
        title="Loading practice queue..."
        description={
          props.diagnosticsEnabled && gateBlocked && blockingReasons.length > 0
            ? `Waiting for: ${blockingReasons.join(", ")}`
            : "Syncing your scheduled tunes."
        }
      />
    );
  };

  return {
    isPracticeGateOpen,
    renderPracticeFallback,
  };
}
