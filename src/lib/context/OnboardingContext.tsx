/**
 * Onboarding Context for TuneTrees
 *
 * Manages the new user onboarding flow for both anonymous and registered users.
 * Shows onboarding when no playlists exist (instead of using localStorage).
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
  
  /** Start onboarding flow */
  startOnboarding: () => void;
  
  /** Move to next onboarding step */
  nextStep: () => void;
  
  /** Complete onboarding */
  completeOnboarding: () => void;
  
  /** Skip onboarding */
  skipOnboarding: () => void;
  
  /** Check if user should see onboarding (no playlists) */
  shouldShowOnboarding: (hasPlaylists: boolean) => boolean;
}

/**
 * Onboarding steps
 */
export type OnboardingStep = 
  | "create-playlist"
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
  const [onboardingStep, setOnboardingStep] = createSignal<OnboardingStep | null>(null);

  /**
   * Check if user should see onboarding based on whether they have playlists
   */
  const shouldShowOnboarding = (hasPlaylists: boolean): boolean => {
    return !hasPlaylists;
  };

  /**
   * Start onboarding flow
   */
  const startOnboarding = () => {
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
  };

  /**
   * Skip onboarding
   */
  const skipOnboarding = () => {
    console.log("🎓 Skipping onboarding");
    completeOnboarding();
  };

  const onboardingState: OnboardingState = {
    needsOnboarding,
    onboardingStep,
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
