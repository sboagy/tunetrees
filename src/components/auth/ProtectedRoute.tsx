/**
 * Protected Route Component
 *
 * Wrapper component that checks authentication status and redirects
 * unauthenticated users to the login page.
 *
 * @module components/auth/ProtectedRoute
 */

import { Navigate } from "@solidjs/router";
import { type ParentComponent, Show } from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";

interface ProtectedRouteProps {
  /** Path to redirect to if not authenticated */
  redirectTo?: string;
}

/**
 * Protected Route Component
 *
 * Features:
 * - Checks if user is authenticated
 * - Shows loading state while checking auth
 * - Redirects to login if not authenticated
 * - Renders children if authenticated
 *
 * @example
 * ```tsx
 * <Route path="/practice" component={() => (
 *   <ProtectedRoute>
 *     <PracticePage />
 *   </ProtectedRoute>
 * )} />
 * ```
 */
export const ProtectedRoute: ParentComponent<ProtectedRouteProps> = (props) => {
  const { user, loading } = useAuth();
  const redirectTo = props.redirectTo || "/login";

  return (
    <Show
      when={!loading()}
      fallback={
        <div class="flex items-center justify-center min-h-screen">
          <div class="text-center">
            <svg
              class="animate-spin h-12 w-12 mx-auto text-blue-600"
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
            <p class="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      }
    >
      <Show when={user()} fallback={<Navigate href={redirectTo} />}>
        {props.children}
      </Show>
    </Show>
  );
};
