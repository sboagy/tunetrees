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
import { createEffect, createSignal, Show } from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import { getPluginsByCapability } from "@/lib/db/queries/plugins";
import type { Plugin } from "@/lib/db/types";
import { runPluginFunction } from "@/lib/plugins/runtime";
import {
  extractIncipitFromTheSessionJson,
  fetchTheSessionURLsFromTitle,
  fetchTuneInfoFromTheSessionURL,
  getBarsPerSection,
  normalizeKey,
  normalizeTuneType,
} from "../../lib/import/import-utils";
import type {
  ITheSessionTune,
  ITheSessionTuneSummary,
} from "../../lib/import/the-session-schemas";
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
  const { user, localDb } = useAuth();

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
  const [importSource, setImportSource] = createSignal<string>("the-session");
  const [importPlugins, setImportPlugins] = createSignal<Plugin[]>([]);
  const [importPluginError, setImportPluginError] = createSignal<string | null>(
    null
  );

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

  // Pending tune data for multi-setting selection
  const [pendingTheSessionTune, setPendingTheSessionTune] =
    createSignal<ITheSessionTune | null>(null);
  const [pendingTheSessionUrl, setPendingTheSessionUrl] = createSignal<
    string | null
  >(null);

  // Available genres (simplified - could be fetched from DB). Use simple string array for Select
  const genres: string[] = ["ITRAD", "OTIME", "BLUES"];
  const genreNameMap: Record<string, string> = {
    ITRAD: "Irish Traditional Music",
    OTIME: "Old Time",
    BLUES: "Blues",
  };

  const getImportSourceLabel = (value: string) => {
    if (value === "the-session") return "The Session (built-in)";
    if (value.startsWith("plugin:")) {
      const id = value.replace("plugin:", "");
      const plugin = importPlugins().find((row) => row.id === id);
      return plugin ? `${plugin.name} (plugin)` : "Plugin";
    }
    return value;
  };

  const selectedImportPlugin = () => {
    const source = importSource();
    if (!source.startsWith("plugin:")) return null;
    const id = source.replace("plugin:", "");
    return importPlugins().find((row) => row.id === id) ?? null;
  };

  createEffect(() => {
    const currentUser = user();
    const db = localDb();
    if (!currentUser?.id || !db) return;
    getPluginsByCapability(db, currentUser.id, "parseImport", {
      includePublic: true,
      includeDisabled: false,
    })
      .then((plugins) => {
        setImportPlugins(plugins);
        if (plugins.length === 0) {
          setImportSource("the-session");
        }
      })
      .catch((error) => {
        console.error("Failed to load import plugins", error);
        setImportPluginError("Failed to load import plugins");
      });
  });

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
      const plugin = selectedImportPlugin();
      if (plugin) {
        await importFromPlugin(plugin, input);
        return;
      }

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

  interface PluginImportData {
    title: string;
    type?: string;
    mode?: string;
    structure?: string;
    incipit?: string;
    genre?: string;
    composer?: string;
    artist?: string;
    idForeign?: string;
    releaseYear?: number;
    sourceUrl?: string;
  }

  const normalizePluginImportData = (
    value: unknown
  ): PluginImportData | null => {
    if (!value) return null;
    if (Array.isArray(value)) {
      return value.length > 0 ? normalizePluginImportData(value[0]) : null;
    }
    if (typeof value !== "object") return null;

    const record = value as Record<string, unknown>;
    if (Array.isArray(record.tunes)) {
      return record.tunes.length > 0
        ? normalizePluginImportData(record.tunes[0])
        : null;
    }
    if (record.tune && typeof record.tune === "object") {
      return normalizePluginImportData(record.tune as Record<string, unknown>);
    }

    const title = typeof record.title === "string" ? record.title : "";
    if (!title) return null;

    const releaseYearRaw =
      record.releaseYear ?? record.release_year ?? record.release_years;
    const releaseYear =
      typeof releaseYearRaw === "number"
        ? releaseYearRaw
        : typeof releaseYearRaw === "string" && releaseYearRaw.trim() !== ""
          ? Number(releaseYearRaw)
          : undefined;

    return {
      title,
      type: typeof record.type === "string" ? record.type : undefined,
      mode: typeof record.mode === "string" ? record.mode : undefined,
      structure:
        typeof record.structure === "string" ? record.structure : undefined,
      incipit: typeof record.incipit === "string" ? record.incipit : undefined,
      genre: typeof record.genre === "string" ? record.genre : undefined,
      composer:
        typeof record.composer === "string" ? record.composer : undefined,
      artist: typeof record.artist === "string" ? record.artist : undefined,
      idForeign:
        typeof record.idForeign === "string"
          ? record.idForeign
          : typeof record.id_foreign === "string"
            ? record.id_foreign
            : undefined,
      releaseYear:
        releaseYear && Number.isFinite(releaseYear) ? releaseYear : undefined,
      sourceUrl:
        typeof record.sourceUrl === "string"
          ? record.sourceUrl
          : typeof record.source_url === "string"
            ? record.source_url
            : typeof record.url === "string"
              ? record.url
              : undefined,
    };
  };

  const importFromPlugin = async (plugin: Plugin, input: string) => {
    const fullPath = location.pathname + location.search;
    const payload = {
      input,
      genre: selectedGenre(),
      isUrl: input.startsWith("http://") || input.startsWith("https://"),
    };

    const result = await runPluginFunction({
      script: plugin.script,
      functionName: "parseImport",
      payload,
      meta: {
        pluginId: plugin.id,
        pluginName: plugin.name,
      },
      timeoutMs: 30000,
    });

    const normalized = normalizePluginImportData(result);
    if (!normalized) {
      throw new Error("Plugin did not return valid tune data");
    }

    const params = new URLSearchParams({
      title: normalized.title,
      type: normalized.type ?? "",
      mode: normalized.mode ?? "",
      structure: normalized.structure ?? "",
      incipit: normalized.incipit ?? "",
      genre: normalized.genre ?? selectedGenre(),
      composer: normalized.composer ?? "",
      artist: normalized.artist ?? "",
      idForeign: normalized.idForeign ?? "",
      releaseYear:
        normalized.releaseYear !== undefined
          ? String(normalized.releaseYear)
          : "",
      sourceUrl: normalized.sourceUrl ?? input,
    });

    navigate(`/tunes/new?${params.toString()}`, {
      state: { from: fullPath },
    });
    setMainDialogOpen(false);
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

      // Persist tune data + source URL so selection can complete import
      setPendingTheSessionTune(tuneData);
      setPendingTheSessionUrl(url);

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
    tuneData: ITheSessionTune,
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
      setPendingTheSessionTune(null);
      setPendingTheSessionUrl(null);
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
    const tuneData = pendingTheSessionTune();
    const sourceUrl = pendingTheSessionUrl();

    if (!tuneData || !sourceUrl) {
      setImportError("Unable to complete import: missing tune data");
      return;
    }

    await createTuneFromTheSessionData(tuneData, settingIndex, sourceUrl);
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

        <AlertDialogContent
          class="max-w-3xl bg-white dark:bg-gray-900"
          data-testid="add-tune-dialog"
        >
          <AlertDialogCloseButton />
          <AlertDialogHeader>
            <AlertDialogTitle>Add Tune</AlertDialogTitle>
            <AlertDialogDescription>
              Add or Import a tune.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Genre Selection */}
          <div class="grid grid-cols-4 items-center gap-4">
            <label
              for="genre-select"
              class="text-right font-medium text-sm text-gray-900 dark:text-gray-100"
            >
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

          <Show when={importPlugins().length > 0}>
            <div class="grid grid-cols-4 items-center gap-4">
              <label
                for="import-source"
                class="text-right font-medium text-sm text-gray-900 dark:text-gray-100"
              >
                Import Source:
              </label>
              <div class="col-span-3">
                <Select
                  id="import-source"
                  value={importSource()}
                  onChange={setImportSource}
                  options={[
                    "the-session",
                    ...importPlugins().map((plugin) => `plugin:${plugin.id}`),
                  ]}
                  itemComponent={(props) => (
                    <SelectItem item={props.item}>
                      {getImportSourceLabel(props.item.rawValue)}
                    </SelectItem>
                  )}
                >
                  <SelectTrigger>
                    <SelectValue<string>>
                      {(state) =>
                        getImportSourceLabel(state.selectedOption() || "")
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent />
                </Select>
              </div>
            </div>
          </Show>

          <Show when={importPluginError()}>
            <p class="text-xs text-red-600" data-testid="import-plugin-error">
              {importPluginError()}
            </p>
          </Show>

          {/* Import Site Information (for ITRAD only) */}
          <Show when={selectedGenre() === "ITRAD"}>
            <div class="text-sm text-gray-700 dark:text-gray-300 space-y-2">
              <p>
                You can import a tune from a URL or search for a tune by title.
                At this time, only tunes from the following sites can be
                imported:
              </p>
              <table class="w-full text-sm border-collapse">
                <thead>
                  <tr class="border-b border-gray-300 dark:border-gray-600">
                    <th class="text-left p-2 text-gray-900 dark:text-gray-100">
                      #
                    </th>
                    <th class="text-left p-2 text-gray-900 dark:text-gray-100">
                      Site
                    </th>
                    <th class="text-left p-2 text-gray-900 dark:text-gray-100">
                      URL
                    </th>
                    <th class="text-left p-2 text-gray-900 dark:text-gray-100">
                      Type
                    </th>
                    <th class="text-left p-2 text-gray-900 dark:text-gray-100">
                      Genre
                    </th>
                  </tr>
                </thead>
                <tbody class="text-gray-700 dark:text-gray-300">
                  <tr class="border-b border-gray-300 dark:border-gray-600">
                    <td class="p-2">1</td>
                    <td class="p-2">irishtune.info</td>
                    <td class="p-2">
                      <a
                        href="https://www.irishtune.info/"
                        target="_blank"
                        rel="noreferrer"
                        class="text-blue-600 dark:text-blue-400 hover:underline"
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
                        class="text-blue-600 dark:text-blue-400 hover:underline"
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
          <Show when={importPlugins().length > 0}>
            <div class="text-sm text-gray-700 dark:text-gray-300">
              <p class="mt-2">
                Plugin importers available:{" "}
                {importPlugins()
                  .map((p) => p.name)
                  .join(", ")}
              </p>
            </div>
          </Show>

          <Show when={selectedGenre() !== "ITRAD"}>
            <p class="text-sm text-gray-700 dark:text-gray-300">
              No import sites implemented for this Genre.
            </p>
          </Show>

          {/* URL or Title Input */}
          <div class="grid grid-cols-4 items-center gap-4">
            <label
              for="url-or-title"
              class="text-right font-medium text-sm text-gray-900 dark:text-gray-100"
            >
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
