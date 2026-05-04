/**
 * Protected Route Component
 *
 * Wrapper component that checks authentication status and redirects
 * unauthenticated users to the login page.
 *
 * @module components/auth/ProtectedRoute
 */

import { Navigate } from "@solidjs/router";
import { Loader2 } from "lucide-solid";
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
            <Loader2
              class="animate-spin h-12 w-12 mx-auto text-blue-600"
              aria-hidden="true"
            />
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
