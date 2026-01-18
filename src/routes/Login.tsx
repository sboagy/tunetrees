/**
 * Login Page
 *
 * Public route for user authentication.
 * Redirects to practice page after successful login.
 *
 * @module routes/Login
 */

import { useNavigate } from "@solidjs/router";
import type { Component } from "solid-js";
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
  const { user, loading, isAnonymous } = useAuth();

  // Redirect to practice if already logged in or anonymous (only after auth is loaded)
  if (!loading() && (user() || isAnonymous())) {
    navigate("/", { replace: true });
  }

  const handleSuccess = () => {
    navigate("/");
  };

  return (
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-start sm:items-center justify-center px-4 sm:px-6 lg:px-8 py-6 sm:py-10 [@media(max-height:760px)]:py-4">
      <div class="max-w-md w-full space-y-6 sm:space-y-8 [@media(max-height:760px)]:space-y-4">
        {/* Logo/Branding */}
        <div class="flex items-center justify-center gap-4">
          <img
            src="/logo4.png"
            alt="TuneTrees Logo"
            width="48"
            height="48"
            class="h-16 w-16 sm:h-24 sm:w-24 [@media(max-height:760px)]:h-14 [@media(max-height:760px)]:w-14 object-contain"
          />
          <div class="text-left">
            <span class="text-4xl sm:text-5xl [@media(max-height:760px)]:text-3xl font-bold leading-tight dark:text-blue-400">
              TuneTrees
            </span>
            <p class="m-1 sm:m-2 [@media(max-height:760px)]:m-0.5 text-lg sm:text-2xl [@media(max-height:760px)]:text-base text-gray-600 dark:text-gray-400">
              Practice manager
            </p>
          </div>
        </div>

        {/* Login Form - Always render, LoginForm handles its own loading state */}
        <LoginForm onSuccess={handleSuccess} />
      </div>
    </div>
  );
};

export default Login;
