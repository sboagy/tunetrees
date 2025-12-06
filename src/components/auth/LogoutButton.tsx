/**
 * Logout Button Component
 *
 * Simple button to sign out the current user.
 * Can be used in navigation bars, user menus, etc.
 *
 * @module components/auth/LogoutButton
 */

import { type Component, createSignal, Show } from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";

interface LogoutButtonProps {
  /** Custom class names */
  class?: string;
  /** Callback after successful logout */
  onSuccess?: () => void;
  /** Show as icon button instead of text */
  iconOnly?: boolean;
}

/**
 * Logout Button Component
 *
 * Features:
 * - Calls signOut from auth context
 * - Shows loading state during logout
 * - Error handling
 * - Optional icon-only mode
 *
 * @example
 * ```tsx
 * <LogoutButton onSuccess={() => navigate('/login')} />
 * ```
 */
export const LogoutButton: Component<LogoutButtonProps> = (props) => {
  const { signOut, loading } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const handleLogout = async () => {
    setError(null);
    setIsLoggingOut(true);

    try {
      await signOut();
      // Success!
      props.onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign out");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const baseClass =
    props.class ||
    "px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors";

  return (
    <div>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut() || loading()}
        class={baseClass}
        title={props.iconOnly ? "Sign out" : undefined}
      >
        <Show
          when={!isLoggingOut() && !loading()}
          fallback={
            <span class="flex items-center gap-2">
              <svg
                class="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                  fill="none"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <Show when={!props.iconOnly}>Signing out...</Show>
            </span>
          }
        >
          <Show when={props.iconOnly} fallback={<span>Sign Out</span>}>
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </Show>
        </Show>
      </button>

      {/* Error Display */}
      <Show when={error()}>
        <div class="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p class="text-sm text-red-600 dark:text-red-400">{error()}</p>
        </div>
      </Show>
    </div>
  );
};
