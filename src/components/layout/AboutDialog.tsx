/**
 * About Dialog Component
 *
 * Displays version information, build details, and app credits.
 * Opened from the logo dropdown menu in TopNav.
 *
 * @module components/layout/AboutDialog
 */

import type { Component } from "solid-js";
import { createSignal, Show } from "solid-js";
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

/**
 * About TuneTrees Dialog
 *
 * Shows:
 * - App version (from package.json)
 * - Build date and git commit
 * - Environment (dev/production)
 * - Copyright and license info
 * - Links to GitHub and documentation
 * - Update button (if update available or to check for updates)
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

  return (
    <AlertDialog
      open={props.isOpen}
      onOpenChange={(open) => !open && props.onClose()}
    >
      <AlertDialogContent
        data-testid="about-dialog"
        class="bg-white dark:bg-gray-900"
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

        <div class="py-4">
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

          {/* Update section - only show in production */}
          <Show when={!import.meta.env.DEV}>
            <div class="mb-4">
              <Show
                when={needRefresh()}
                fallback={
                  <Button
                    onClick={handleCheckForUpdate}
                    variant="outline"
                    size="sm"
                    class="w-full"
                    disabled={checking()}
                    data-testid="about-check-update-button"
                  >
                    {checking() ? "Checking..." : "Check for Update"}
                  </Button>
                }
              >
                <div class="space-y-2">
                  <p class="text-sm text-center text-green-600 dark:text-green-400 font-medium">
                    Update Available!
                  </p>
                  <Button
                    onClick={handleUpdate}
                    variant="default"
                    size="sm"
                    class="w-full"
                    data-testid="about-update-button"
                  >
                    Update Now
                  </Button>
                </div>
              </Show>
            </div>
            <div class="border-t border-gray-200 dark:border-gray-700 mb-4" />
          </Show>

          <div class="text-center space-y-1">
            <p class="text-sm text-gray-600 dark:text-gray-400">
              © 2024 TuneTrees Contributors
            </p>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Licensed under MIT
            </p>
          </div>
        </div>

        <AlertDialogFooter class="flex-row justify-center gap-2">
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
