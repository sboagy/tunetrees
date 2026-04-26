/**
 * About Dialog Component
 *
 * Displays version information, build details, and app credits.
 * Opened from the logo dropdown menu in TopNav.
 *
 * @module components/layout/AboutDialog
 */

import type { Component } from "solid-js";
import { createSignal, For } from "solid-js";
import {
  AlertDialog,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { usePWAUpdate } from "@/lib/hooks/usePWAUpdate";

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const mitLicenseText = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const aboutCredits = [
  {
    name: "wavesurfer.js",
    testId: "wavesurfer-js",
    copyright: "Copyright (c) 2012-2023, katspaugh and contributors",
    licenseName: "BSD 3-Clause License",
    licenseText: `Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the name of the copyright holder nor the names of its
  contributors may be used to endorse or promote products derived from
  this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`,
  },
  {
    name: "ts-fsrs",
    testId: "ts-fsrs",
    copyright: "Copyright (c) 2025 Open Spaced Repetition",
    licenseName: "MIT License",
    licenseText: mitLicenseText,
  },
  {
    name: "abcjs",
    testId: "abcjs",
    copyright: "Copyright (c) 2009-2024 Paul Rosen and Gregory Dyke",
    licenseName: "MIT License",
    licenseText: mitLicenseText,
  },
  {
    name: "chart.js",
    testId: "chart-js",
    copyright: "Copyright (c) 2014-2024 Chart.js Contributors",
    licenseName: "MIT License",
    licenseText: mitLicenseText,
  },
  {
    name: "Jodit",
    testId: "jodit",
    copyright: "Copyright (c) 2013-2026 https://xdsoft.net",
    licenseName: "MIT License",
    licenseText: mitLicenseText,
  },
] as const;

/**
 * About TuneTrees Dialog
 *
 * Shows:
 * - App version (from package.json)
 * - Build date and git commit
 * - Environment (dev/production)
 * - Copyright and license info
 * - Links to GitHub and documentation
 * - Footer update action (if update available or to check for updates)
 */
export const AboutDialog: Component<AboutDialogProps> = (props) => {
  // Get build-time constants injected by Vite
  const version = __APP_VERSION__;
  const buildDate = new Date(__BUILD_DATE__).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const gitCommit = __GIT_COMMIT__;
  const gitBranch = __GIT_BRANCH__;
  const environment = import.meta.env.MODE;

  // PWA update state (only in production)
  const { needRefresh, updateServiceWorker, checkForUpdate } = usePWAUpdate();
  const [checking, setChecking] = createSignal(false);

  // Delay after clicking "Check for Update" to show "Checking..." state
  const UPDATE_CHECK_TIMEOUT = 2000;

  const handleCheckForUpdate = async () => {
    setChecking(true);
    checkForUpdate();

    // Give it a moment to check
    setTimeout(() => {
      setChecking(false);
    }, UPDATE_CHECK_TIMEOUT);
  };

  const handleUpdate = async () => {
    console.log("[PWA] User clicked Update from About dialog");
    await updateServiceWorker(true);
  };

  const handleUpdateAction = async () => {
    if (needRefresh()) {
      await handleUpdate();
      return;
    }

    await handleCheckForUpdate();
  };

  return (
    <AlertDialog
      open={props.isOpen}
      onOpenChange={(open) => !open && props.onClose()}
    >
      <AlertDialogContent
        data-testid="about-dialog"
        class="flex max-h-[90vh] flex-col overflow-hidden bg-white dark:bg-gray-900"
      >
        <AlertDialogCloseButton />
        <AlertDialogHeader>
          <div class="flex flex-col items-center gap-4 text-center">
            <img
              src="/logo4.png"
              alt="TuneTrees Logo"
              width="96"
              height="96"
              class="h-24 w-24 object-contain"
            />
            <div>
              <AlertDialogTitle class="text-2xl">TuneTrees</AlertDialogTitle>
              <AlertDialogDescription class="text-base mt-2">
                Practice Manager for Tunes
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div class="flex min-h-0 flex-1 flex-col py-4 pb-6">
          <dl class="space-y-3 text-sm">
            <div class="flex justify-between">
              <dt class="font-medium text-gray-600 dark:text-gray-400">
                Version:
              </dt>
              <dd
                class="text-gray-900 dark:text-gray-100 font-mono"
                data-testid="about-version"
              >
                {version}
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="font-medium text-gray-600 dark:text-gray-400">
                Build:
              </dt>
              <dd
                class="text-gray-900 dark:text-gray-100 text-right"
                data-testid="about-build"
              >
                {buildDate} @ {gitCommit}
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="font-medium text-gray-600 dark:text-gray-400">
                Branch:
              </dt>
              <dd
                class="text-gray-900 dark:text-gray-100 font-mono"
                data-testid="about-branch"
              >
                {gitBranch}
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="font-medium text-gray-600 dark:text-gray-400">
                Environment:
              </dt>
              <dd
                class="text-gray-900 dark:text-gray-100 capitalize"
                data-testid="about-environment"
              >
                {environment}
              </dd>
            </div>
          </dl>

          <div class="border-t border-gray-200 dark:border-gray-700 my-4" />

          <div class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
            <span>© 2024 TuneTrees Contributors</span>
            <span aria-hidden="true" class="opacity-60">
              •
            </span>
            <span>Licensed under MIT</span>
          </div>

          <div class="border-t border-gray-200 dark:border-gray-700 my-4" />

          <section
            class="flex min-h-0 flex-1 flex-col space-y-3"
            data-testid="about-credits-section"
          >
            <div class="space-y-1">
              <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
                Credits & Open Source
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                TuneTrees is made possible by these open-source projects:
              </p>
            </div>

            <div class="relative h-80 overflow-hidden">
              <div
                class="about-credits-scrollbar h-full space-y-3 overflow-y-auto pb-14 pr-2"
                data-testid="about-credits-scroll"
              >
                <For each={aboutCredits}>
                  {(credit) => (
                    <div
                      class="rounded-md border border-gray-200 p-3 text-sm dark:border-gray-700"
                      data-testid={`about-credit-${credit.testId}`}
                    >
                      <p class="font-semibold text-gray-900 dark:text-gray-100">
                        {credit.name}
                      </p>
                      <p class="mt-1 text-gray-600 dark:text-gray-400">
                        {credit.copyright}
                      </p>
                      <details
                        class="mt-2"
                        data-testid={`about-license-${credit.testId}`}
                      >
                        <summary class="cursor-pointer font-medium text-blue-600 dark:text-blue-400">
                          View {credit.licenseName}
                        </summary>
                        <pre class="mt-2 whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                          {credit.licenseText}
                        </pre>
                      </details>
                    </div>
                  )}
                </For>
              </div>

              <div
                class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white via-white/98 to-transparent dark:from-gray-900 dark:via-gray-900/98"
                aria-hidden="true"
                data-testid="about-credits-fade"
              />
            </div>
          </section>
        </div>

        <AlertDialogFooter class="relative z-10 shrink-0 border-t border-gray-200 bg-white pt-4 dark:border-gray-700 dark:bg-gray-900 flex-row justify-center gap-2">
          <Button
            onClick={handleUpdateAction}
            variant="outline"
            size="sm"
            disabled={checking()}
            data-testid="about-check-update-button"
          >
            {checking()
              ? "Checking..."
              : needRefresh()
                ? "Update Now"
                : "Check for Update"}
          </Button>
          <Button
            as="a"
            href="https://github.com/sboagy/tunetrees"
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
            size="sm"
            data-testid="about-github-link"
          >
            GitHub
          </Button>
          <Button
            as="a"
            href="https://github.com/sboagy/tunetrees/blob/main/README.md"
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
            size="sm"
            data-testid="about-docs-link"
          >
            Documentation
          </Button>
          <Button
            onClick={() => props.onClose()}
            variant="default"
            size="sm"
            data-testid="about-close-button"
          >
            Close
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
