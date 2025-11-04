/**
 * Account Settings Page
 *
 * Update account information (name, email, avatar).
 * Matches legacy: legacy/frontend/app/user-settings/account/page.tsx
 *
 * @module routes/user-settings/account
 */

import type { Component } from "solid-js";

const AccountPage: Component = () => {
  return (
    <div class="space-y-6">
      <div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
          Account
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Update your account settings and avatar.
        </p>
      </div>

      <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Account form will be implemented here.
        </p>
        {/* TODO: Implement form with:
          - Name field
          - Email field (read-only from Supabase auth)
          - Avatar picker (predefined + custom upload)
          - Update button
        */}
      </div>
    </div>
  );
};

export default AccountPage;
