/**
 * Privacy Policy Page
 *
 * Public route for OAuth consent screen requirements.
 *
 * @module routes/Privacy
 */

import { A } from "@solidjs/router";
import type { Component } from "solid-js";

const PrivacyPolicy: Component = () => {
  return (
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div class="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
        <header class="flex flex-col gap-4">
          <div class="flex items-center gap-4">
            <img
              src="/logo4.png"
              alt="TuneTrees Logo"
              width="48"
              height="48"
              class="h-12 w-12 object-contain"
            />
            <div>
              <h1 class="text-3xl font-bold">Privacy Policy</h1>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Last updated: January 14, 2026
              </p>
            </div>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            This policy explains what TuneTrees collects and how it is used when
            you sign in or use the app.
          </p>
        </header>

        <section class="space-y-3 text-sm leading-6">
          <h2 class="text-lg font-semibold">Information we collect</h2>
          <ul class="list-disc space-y-2 pl-5">
            <li>
              Account data from OAuth providers (name, email, avatar) when you
              sign in with Google or GitHub.
            </li>
            <li>
              App data you create, such as tune lists, practice history, and
              settings.
            </li>
            <li>
              Basic technical data required to run the app (browser storage,
              authentication tokens).
            </li>
          </ul>
        </section>

        <section class="space-y-3 text-sm leading-6">
          <h2 class="text-lg font-semibold">How we use information</h2>
          <ul class="list-disc space-y-2 pl-5">
            <li>Authenticate your account and keep you signed in.</li>
            <li>Sync your data between devices and provide core features.</li>
            <li>Maintain security and prevent abuse.</li>
          </ul>
        </section>

        <section class="space-y-3 text-sm leading-6">
          <h2 class="text-lg font-semibold">Data storage</h2>
          <ul class="list-disc space-y-2 pl-5">
            <li>
              Local data is stored in your browser (IndexedDB) for offline use.
            </li>
            <li>
              Cloud data is stored in Supabase (Postgres) when you sign in.
            </li>
          </ul>
        </section>

        <section class="space-y-3 text-sm leading-6">
          <h2 class="text-lg font-semibold">Sharing</h2>
          <p>
            TuneTrees does not sell your personal data. We share data only with
            service providers required to operate the app (Supabase for data
            storage and Google/GitHub for OAuth sign-in).
          </p>
        </section>

        <section class="space-y-3 text-sm leading-6">
          <h2 class="text-lg font-semibold">Your choices</h2>
          <ul class="list-disc space-y-2 pl-5">
            <li>You can sign out at any time.</li>
            <li>
              You can request account deletion by opening a support request.
            </li>
          </ul>
        </section>

        <section class="space-y-3 text-sm leading-6">
          <h2 class="text-lg font-semibold">Contact</h2>
          <p>
            For privacy questions, open an issue at{" "}
            <a
              class="text-blue-600 hover:underline dark:text-blue-400"
              href="https://github.com/sboagy/tunetrees/issues"
              rel="noreferrer"
              target="_blank"
            >
              https://github.com/sboagy/tunetrees/issues
            </a>
            .
          </p>
        </section>

        <footer>
          <A
            class="text-sm text-blue-600 hover:underline dark:text-blue-400"
            href="/login"
          >
            Back to login
          </A>
        </footer>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
