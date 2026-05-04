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

import { A, useNavigate, useSearchParams } from "@solidjs/router";
import { Eye, EyeOff } from "lucide-solid";
import { type Component, createEffect, createSignal, Show } from "solid-js";
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
  const navigate = useNavigate();

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
      return;
    }

    const isSignUpFromUrl =
      searchParams.mode === "signup" || searchParams.signup === "true";
    setIsSignUp(isSignUpFromUrl || (props.defaultToSignUp ?? false));
  });

  /**
   * Handle anonymous sign-in
   */
  const handleAnonymousSignIn = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const injectedTestUserId =
        typeof window !== "undefined"
          ? (window as { __ttTestUserId?: string }).__ttTestUserId
          : undefined;
      if (injectedTestUserId) {
        await signInAnonymously(injectedTestUserId);
        props.onSuccess?.();
        return;
      }
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
    const nextIsSignUp = !isSignUp();
    setIsSignUp(nextIsSignUp);
    setError(null);
    setPassword("");
    setName("");
    setShowForgotPassword(false);
    setResetSuccess(false);

    if (!isConverting()) {
      navigate(nextIsSignUp ? "/login?mode=signup" : "/login", {
        replace: false,
      });
    }
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
      <div class="w-full max-w-md mx-auto p-5 sm:p-6 [@media(max-height:760px)]:p-4 [@media(max-height:760px)]:text-sm bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        {/* Header - Only shown when converting */}
        <Show when={isConverting()}>
          <div class="mb-5 sm:mb-6 [@media(max-height:760px)]:mb-4 text-center">
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
          </div>
        </Show>

        {/* Anonymous Sign In Option - at top when not converting */}
        <Show when={!isConverting()}>
          <Show when={!isSignUp()}>
            <div class="relative mb-3">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div class="relative flex justify-center text-sm">
                <span class="px-2 bg-white dark:bg-gray-800 text-gray-500">
                  Run local only, as anonymous
                </span>
              </div>
            </div>{" "}
            <div class="mb-5 sm:mb-6 [@media(max-height:760px)]:mb-4">
              <button
                type="button"
                onClick={handleAnonymousSignIn}
                disabled={isSubmitting() || loading()}
                class="w-full py-2 [@media(max-height:760px)]:py-1.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                <Show
                  when={!isSubmitting() && !loading()}
                  fallback={<span>Loading...</span>}
                >
                  Use on this Device Only
                </Show>
              </button>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                Try TuneTrees without an account. Your data will only be stored
                on this device and won't sync to other devices.
              </p>
            </div>
            {/* Divider - "Or (sign up)" */}
            <div class="relative mb-3">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div class="relative flex justify-center text-sm">
                <span class="px-2 bg-white dark:bg-gray-800 text-gray-500">
                  Or sign up
                </span>
              </div>
            </div>
          </Show>

          {/* Toggle Sign Up/Sign In - only show when not converting */}
          <div class="text-center">
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
          </div>

          {/* Divider - "Or sign in" */}
          <div
            class={`relative ${isSignUp() ? "mb-4 mt-4" : "mb-5 mt-5 sm:mb-6 sm:mt-6 [@media(max-height:760px)]:mb-4 [@media(max-height:760px)]:mt-4"}`}
          >
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-300 dark:border-gray-600" />
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-white dark:bg-gray-800 text-gray-500">
                {isSignUp() ? "Sign up with email" : "Or sign in with password"}
              </span>
            </div>
          </div>
        </Show>

        {/* Error Display */}
        <Show when={error()}>
          <div class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p class="text-sm text-red-600 dark:text-red-400">{error()}</p>
          </div>
        </Show>

        {/* Email/Password Form */}
        <form
          onSubmit={handleSubmit}
          class="space-y-3 sm:space-y-4 [@media(max-height:760px)]:space-y-2 mb-5 sm:mb-6 [@media(max-height:760px)]:mb-4"
        >
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
                class="w-full px-3 py-2 [@media(max-height:760px)]:py-1.5 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
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
              class="w-full px-3 py-2 [@media(max-height:760px)]:py-1.5 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
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
                autocomplete={isSignUp() ? "new-password" : "current-password"}
                placeholder="••••••••"
                class="w-full px-3 py-2 [@media(max-height:760px)]:py-1.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
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
            class="w-full py-2 [@media(max-height:760px)]:py-1.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
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
        <div class="relative mb-5 sm:mb-6 [@media(max-height:760px)]:mb-4">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-300 dark:border-gray-600" />
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-2 bg-white dark:bg-gray-800 text-gray-500">
              Or sign in with social authentication
            </span>
          </div>
        </div>

        {/* OAuth Buttons */}
        <div class="space-y-3 mb-4 sm:mb-6 [@media(max-height:760px)]:mb-3">
          {/* Google Sign In */}
          <button
            type="button"
            onClick={() => handleOAuthSignIn("google")}
            disabled={isSubmitting() || loading()}
            class="w-full flex items-center justify-center gap-3 py-2 [@media(max-height:760px)]:py-1.5 px-4 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Continue with Google</span>
          </button>

          {/* GitHub Sign In */}
          <button
            type="button"
            onClick={() => handleOAuthSignIn("github")}
            disabled={isSubmitting() || loading()}
            class="w-full flex items-center justify-center gap-3 py-2 [@media(max-height:760px)]:py-1.5 px-4 bg-gray-900 hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Continue with GitHub</span>
          </button>
        </div>

        <div class="flex items-center justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <A class="hover:underline" href="/privacy">
            Privacy Policy
          </A>
          <span aria-hidden="true">•</span>
          <A class="hover:underline" href="/terms">
            Terms of Service
          </A>
        </div>
      </div>
    </>
  );
};
