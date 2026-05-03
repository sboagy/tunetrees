/**
 * Logout Button Component
 *
 * Simple button to sign out the current user.
 * Can be used in navigation bars, user menus, etc.
 *
 * @module components/auth/LogoutButton
 */

import { Loader2, LogOut } from "lucide-solid";
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
              <Loader2 class="animate-spin h-4 w-4" aria-hidden="true" />
              <Show when={!props.iconOnly}>Signing out...</Show>
            </span>
          }
        >
          <Show when={props.iconOnly} fallback={<span>Sign Out</span>}>
            <LogOut class="w-5 h-5" aria-hidden="true" />
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
