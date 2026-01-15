/**
 * Terms of Service Page
 *
 * Public route for OAuth consent screen requirements.
 *
 * @module routes/Terms
 */

import { A } from "@solidjs/router";
import type { Component } from "solid-js";

const TermsOfService: Component = () => {
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
              <h1 class="text-3xl font-bold">Terms of Service</h1>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Last updated: January 14, 2026
              </p>
            </div>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            These terms govern your use of TuneTrees.
          </p>
        </header>

        <section class="space-y-3 text-sm leading-6">
          <h2 class="text-lg font-semibold">Acceptance</h2>
          <p>
            By accessing or using TuneTrees, you agree to these terms. If you do
            not agree, do not use the service.
          </p>
        </section>

        <section class="space-y-3 text-sm leading-6">
          <h2 class="text-lg font-semibold">Accounts</h2>
          <p>
            You are responsible for your account activity. Social sign-in is
            provided by Google or GitHub and subject to their terms.
          </p>
        </section>

        <section class="space-y-3 text-sm leading-6">
          <h2 class="text-lg font-semibold">Acceptable use</h2>
          <ul class="list-disc space-y-2 pl-5">
            <li>Do not misuse or attempt to disrupt the service.</li>
            <li>Do not access data that is not yours.</li>
            <li>Comply with applicable laws and regulations.</li>
          </ul>
        </section>

        <section class="space-y-3 text-sm leading-6">
          <h2 class="text-lg font-semibold">Availability</h2>
          <p>
            TuneTrees is provided on an as-is basis and may change or be
            unavailable at any time.
          </p>
        </section>

        <section class="space-y-3 text-sm leading-6">
          <h2 class="text-lg font-semibold">Limitation of liability</h2>
          <p>
            To the extent permitted by law, TuneTrees is not liable for indirect
            or incidental damages resulting from use of the service.
          </p>
        </section>

        <section class="space-y-3 text-sm leading-6">
          <h2 class="text-lg font-semibold">Contact</h2>
          <p>
            For questions about these terms, open an issue at{" "}
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

export default TermsOfService;
