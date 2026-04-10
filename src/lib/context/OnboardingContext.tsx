/**
 * Onboarding Context for TuneTrees
 *
 * Manages the new user onboarding flow for both anonymous and registered users.
 * Shows onboarding when no repertoires exist (instead of using localStorage).
 *
 * @module lib/context/OnboardingContext
 */

import {
  type Accessor,
  createContext,
  createSignal,
  type ParentComponent,
  useContext,
} from "solid-js";

/**
 * Onboarding state interface
 */
interface OnboardingState {
  /** Whether onboarding is needed */
  needsOnboarding: Accessor<boolean>;

  /** Current step in onboarding flow */
  onboardingStep: Accessor<OnboardingStep | null>;

  /** Whether onboarding has been checked this session */
  hasCheckedOnboarding: Accessor<boolean>;

  /** Mark onboarding as checked */
  setHasCheckedOnboarding: (value: boolean) => void;

  /** Start onboarding flow. Pass userId to scope the skipped flag per user. */
  startOnboarding: (userId?: string) => void;

  /**
   * Begin the onboarding flow directly at the "choose-genres" step.
   * Called after the user picks a starter repertoire from the empty-state
   * panel (Step 1 is now fully inline; this kicks off Steps 2+3 as modals).
   * Pass userId to scope the skipped flag per user.
   * Pass templateId to store which starter template was chosen (creation is
   * deferred until the user confirms in the genre dialog).
   */
  beginOnboardingAtGenreStep: (userId?: string, templateId?: string) => void;

  /**
   * Dismiss the genre-selection dialog WITHOUT creating a repertoire or
   * marking onboarding as skipped/completed. Used by the Cancel button so
   * the user returns to the starter-picker panel and can choose again.
   */
  dismissGenreDialog: () => void;

  /**
   * The starter template the user clicked but whose repertoire has not yet
   * been created (deferred until they press Continue in the genre dialog).
   * null when no template is pending creation.
   */
  chosenStarterTemplateId: Accessor<string | null>;

  /** Clear the chosen-template selection (used when dialog is dismissed or creation completes) */
  setChosenStarterTemplateId: (id: string | null) => void;

  /** Move to next onboarding step */
  nextStep: () => void;

  /** Complete onboarding */
  completeOnboarding: () => void;

  /** Skip onboarding */
  skipOnboarding: () => void;

  /** Check if user should see onboarding (no repertoires) */
  shouldShowOnboarding: (hasRepertoires: boolean) => boolean;

  /**
   * ID of a starter repertoire that is waiting to be populated with tunes
   * after the catalog sync completes (set in Step 1, consumed in Step 2).
   * null when no starter is pending.
   */
  pendingStarterRepertoireId: Accessor<string | null>;

  /**
   * Template ID of the pending starter so the overlay knows which genres to
   * pre-select and which filter to use during population.
   */
  pendingStarterTemplateId: Accessor<string | null>;

  /** Store the starter repertoire ID and template ID for deferred population */
  setPendingStarter: (repertoireId: string, templateId: string) => void;

  /** Clear the pending starter once it has been populated */
  clearPendingStarter: () => void;
}

/**
 * Onboarding steps
 */
export type OnboardingStep = "choose-genres" | "view-catalog" | "complete";

/**
 * Onboarding context (undefined until provider is mounted)
 */
const OnboardingContext = createContext<OnboardingState>();

/**
 * Onboarding Provider Component
 *
 * Wraps the app and provides onboarding state to all child components.
 *
 * @example
 * ```tsx
 * import { OnboardingProvider } from '@/lib/context/OnboardingContext';
 *
 * function App() {
 *   return (
 *     <OnboardingProvider>
 *       <YourApp />
 *     </OnboardingProvider>
 *   );
 * }
 * ```
 */
