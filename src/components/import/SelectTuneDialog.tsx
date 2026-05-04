/**
 * Select Tune Dialog Component
 *
 * Dialog for selecting a tune from multiple TheSession.org search results.
 * User can select one tune from radio options and open URLs to preview.
 *
 * @module components/import/SelectTuneDialog
 */

import { ExternalLink, Import } from "lucide-solid";
import type { Component } from "solid-js";
import { createSignal, For } from "solid-js";
import type { ITheSessionTuneSummary } from "../../lib/import/the-session-schemas";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";

export interface SelectTuneDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** List of tune search results to choose from */
  tunes: ITheSessionTuneSummary[];
  /** Callback when user selects a tune (receives the tune URL) */
  onTuneSelect: (url: string | null) => void;
}

/**
 * Dialog for selecting one tune from multiple TheSession.org search results.
 * Displays radio buttons with tune name and type, plus "Open URL" links.
 */
export const SelectTuneDialog: Component<SelectTuneDialogProps> = (props) => {
  const [selectedUrl, setSelectedUrl] = createSignal<string | null>(null);

  const handleImport = () => {
    const url = selectedUrl();
    if (url) {
      props.onTuneSelect(url);
      props.onOpenChange(false);
    }
  };

  const handleCancel = () => {
    props.onOpenChange(false);
    props.onTuneSelect(null);
  };

  return (
    <AlertDialog open={props.open} onOpenChange={props.onOpenChange}>
      <AlertDialogContent class="max-w-2xl bg-gray-900 dark:bg-gray-900">
        <header class="flex justify-between items-center w-full mb-4">
          <div class="flex flex-1 justify-start">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
          <div class="flex min-w-0 flex-1 justify-center px-3">
            <AlertDialogTitle class="text-center">
              Select a Tune from thesession.org
            </AlertDialogTitle>
          </div>
          <div class="flex flex-1 justify-end">
            <Button onClick={handleImport} disabled={!selectedUrl()} size="sm">
              <Import class="h-4 w-4" />
              Import
            </Button>
          </div>
        </header>

        <AlertDialogDescription>
          Please select the tune that best matches your search.
        </AlertDialogDescription>

        {/* Tune List with Radio Buttons */}
        <div class="max-h-96 overflow-y-auto space-y-2">
          <For each={props.tunes}>
            {(tune) => (
              <div class="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <label class="flex items-center gap-3 flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="tune-selection"
                    value={tune.url}
                    checked={selectedUrl() === tune.url}
                    onChange={() => setSelectedUrl(tune.url)}
                    class="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-blue-600"
                  />
                  <span class="text-sm text-gray-900 dark:text-gray-100">
                    {tune.name} ({tune.type})
                  </span>
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    window.open(tune.url, "_blank");
                  }}
                  class="flex items-center gap-2"
                >
                  <ExternalLink class="h-4 w-4" />
                  <span class="hidden sm:inline">Open URL</span>
                </Button>
              </div>
            )}
          </For>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};
