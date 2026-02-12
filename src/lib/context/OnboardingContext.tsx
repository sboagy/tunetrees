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

  /** Start onboarding flow */
  startOnboarding: () => void;

  /** Move to next onboarding step */
  nextStep: () => void;

  /** Complete onboarding */
  completeOnboarding: () => void;

  /** Skip onboarding */
  skipOnboarding: () => void;

  /** Check if user should see onboarding (no repertoires) */
  shouldShowOnboarding: (hasPlaylists: boolean) => boolean;
}

/**
 * Onboarding steps
 */
export type OnboardingStep =
  | "create-playlist"
  | "choose-genres"
  | "view-catalog"
  | "complete";

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

  // Track if user has already skipped/completed onboarding
  // Persist to localStorage so it survives page refreshes
  const SKIPPED_KEY = "tunetrees:onboarding-skipped";
  const [wasSkippedOrCompleted, setWasSkippedOrCompleted] = createSignal(
    typeof localStorage !== "undefined" &&
      localStorage.getItem(SKIPPED_KEY) === "true"
  );

  /**
   * Check if user should see onboarding based on whether they have repertoires
   */
  const shouldShowOnboarding = (hasPlaylists: boolean): boolean => {
    return !hasPlaylists;
  };

  /**
   * Start onboarding flow
   * Will not re-start if user has already skipped or completed onboarding this session
   */
  const startOnboarding = () => {
    // Don't restart if already skipped or completed
    if (wasSkippedOrCompleted()) {
      console.log("🎓 Onboarding already skipped/completed, not restarting");
      return;
    }
    console.log("🎓 Starting onboarding flow");
    setNeedsOnboarding(true);
    setOnboardingStep("create-playlist");
  };

  /**
   * Move to next step in onboarding
   */
  const nextStep = () => {
    const current = onboardingStep();
    console.log("🎓 Onboarding next step from:", current);

    if (current === "create-playlist") {
      setOnboardingStep("choose-genres");
    } else if (current === "choose-genres") {
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
    setWasSkippedOrCompleted(true);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SKIPPED_KEY, "true");
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
    nextStep,
    completeOnboarding,
    skipOnboarding,
    shouldShowOnboarding,
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
