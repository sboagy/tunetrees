/**
 * Anonymous User Banner Component
 *
 * Displays a persistent banner for anonymous users prompting them to
 * create an account to backup and sync their data.
 *
 * @module components/auth/AnonymousBanner
 */

import { X } from "lucide-solid";
import { type Component, createSignal } from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";

/**
 * Anonymous User Banner Component
 *
 * Features:
 * - Persistent banner at top of app for anonymous users
 * - "Create Account" button to start conversion
 * - Dismissible (per session)
 * - Clear value proposition
 *
 * @example
 * ```tsx
 * <AnonymousBanner onConvert={() => navigate('/signup')} />
 * ```
 */
export const AnonymousBanner: Component<{
  onConvert: () => void;
}> = (props) => {
  const { isAnonymous } = useAuth();
  const [dismissed, setDismissed] = createSignal(false);

  // Don't show if not anonymous or dismissed
  if (!isAnonymous() || dismissed()) {
    return null;
  }

  return (
    <div class="bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <div class="flex-shrink-0">
              <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <span class="text-2xl">💾</span>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold mb-0.5">
                You're using TuneTrees on this device only
              </p>
              <p class="text-xs text-blue-100">
                Create an account to backup your data and sync across all your
                devices
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              onClick={props.onConvert}
              class="px-4 py-2 bg-white text-blue-600 hover:bg-blue-50 font-medium rounded-md shadow-sm transition-colors text-sm"
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              class="p-1.5 hover:bg-white/10 rounded-md transition-colors"
              aria-label="Dismiss banner"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
