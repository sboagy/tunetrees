/**
 * Login Page
 *
 * Public route for user authentication.
 * Redirects to practice page after successful login.
 *
 * @module routes/Login
 */

import { useNavigate } from "@solidjs/router";
import { type Component, Show } from "solid-js";
import { LoginForm } from "../components/auth";
import { useAuth } from "../lib/auth/AuthContext";

/**
 * Login Page Component
 *
 * Features:
 * - Renders LoginForm component
 * - Redirects to /practice after successful auth
 * - Automatically redirects if already logged in
 *
 * @example
 * ```tsx
 * <Route path="/login" component={Login} />
 * ```
 */
const Login: Component = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect to practice if already logged in
  if (user()) {
    navigate("/", { replace: true });
  }

  const handleSuccess = () => {
    navigate("/");
  };

  return (
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full space-y-8">
        {/* Logo/Branding */}
        <div class="flex items-center justify-center gap-4">
          <img
            src="/logo4.png"
            alt="TuneTrees Logo"
            width="48"
            height="48"
            class="h-24 w-24 object-contain"
          />
          <div class="text-left">
            <span class="text-5xl font-bold leading-tight dark:text-blue-400">
              TuneTrees
            </span>
            <p class="m-2 text-2xl text-gray-600 dark:text-gray-400">
              Practice smarter, not harder
            </p>
          </div>
        </div>

        {/* Login Form */}
        <Show when={!user()}>
          <LoginForm onSuccess={handleSuccess} />
        </Show>
      </div>
    </div>
  );
};

export default Login;
