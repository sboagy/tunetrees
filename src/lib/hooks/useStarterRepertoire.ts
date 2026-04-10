/**
 * useStarterRepertoire
 *
 * Shared hook that encapsulates the logic for creating a starter repertoire
 * from a template and advancing to the "choose-genres" onboarding step.
 *
 * Previously this logic lived inside OnboardingOverlay (Step 1 modal).
 * It has been extracted here so both the Practice and Repertoire empty-state
 * panels can trigger the same flow without duplicating code.
 *
 * @module lib/hooks/useStarterRepertoire
 */

import { createSignal } from "solid-js";
import { useAuth } from "../auth/AuthContext";
import { useOnboarding } from "../context/OnboardingContext";
import { getStarterTemplateById } from "../db/starter-repertoire-templates";

export interface UseStarterRepertoireReturn {
  /** Whether a starter is currently being created (for disabling buttons) */
  isCreatingStarter: () => boolean;
  /** User-visible error from the last creation attempt, or null */
  starterError: () => string | null;
  /**
   * Create a starter repertoire from the given template ID, store the
   * pending-starter in context, and advance onboarding to the genre step.
   */
  handleStarterChosen: (templateId: string) => Promise<void>;
}

export function useStarterRepertoire(): UseStarterRepertoireReturn {
  const { user, userIdInt } = useAuth();
  const { beginOnboardingAtGenreStep } = useOnboarding();

  const [starterError, setStarterError] = createSignal<string | null>(null);

  const handleStarterChosen = async (templateId: string): Promise<void> => {
    // Prefer the internal integer-mapped UUID; fall back to auth user id
    const userId = userIdInt() ?? user()?.id;
    if (!userId) return;

    const template = getStarterTemplateById(templateId);
    if (!template) return;

    // Do NOT create the repertoire yet — just open the genre-selection dialog.
    // The repertoire will be created only if the user presses "Continue"
    // in the genre dialog. Pressing "Cancel" brings them back to this panel
    // with no side-effects.
    setStarterError(null);
    beginOnboardingAtGenreStep(userId, templateId);
  };

  // isCreatingStarter is always false because creation is now deferred to the
  // genre dialog's Continue button. The signal is kept for interface compat
  // with callers that wire it into loading UI on the starter-picker panel.
  const isCreatingStarter = () => false;

  return { isCreatingStarter, starterError, handleStarterChosen };
}
