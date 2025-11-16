/**
 * Add Tune Dialog Component
 *
 * Main dialog for adding/importing tunes. Replaces direct navigation to /tunes/new.
 * Allows user to:
 * - Select genre (ITRAD shows import options, others show "No import sites")
 * - Enter URL or tune title
 * - Click "New" to create empty tune, or "Search/Import" to import
 *
 * @module components/import/AddTuneDialog
 */

import { useLocation, useNavigate } from "@solidjs/router";
import abcjs from "abcjs";
import { Import } from "lucide-solid";
import type { Component } from "solid-js";
import { createSignal, Show } from "solid-js";
import {
  extractIncipitFromTheSessionJson,
  fetchTheSessionURLsFromTitle,
  fetchTuneInfoFromTheSessionURL,
  getBarsPerSection,
  normalizeKey,
  normalizeTuneType,
} from "../../lib/import/import-utils";
import type { ITheSessionTuneSummary } from "../../lib/import/the-session-schemas";
import {
  AlertDialog,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import type { SettingOption } from "./SelectSettingDialog";
import { SelectSettingDialog } from "./SelectSettingDialog";
import { SelectTuneDialog } from "./SelectTuneDialog";

export interface AddTuneDialogProps {
  /** Control dialog open state externally */
  open?: boolean;
  /** Callback when dialog open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Whether to show the built-in trigger button (default: true if open/onOpenChange not provided) */
  showButton?: boolean;
}

/**
 * Main Add Tune Dialog
 * Orchestrates the tune import flow with multiple sub-dialogs
 */
export const AddTuneDialog: Component<AddTuneDialogProps> = (props) => {
  const navigate = useNavigate();
  const location = useLocation();
  // NOTE: auth context not currently needed in this dialog (imports are local-only)
  // const auth = useAuth();

  // Main dialog state - use controlled state if provided, otherwise internal state
  const [internalDialogOpen, setInternalDialogOpen] = createSignal(false);
  const mainDialogOpen = () => props.open ?? internalDialogOpen();
  const setMainDialogOpen = (open: boolean) => {
    if (props.onOpenChange) {
      props.onOpenChange(open);
    } else {
      setInternalDialogOpen(open);
    }
  };

  const [selectedGenre, setSelectedGenre] = createSignal<string>("ITRAD");
  const [urlOrTitle, setUrlOrTitle] = createSignal<string>("");

  // Sub-dialog states
  const [showTuneSelectDialog, setShowTuneSelectDialog] = createSignal(false);
  const [tuneSearchResults, setTuneSearchResults] = createSignal<
    ITheSessionTuneSummary[]
  >([]);
  const [showSettingSelectDialog, setShowSettingSelectDialog] =
    createSignal(false);
  const [settingOptions, setSettingOptions] = createSignal<SettingOption[]>([]);

  // Import state
  const [isImporting, setIsImporting] = createSignal(false);
  const [importError, setImportError] = createSignal<string | null>(null);

  // Available genres (simplified - could be fetched from DB). Use simple string array for Select
  const genres: string[] = ["ITRAD", "OTIME", "BLUES"];
  const genreNameMap: Record<string, string> = {
    ITRAD: "Irish Traditional Music",
    OTIME: "Old Time",
    BLUES: "Blues",
  };

  /**
   * Handle "New" button - navigate to tune editor with optional title
   */
  const handleNew = () => {
    const title = urlOrTitle();
    const isUrl = title.startsWith("http://") || title.startsWith("https://");
    const fullPath = location.pathname + location.search;

    if (isUrl) {
      // Clear URL if user wants to create new tune manually
      navigate("/tunes/new", { state: { from: fullPath } });
    } else {
      // Pass title as query param
      const params = title ? `?title=${encodeURIComponent(title)}` : "";
      navigate(`/tunes/new${params}`, { state: { from: fullPath } });
    }

    setMainDialogOpen(false);
  };

  /**
   * Handle "Search" or "Import" button
   */
  const handleSearchOrImport = async () => {
    const input = urlOrTitle();
    if (!input) {
      setImportError("Please enter a URL or title");
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      if (input.startsWith("https://thesession.org")) {
        // Direct URL import
        await importFromTheSessionURL(input);
      } else if (input.startsWith("https://www.irishtune.info")) {
        // IrishTune.info not implemented in this minimal version
        setImportError("IrishTune.info import not yet implemented");
      } else {
        // Title search
        await searchTheSessionByTitle(input);
      }
    } catch (error) {
      console.error("Import error:", error);
      setImportError(error instanceof Error ? error.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  /**
   * Search TheSession.org by title
   */
  const searchTheSessionByTitle = async (title: string) => {
    const results = await fetchTheSessionURLsFromTitle(title, "");

    if (results.total === 0) {
      setImportError(`No tunes found for "${title}"`);
      return;
    }

    if (results.total === 1) {
      // Single result - import directly
      await importFromTheSessionURL(results.tunes[0].url);
    } else {
      // Multiple results - show selection dialog
      const summaries: ITheSessionTuneSummary[] = results.tunes.map((tune) => ({
        name: tune.name,
        url: tune.url,
        type: tune.type,
      }));
      setTuneSearchResults(summaries);
      setShowTuneSelectDialog(true);
    }
  };

  /**
   * Import tune from TheSession.org URL
   */
  const importFromTheSessionURL = async (url: string) => {
    const tuneData = await fetchTuneInfoFromTheSessionURL(url);

    if (tuneData.settings.length === 0) {
      throw new Error("No settings found for this tune");
    }

    const selectedSettingIndex = 0;

    if (tuneData.settings.length > 1) {
      // Multiple settings - let user choose
      const settings: SettingOption[] = tuneData.settings.map((s) => ({
        abc: s.abc,
        id: s.id,
      }));
      setSettingOptions(settings);
      setShowSettingSelectDialog(true);
      // Wait for user to select (handled by onSettingSelect callback)
      return;
    }

    // Single setting or setting selected - proceed with import
    await createTuneFromTheSessionData(tuneData, selectedSettingIndex, url);
  };

  /**
   * Create tune from TheSession data
   */
  const createTuneFromTheSessionData = async (
    tuneData: any,
    settingIndex: number,
    sourceUrl: string
  ) => {
    try {
      const setting = tuneData.settings[settingIndex];
      const tuneParsed = abcjs.parseOnly(setting.abc);
      const barsPerSection = getBarsPerSection(tuneData.type);
      const { incipit, structure } = extractIncipitFromTheSessionJson(
        tuneParsed,
        setting.abc,
        4,
        barsPerSection
      );

      // Navigate to tune editor with imported data as query params
      const params = new URLSearchParams({
        title: tuneData.name,
        type: normalizeTuneType(tuneData.type),
        mode: normalizeKey(setting.key),
        structure: structure,
        incipit: incipit,
        genre: selectedGenre(),
        sourceUrl: sourceUrl,
      });

      const fullPath = location.pathname + location.search;
      navigate(`/tunes/new?${params.toString()}`, {
        state: { from: fullPath },
      });
      setMainDialogOpen(false);
    } catch (error) {
      console.error("Error creating tune:", error);
      setImportError("Failed to create tune from imported data");
    }
  };

  /**
   * Handle tune selection from SelectTuneDialog
   */
  const handleTuneSelect = (url: string | null) => {
    if (url) {
      importFromTheSessionURL(url);
    }
  };

  /**
   * Handle setting selection from SelectSettingDialog
   */
  const handleSettingSelect = async (settingIndex: number) => {
    // This is a simplified version - in full implementation, we'd need to
    // store the tune data and use it here
    console.log("Setting selected:", settingIndex);
    // TODO: Complete the import with selected setting
  };

  return (
    <>
      <AlertDialog open={mainDialogOpen()} onOpenChange={setMainDialogOpen}>
        <Show
          when={
            props.showButton !== false && !props.open && !props.onOpenChange
          }
        >
          <AlertDialogTrigger
            as={Button}
            variant="outline"
            class="flex items-center gap-2"
          >
            Add Tune
            <Import class="h-4 w-4" />
          </AlertDialogTrigger>
        </Show>

        <AlertDialogContent class="max-w-3xl bg-gray-900 dark:bg-gray-900">
          <AlertDialogCloseButton />
          <AlertDialogHeader>
            <AlertDialogTitle>Add Tune</AlertDialogTitle>
            <AlertDialogDescription>
              Add or Import a tune.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Genre Selection */}
          <div class="grid grid-cols-4 items-center gap-4">
            <label for="genre-select" class="text-right font-medium text-sm">
              Select Genre:
            </label>
            <div class="col-span-3">
              <Select
                id="genre-select"
                value={selectedGenre()}
                onChange={setSelectedGenre}
                options={genres}
                placeholder="Select genre..."
                itemComponent={(props) => (
                  <SelectItem item={props.item}>
                    {genreNameMap[props.item.rawValue] || props.item.rawValue}
                  </SelectItem>
                )}
              >
                <SelectTrigger>
                  <SelectValue<string>>
                    {(state) =>
                      genreNameMap[state.selectedOption() || ""] ||
                      "Select genre..."
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent />
              </Select>
            </div>
          </div>

          {/* Import Site Information (for ITRAD only) */}
          <Show when={selectedGenre() === "ITRAD"}>
            <div class="text-sm text-muted-foreground space-y-2">
              <p>
                You can import a tune from a URL or search for a tune by title.
                At this time, only tunes from the following sites can be
                imported:
              </p>
              <table class="w-full text-sm border-collapse">
                <thead>
                  <tr class="border-b">
                    <th class="text-left p-2">#</th>
                    <th class="text-left p-2">Site</th>
                    <th class="text-left p-2">URL</th>
                    <th class="text-left p-2">Type</th>
                    <th class="text-left p-2">Genre</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="border-b">
                    <td class="p-2">1</td>
                    <td class="p-2">irishtune.info</td>
                    <td class="p-2">
                      <a
                        href="https://www.irishtune.info/"
                        target="_blank"
                        rel="noreferrer"
                        class="text-blue-600 hover:underline"
                      >
                        https://www.irishtune.info/
                      </a>
                    </td>
                    <td class="p-2">Individual Tune Only</td>
                    <td class="p-2">ITRAD</td>
                  </tr>
                  <tr>
                    <td class="p-2">2</td>
                    <td class="p-2">The Session</td>
                    <td class="p-2">
                      <a
                        href="https://thesession.org/"
                        target="_blank"
                        rel="noreferrer"
                        class="text-blue-600 hover:underline"
                      >
                        https://thesession.org/
                      </a>
                    </td>
                    <td class="p-2">Individual Tune Only</td>
                    <td class="p-2">ITRAD</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Show>

          <Show when={selectedGenre() !== "ITRAD"}>
            <p class="text-sm text-muted-foreground">
              No import sites implemented for this Genre.
            </p>
          </Show>

          {/* URL or Title Input */}
          <div class="grid grid-cols-4 items-center gap-4">
            <label for="url-or-title" class="text-right font-medium text-sm">
              URL or Title:
            </label>
            <input
              id="url-or-title"
              type="text"
              value={urlOrTitle()}
              onInput={(e) => setUrlOrTitle(e.currentTarget.value)}
              placeholder="Enter URL or tune title..."
              class="col-span-3 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              data-testid="addtune-url-or-title-input"
            />
          </div>

          {/* Error Message */}
          <Show when={importError()}>
            <div class="text-sm text-red-600 dark:text-red-400">
              {importError()}
            </div>
          </Show>

          <AlertDialogFooter>
            <Button variant="outline" onClick={handleNew}>
              New
            </Button>
            <Button
              onClick={handleSearchOrImport}
              disabled={
                !urlOrTitle() || selectedGenre() !== "ITRAD" || isImporting()
              }
            >
              {isImporting()
                ? "Importing..."
                : urlOrTitle().startsWith("https://")
                  ? "Import"
                  : "Search"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sub-dialogs */}
      <SelectTuneDialog
        open={showTuneSelectDialog()}
        onOpenChange={setShowTuneSelectDialog}
        tunes={tuneSearchResults()}
        onTuneSelect={handleTuneSelect}
      />

      <SelectSettingDialog
        open={showSettingSelectDialog()}
        onOpenChange={setShowSettingSelectDialog}
        settings={settingOptions()}
        onSettingSelect={handleSettingSelect}
      />
    </>
  );
};
