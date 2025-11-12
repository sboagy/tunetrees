/**
 * Select Tune Dialog Component
 *
 * Dialog for selecting a tune from multiple TheSession.org search results.
 * User can select one tune from radio options and open URLs to preview.
 *
 * @module components/import/SelectTuneDialog
 */

import { ExternalLink } from "lucide-solid";
import type { Component } from "solid-js";
import { For, Show, createSignal } from "solid-js";
import type { ITheSessionTuneSummary } from "../../lib/import/the-session-schemas";
import {
  AlertDialog,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
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
      <AlertDialogContent class="max-w-2xl">
        <AlertDialogCloseButton />
        <AlertDialogHeader>
          <AlertDialogTitle>Select a Tune from thesession.org</AlertDialogTitle>
          <AlertDialogDescription>
            Please select the tune that best matches your search.
          </AlertDialogDescription>
        </AlertDialogHeader>

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

        <AlertDialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!selectedUrl()}
          >
            Import
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
