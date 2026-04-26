/**
 * About Dialog Component
 *
 * Displays version information, build details, and app credits.
 * Opened from the logo dropdown menu in TopNav.
 *
 * @module components/layout/AboutDialog
 */

import type { Component } from "solid-js";
import { createResource, createSignal, For, Show } from "solid-js";
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
import type { AboutCredit } from "./about-dialog-credits";

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

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
  const [credits] = createResource(
    () => props.isOpen,
    async (isOpen): Promise<readonly AboutCredit[]> => {
      if (!isOpen) {
        return [];
      }

      const { aboutCredits } = await import("./about-dialog-credits");
      return aboutCredits;
    }
  );

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

        <div class="py-4 pb-6">
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

          <section class="space-y-3" data-testid="about-credits-section">
            <div class="space-y-1">
              <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
                Credits & Open Source
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                TuneTrees is made possible by these open-source projects:
              </p>
            </div>

            <div class="relative h-80 overflow-hidden rounded-md">
              <div
                class="about-credits-scrollbar h-full space-y-3 overflow-y-auto pb-14 pr-2"
                data-testid="about-credits-scroll"
              >
                <Show
                  when={credits()?.length}
                  fallback={
                    <p
                      class="text-sm text-gray-600 dark:text-gray-400"
                      data-testid="about-credits-loading"
                    >
                      Loading open-source credits...
                    </p>
                  }
                >
                  <For each={credits()}>
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
                </Show>
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
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
