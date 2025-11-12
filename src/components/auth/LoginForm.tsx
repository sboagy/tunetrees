/**
 * Login Form Component
 *
 * Provides authentication UI for TuneTrees:
 * - Email/password sign in
 * - OAuth sign in (Google, GitHub)
 * - Toggle to sign up form
 *
 * @module components/auth/LoginForm
 */

import { Eye, EyeOff } from "lucide-solid";
import { type Component, createEffect, createSignal, Show } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { useAuth } from "../../lib/auth/AuthContext";
import { supabase } from "../../lib/supabase/client";

interface LoginFormProps {
  /** Callback after successful login */
  onSuccess?: () => void;
  /** Show sign up form by default */
  defaultToSignUp?: boolean;
}

/**
 * Login/Sign Up Form Component
 *
 * Features:
 * - Email/password authentication
 * - OAuth (Google, GitHub)
 * - Toggle between sign in and sign up
 * - Form validation
 * - Error display
 * - Loading states
 *
 * @example
 * ```tsx
 * <LoginForm onSuccess={() => navigate('/practice')} />
 * ```
 */
export const LoginForm: Component<LoginFormProps> = (props) => {
  const {
    signIn,
    signUp,
    signInWithOAuth,
    signInAnonymously,
    convertAnonymousToRegistered,
    isAnonymous,
    loading,
  } = useAuth();
  const [searchParams] = useSearchParams();

  // Check if user is converting from anonymous mode
  const isConverting = () => searchParams.convert === "true" && isAnonymous();

  const [isSignUp, setIsSignUp] = createSignal(props.defaultToSignUp ?? false);
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [name, setName] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [showPassword, setShowPassword] = createSignal(false);
  const [showForgotPassword, setShowForgotPassword] = createSignal(false);
  const [resetEmail, setResetEmail] = createSignal("");
  const [resetSuccess, setResetSuccess] = createSignal(false);

  // Auto-switch to sign up mode when converting
  createEffect(() => {
    if (isConverting()) {
      setIsSignUp(true);
    }
  });

  /**
   * Handle anonymous sign-in
   */
  const handleAnonymousSignIn = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const { error: anonymousError } = await signInAnonymously();
      if (anonymousError) {
        setError(anonymousError.message);
        return;
      }

      // Success!
      props.onSuccess?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle email/password form submission
   */
  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const emailVal = email().trim();
      const passwordVal = password().trim();

      // Basic validation
      if (!emailVal || !passwordVal) {
        setError("Email and password are required");
        return;
      }

      if (passwordVal.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }

      if (isSignUp()) {
        const nameVal = name().trim();
        if (!nameVal) {
          setError("Name is required");
          return;
        }

        // Check if converting from anonymous mode
        if (isConverting()) {
          const { error: convertError } = await convertAnonymousToRegistered(
            emailVal,
            passwordVal,
            nameVal
          );
          if (convertError) {
            setError(convertError.message);
            return;
          }
          // Success! Data preserved
          props.onSuccess?.();
        } else {
          // Regular sign up
          const { error: signUpError } = await signUp(
            emailVal,
            passwordVal,
            nameVal
          );
          if (signUpError) {
            setError(signUpError.message);
            return;
          }
          // Success!
          props.onSuccess?.();
        }
      } else {
        const { error: signInError } = await signIn(emailVal, passwordVal);
        if (signInError) {
          setError(signInError.message);
          return;
        }

        // Success!
        props.onSuccess?.();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle OAuth sign in
   */
  const handleOAuthSignIn = async (provider: "google" | "github") => {
    setError(null);
    setIsSubmitting(true);

    try {
      const { error: oauthError } = await signInWithOAuth(provider);
      if (oauthError) {
        setError(oauthError.message);
      }
      // OAuth redirect will happen automatically
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Toggle between sign in and sign up
   */
  const toggleMode = () => {
    setIsSignUp(!isSignUp());
    setError(null);
    setPassword("");
    setName("");
    setShowForgotPassword(false);
    setResetSuccess(false);
  };

  /**
   * Handle password reset request
   */
  const handlePasswordReset = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const emailVal = resetEmail().trim();

      if (!emailVal) {
        setError("Email is required");
        return;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        emailVal,
        {
          redirectTo: `${window.location.origin}/auth/callback`,
        }
      );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setResetSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Forgot Password Modal */}
      <Show when={showForgotPassword()}>
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div
            class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-password-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setShowForgotPassword(false);
                setResetSuccess(false);
                setError(null);
                setResetEmail("");
              }
              e.stopPropagation();
            }}
          >
            <Show
              when={!resetSuccess()}
              fallback={
                <div class="text-center">
                  <div class="text-green-500 text-5xl mb-4">✓</div>
                  <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Check Your Email
                  </h2>
                  <p class="text-gray-600 dark:text-gray-400 mb-6">
                    We've sent password reset instructions to{" "}
                    <strong>{resetEmail()}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetSuccess(false);
                      setResetEmail("");
                    }}
                    class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md"
                  >
                    Close
                  </button>
                </div>
              }
            >
              <h2
                id="reset-password-title"
                class="text-xl font-bold text-gray-900 dark:text-white mb-2"
              >
                Reset Password
              </h2>
              <p class="text-gray-600 dark:text-gray-400 mb-4">
                Enter your email address and we'll send you a link to reset your
                password.
              </p>

              <Show when={error()}>
                <div class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <p class="text-sm text-red-600 dark:text-red-400">
                    {error()}
                  </p>
                </div>
              </Show>

              <form onSubmit={handlePasswordReset} class="space-y-4">
                <div>
                  <label
                    for="reset-email"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Email
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    value={resetEmail()}
                    onInput={(e) => setResetEmail(e.currentTarget.value)}
                    placeholder="you@example.com"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    disabled={isSubmitting()}
                    required
                  />
                </div>

                <div class="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setError(null);
                      setResetEmail("");
                    }}
                    class="flex-1 py-2 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting()}
                    class="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md"
                  >
                    {isSubmitting() ? "Sending..." : "Send Reset Link"}
                  </button>
                </div>
              </form>
            </Show>
          </div>
        </div>
      </Show>

      {/* Main Login Form */}
      <div class="w-full max-w-md mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        {/* Header */}
        <div class="mb-6 text-center">
          <Show
            when={isConverting()}
            fallback={
              <>
                <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {isSignUp() ? "Create Account" : "Welcome Back"}
                </h1>
                <p class="text-gray-600 dark:text-gray-400">
                  {isSignUp()
                    ? "Sign up to start practicing"
                    : "Sign in to continue practicing"}
                </p>
              </>
            }
          >
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Backup Your Data
            </h1>
            <p class="text-gray-600 dark:text-gray-400">
              Create an account to save and sync your tunes across devices
            </p>
            <div class="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <p class="text-sm text-blue-700 dark:text-blue-300">
                ✨ Your local data will be preserved and start syncing
                automatically
              </p>
            </div>
          </Show>
        </div>

        {/* Error Display */}
        <Show when={error()}>
          <div class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p class="text-sm text-red-600 dark:text-red-400">{error()}</p>
          </div>
        </Show>

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit} class="space-y-4 mb-6">
          {/* Name Field (Sign Up Only) */}
          <Show when={isSignUp()}>
            <div>
              <label
                for="name"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                placeholder="Your name"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                disabled={isSubmitting() || loading()}
              />
            </div>
          </Show>

          {/* Email Field */}
          <div>
            <label
              for="email"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
              placeholder="you@example.com"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={isSubmitting() || loading()}
              required
            />
          </div>

          {/* Password Field */}
          <div>
            <label
              for="password"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Password
            </label>
            <div class="relative">
              <input
                id="password"
                type={showPassword() ? "text" : "password"}
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                placeholder="••••••••"
                class="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                disabled={isSubmitting() || loading()}
                required
                minlength="6"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword())}
                class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
                aria-label={showPassword() ? "Hide password" : "Show password"}
              >
                <Show when={showPassword()} fallback={<Eye class="w-5 h-5" />}>
                  <EyeOff class="w-5 h-5" />
                </Show>
              </button>
            </div>
          </div>

          {/* Forgot Password Link (Sign In Only) */}
          <Show when={!isSignUp()}>
            <div class="flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                class="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              >
                Forgot password?
              </button>
            </div>
          </Show>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting() || loading()}
            class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <Show
              when={!isSubmitting() && !loading()}
              fallback={<span>Loading...</span>}
            >
              {isSignUp() ? "Create Account" : "Sign In"}
            </Show>
          </button>
        </form>

        {/* Divider */}
        <div class="relative mb-6">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-300 dark:border-gray-600" />
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-2 bg-white dark:bg-gray-800 text-gray-500">
              Or continue with
            </span>
          </div>
        </div>

        {/* OAuth Buttons */}
        <div class="space-y-3 mb-6">
          {/* Google Sign In */}
          <button
            type="button"
            onClick={() => handleOAuthSignIn("google")}
            disabled={isSubmitting() || loading()}
            class="w-full flex items-center justify-center gap-3 py-2 px-4 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          {/* GitHub Sign In */}
          <button
            type="button"
            onClick={() => handleOAuthSignIn("github")}
            disabled={isSubmitting() || loading()}
            class="w-full flex items-center justify-center gap-3 py-2 px-4 bg-gray-900 hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              class="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            <span>Continue with GitHub</span>
          </button>
        </div>

        {/* Toggle Sign Up/Sign In */}
        <div class="text-center space-y-3">
          {/* Anonymous Sign In Option - hide when converting */}
          <Show when={!isConverting()}>
            <div>
              <button
                type="button"
                onClick={handleAnonymousSignIn}
                disabled={isSubmitting() || loading()}
                class="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Show
                  when={!isSubmitting() && !loading()}
                  fallback={<span>Loading...</span>}
                >
                  Use on this Device Only
                </Show>
              </button>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Try TuneTrees without an account. Your data will only be stored
                on this device and won't sync to other devices.
              </p>
            </div>

            {/* Divider */}
            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div class="relative flex justify-center text-sm">
                <span class="px-2 bg-white dark:bg-gray-800 text-gray-500">
                  Or
                </span>
              </div>
            </div>
          </Show>

          <Show when={!isConverting()}>
            <button
              type="button"
              onClick={toggleMode}
              class="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
            >
              {isSignUp() ? (
                <>
                  Already have an account?{" "}
                  <span class="underline">Sign in</span>
                </>
              ) : (
                <>
                  Don't have an account? <span class="underline">Sign up</span>
                </>
              )}
            </button>
          </Show>
        </div>
      </div>
    </>
  );
};