export const OnboardingProvider: ParentComponent = (props) => {
  const [needsOnboarding, setNeedsOnboarding] = createSignal(false);
  const [onboardingStep, setOnboardingStep] =
    createSignal<OnboardingStep | null>(null);
  const [hasCheckedOnboarding, setHasCheckedOnboarding] = createSignal(false);

  // Track if user has already skipped/completed onboarding.
  // Key is user-scoped so different users (anonymous vs. real account) each
  // get their own independent onboarding state.
  const SKIPPED_KEY_PREFIX = "tunetrees:onboarding-skipped";
  const skippedKey = (userId?: string) =>
    userId ? `${SKIPPED_KEY_PREFIX}:${userId}` : SKIPPED_KEY_PREFIX;
  const isSkippedFor = (userId?: string) =>
    typeof localStorage !== "undefined" &&
    localStorage.getItem(skippedKey(userId)) === "true";

  // Track the current userId so completeOnboarding/skipOnboarding can write
  // to the right user-scoped key.
  const [currentOnboardingUserId, setCurrentOnboardingUserId] = createSignal<
    string | undefined
  >(undefined);

  // Track a starter repertoire that needs tune population after catalog sync.
  const [pendingStarterRepertoireId, setPendingStarterRepertoireId] =
    createSignal<string | null>(null);
  const [pendingStarterTemplateId, setPendingStarterTemplateId] = createSignal<
    string | null
  >(null);

  // Track the template the user clicked BEFORE the repertoire is created.
  // Creation is deferred until the user presses Continue in the genre dialog.
  const [chosenStarterTemplateId, setChosenStarterTemplateId] = createSignal<
    string | null
  >(null);

  /** Store the starter repertoire ID and template ID for deferred population */
  const setPendingStarter = (repertoireId: string, templateId: string) => {
    setPendingStarterRepertoireId(repertoireId);
    setPendingStarterTemplateId(templateId);
  };

  /** Clear the pending starter once population is complete */
  const clearPendingStarter = () => {
    setPendingStarterRepertoireId(null);
    setPendingStarterTemplateId(null);
  };

  /**
   * Check if user should see onboarding based on whether they have repertoires
   */
  const shouldShowOnboarding = (hasRepertoires: boolean): boolean => {
    return !hasRepertoires;
  };

  /**
   * Start onboarding flow.
   *
   * Step 1 now lives inline in the empty-state UI, so the modal flow begins at
   * the genre dialog. This ensures callers never land in a state where
   * needsOnboarding is true but no overlay is rendered.
   *
   * @param userId - Optional user ID to scope the "skipped" localStorage flag
   *   per user. Pass the current user's ID so that switching from an anonymous
   *   session to a real account (or vice versa) doesn't inherit the other
   *   session's skipped state.
   */
  const startOnboarding = (userId?: string) => {
    // Don't restart if this specific user has already skipped or completed.
    if (isSkippedFor(userId)) {
      console.log(
        "🎓 Onboarding already skipped/completed for this user, not restarting"
      );
      return;
    }
    setCurrentOnboardingUserId(userId);
    setChosenStarterTemplateId(null);
    console.log("🎓 Starting onboarding flow");
    setNeedsOnboarding(true);
    setOnboardingStep("choose-genres");
  };

  /**
   * Begin the onboarding flow directly at the "choose-genres" step.
   *
   * Called after the user selects a starter repertoire from the inline
   * empty-state panel (Step 1 is now embedded in the UI rather than shown
   * as a separate modal). This causes the OnboardingOverlay modals for
   * Steps 2 ("choose-genres") and 3 ("view-catalog") to appear.
   *
   * Unlike startOnboarding(), this intentionally bypasses the isSkippedFor
   * guard because the user just explicitly acted, regardless of past state.
   *
   * @param userId - Optional user ID to scope the "skipped" flag.
   */
  const beginOnboardingAtGenreStep = (userId?: string, templateId?: string) => {
    setCurrentOnboardingUserId(userId);
    if (templateId !== undefined) {
      // Record which template the user clicked; the repertoire will be created
      // only if they press Continue in the genre dialog.
      setChosenStarterTemplateId(templateId);
    }
    console.log("🎓 Beginning onboarding at genre-selection step");
    setNeedsOnboarding(true);
    setOnboardingStep("choose-genres");
  };

  /**
   * Dismiss the genre dialog without creating a repertoire or writing
   * to localStorage. The user returns to the starter-picker panel.
   */
  const dismissGenreDialog = () => {
    console.log("🎓 Dismissing genre dialog — no repertoire created");
    setNeedsOnboarding(false);
    setOnboardingStep(null);
    clearPendingStarter();
    setChosenStarterTemplateId(null);
    // Do NOT write to localStorage — the user is not marked as skipped/completed.
  };

  /**
   * Move to next step in onboarding
   */
  const nextStep = () => {
    const current = onboardingStep();
    console.log("🎓 Onboarding next step from:", current);

    if (current === "choose-genres") {
      setOnboardingStep("view-catalog");
    } else if (current === "view-catalog") {
      setOnboardingStep("complete");
      completeOnboarding();
    }
  };

  /**
   * Complete onboarding
   */
  const completeOnboarding = () => {
    console.log("🎓 Completing onboarding");
    setNeedsOnboarding(false);
    setOnboardingStep(null);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(skippedKey(currentOnboardingUserId()), "true");
    }
  };

  /**
   * Skip onboarding
   */
  const skipOnboarding = () => {
    console.log("🎓 Skipping onboarding");
    completeOnboarding();
  };

  /**
   * Reset onboarding state (useful for testing or after user creates a repertoire)
   */

  // const resetOnboarding = () => {
  //   setWasSkippedOrCompleted(false);
  //   setHasCheckedOnboarding(false);
  //   if (typeof localStorage !== "undefined") {
  //     localStorage.removeItem(SKIPPED_KEY);
  //   }
  // };

  const onboardingState: OnboardingState = {
    needsOnboarding,
    onboardingStep,
    hasCheckedOnboarding,
    setHasCheckedOnboarding,
    startOnboarding,
    beginOnboardingAtGenreStep,
    dismissGenreDialog,
    nextStep,
    completeOnboarding,
    skipOnboarding,
    shouldShowOnboarding,
    chosenStarterTemplateId,
    setChosenStarterTemplateId,
    pendingStarterRepertoireId,
    pendingStarterTemplateId,
    setPendingStarter,
    clearPendingStarter,
  };

  return (
    <OnboardingContext.Provider value={onboardingState}>
      {props.children}
    </OnboardingContext.Provider>
  );
};

/**
 * Hook to access onboarding context
 *
 * @throws Error if used outside OnboardingProvider
 *
 * @example
 * ```tsx
 * import { useOnboarding } from '@/lib/context/OnboardingContext';
 *
 * function MyComponent() {
 *   const { needsOnboarding, startOnboarding } = useOnboarding();
 *
 *   return (
 *     <div>
 *       {needsOnboarding() && <button onClick={startOnboarding}>Start Tour</button>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useOnboarding(): OnboardingState {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return context;
}
