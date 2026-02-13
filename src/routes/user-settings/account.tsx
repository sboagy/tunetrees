/**
 * Account Settings Page
 *
 * Update account information (name, email, avatar, phone).
 * Matches legacy: legacy/frontend/app/user-settings/account/page.tsx
 *
 * @module routes/user-settings/account
 */

import { type Component, createEffect, createSignal, Show } from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  getUserProfile,
  updateUserProfile,
} from "@/lib/db/queries/user-settings";
import { supabase } from "@/lib/supabase/client";

const AccountPage: Component = () => {
  const { user, localDb } = useAuth();

  // Form state
  const [name, setName] = createSignal<string>("");
  const [email, setEmail] = createSignal<string>("");
  const [phone, setPhone] = createSignal<string>("");
  const [avatarUrl, setAvatarUrl] = createSignal<string | null>(null);

  // UI state
  const [isLoading, setIsLoading] = createSignal(true);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [isDirty, setIsDirty] = createSignal(false);
  const [successMessage, setSuccessMessage] = createSignal<string | null>(null);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
  const [validationErrors, setValidationErrors] = createSignal<
    Record<string, string>
  >({});

  // Load existing profile
  createEffect(() => {
    const currentUser = user();
    const db = localDb();
    if (currentUser?.id && db) {
      setIsLoading(true);
      getUserProfile(db, currentUser.id)
        .then((profile) => {
          if (profile) {
            setName(profile.name ?? "");
            setEmail(profile.email ?? currentUser.email ?? "");
            setPhone(profile.phone ?? "");
            setAvatarUrl(profile.avatarUrl);
          } else {
            // No profile yet, use auth data
            setEmail(currentUser.email ?? "");
          }
        })
        .catch((error) => {
          console.error("Failed to load user profile:", error);
          setErrorMessage("Failed to load user profile");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  });

  // Track form changes
  const markDirty = () => {
    if (!isDirty()) {
      setIsDirty(true);
      setSuccessMessage(null);
      setErrorMessage(null);
    }
  };

  // Form validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Name is required
    if (!name().trim()) {
      errors.name = "Name is required";
    }

    // Email is read-only from Supabase, but validate format if somehow changed
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email() && !emailRegex.test(email())) {
      errors.email = "Invalid email format";
    }

    // Phone is optional, but validate format if provided
    if (phone().trim()) {
      // Basic phone validation (allow various formats)
      const phoneRegex =
        /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
      if (!phoneRegex.test(phone().replace(/\s/g, ""))) {
        errors.phone = "Invalid phone format";
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!validateForm()) {
      setErrorMessage("Please fix validation errors");
      return;
    }

    const currentUser = user();
    const db = localDb();
    if (!currentUser?.id || !db) {
      setErrorMessage("User not authenticated or database not ready");
      return;
    }

    setIsSubmitting(true);

    try {
      // Update local profile
      await updateUserProfile(db, {
        id: currentUser.id,
        name: name().trim() || null,
        email: email().trim() || null,
        phone: phone().trim() || null,
        avatarUrl: avatarUrl(),
      });

      // Update Supabase auth user metadata if name changed
      if (name().trim()) {
        const { error: updateError } = await supabase.auth.updateUser({
          data: { name: name().trim() },
        });
        if (updateError) {
          console.warn("Failed to update Supabase user metadata:", updateError);
        }
      }

      setSuccessMessage("Account settings updated successfully");
      setIsDirty(false);
    } catch (error) {
      console.error("Failed to update account settings:", error);
      setErrorMessage("Failed to update account settings");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div class="space-y-6">
      <div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
          Account
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage your account information.
        </p>
      </div>

      <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
        <Show
          when={!isLoading()}
          fallback={<div class="text-sm text-gray-500">Loading profile...</div>}
        >
          <form onSubmit={handleSubmit} class="space-y-6">
            {/* Name Field */}
            <div class="space-y-1.5">
              <label
                for="name"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Name
              </label>
              <input
                id="name"
                type="text"
                placeholder="Your name"
                value={name()}
                onInput={(e) => {
                  setName(e.currentTarget.value);
                  markDirty();
                }}
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                data-testid="user_name"
              />
              <Show when={validationErrors().name}>
                <p class="text-xs text-red-600">{validationErrors().name}</p>
              </Show>
            </div>

            {/* Email Field (read-only) */}
            <div class="space-y-1.5">
              <label
                for="email"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email()}
                disabled
                readonly
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                data-testid="user_email"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Email is managed by your authentication provider (Supabase) and
                cannot be changed here.
              </p>
            </div>

            {/* Phone Field (optional) */}
            <div class="space-y-1.5">
              <label
                for="phone"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Phone Number (Optional)
              </label>
              <input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phone()}
                onInput={(e) => {
                  setPhone(e.currentTarget.value);
                  markDirty();
                }}
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                data-testid="user_phone"
              />
              <Show when={validationErrors().phone}>
                <p class="text-xs text-red-600">{validationErrors().phone}</p>
              </Show>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                For SMS notifications and account recovery.
              </p>
            </div>

            {/* Password Management */}
            <div class="space-y-2">
              <div class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                To change your password, use the password reset link on the
                login page or click the button below.
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const { error } = await supabase.auth.resetPasswordForEmail(
                      email(),
                      {
                        redirectTo: `${window.location.origin}/reset-password`,
                      }
                    );
                    if (error) throw error;
                    setSuccessMessage(
                      "Password reset email sent. Check your inbox."
                    );
                  } catch (error) {
                    console.error(
                      "Failed to send password reset email:",
                      error
                    );
                    setErrorMessage("Failed to send password reset email");
                  }
                }}
                class="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                Send Password Reset Email
              </button>
            </div>

            {/* Success/Error Messages */}
            <Show when={successMessage()}>
              <div class="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <p class="text-sm text-green-800 dark:text-green-200">
                  {successMessage()}
                </p>
              </div>
            </Show>

            <Show when={errorMessage()}>
              <div class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p class="text-sm text-red-800 dark:text-red-200">
                  {errorMessage()}
                </p>
              </div>
            </Show>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={
                !isDirty() ||
                isSubmitting() ||
                Object.keys(validationErrors()).length > 0
              }
              class="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors"
            >
              {isSubmitting() ? "Saving..." : "Update account"}
            </button>
          </form>
        </Show>
      </div>
    </div>
  );
};

export default AccountPage;
