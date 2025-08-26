import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  transformToDatetimeLocalForInput,
  transformToDatetimeUtcForDB,
} from "@/lib/date-utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { ScrollArea } from "@radix-ui/themes";
import { Save, XCircle, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { ERROR_PLAYLIST_TUNE } from "../mocks";
import {
  createPlaylistTuneAction,
  createPracticeRecordAction,
  deleteTuneAction,
  getAllGenresAction,
  getPlaylistByIdAction,
  getPlaylistTuneOverviewAction,
  getTuneTypesByGenreAction,
  updatePlaylistTunesAction,
  updatePracticeRecordAction,
  updateTuneInPlaylistFromTuneOverviewAction,
} from "../actions/practice-actions";
import { updateCurrentTuneInDb } from "../settings";
import type {
  IGenre,
  IPlaylistTune,
  IPracticeRecord,
  ITuneOverview,
  ITuneType,
} from "../types";
import { useTune } from "./CurrentTuneContext";
import { useImportUrl } from "./ImportContext";
import { useMainPaneView } from "./MainPaneViewContext";
import { tabIdToPurpose, useTabsState } from "./TabsStateContext";
import { useTuneDataRefresh } from "./TuneDataRefreshContext";
import "./TuneEditor.css"; // Import the CSS file
import { useRepertoireTunes } from "./TunesContextRepertoire";

// Define the valid modes
const validModes = new Set([
  "maj",
  "min",
  "mix",
  "dor",
  "phr",
  "lyd",
  "loc",
  "aeo",
  "ion",
  "none",
]);

// Custom validation function for the key field
const keyValidation = z.string().refine(
  (key) => {
    // Regular expression to match the key signature and mode
    const regex =
      /^([A-Ga-g][#b]?)(\s*(maj|min|mix|dor|phr|lyd|loc|aeo|ion|none|major|minor|mixolydian|dorian|phrygian|lydian|locrian|aeolian|ionian)?)?$/i;
    const match = key.match(regex);

    if (!match) {
      return false;
    }

    const mode = match[2]?.trim().toLowerCase().slice(0, 3) || "maj";

    // Check if the mode is valid
    return validModes.has(mode);
  },
  {
    message:
      "Invalid key format. Expected format: K:<key signature><optional sharp/flat><optional mode>",
  },
);

const formSchema = z.object({
  id: z.number().optional(),
  title: z.string().optional(),
  type: z.string().nullable().optional(),
  structure: z.string().nullable().optional(),
  mode: keyValidation.nullable().optional(),
  incipit: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
  learned: z.string().nullable().optional(), // playlist_tune.learned
  latest_practiced: z.string().nullable().optional(), // practice_record.practiced
  latest_quality: z.number().int().nullable().optional(), // practice_record.quality
  latest_easiness: z.number().nullable().optional(), // practice_record.easiness
  latest_difficulty: z.number().nullable().optional(), // practice_record.difficulty
  latest_stability: z.number().nullable().optional(), // practice_record.stability (FSRS)
  latest_interval: z.number().nullable().optional(), // practice_record.interval
  latest_step: z.number().nullable().optional(), // practice_record.step
  latest_repetitions: z.number().nullable().optional(), // practice_record.repetitions
  latest_state: z.number().int().nullable().optional(), // practice_record.state (FSRS)
  review_date: z.string().nullable().optional(), // practice_record.review_date
  backup_practiced: z.string().nullable().optional(), // practice_record.review_date
  note_private: z.string().nullable().optional(), // not used
  note_public: z.string().nullable().optional(), // not used
  tags: z.string().nullable().optional(),
  user_ref: z.number().nullable().optional(),
  playlist_ref: z.number().nullable().optional(),
  request_public: z.boolean().optional(),
  import_url: z.string().optional(),
  display_public_fields: z.boolean().optional(),
});

interface ITuneEditorProps {
  userId: number;
  playlistId: number;
  tuneId: number;
}

export default function TuneEditor({
  userId,
  playlistId,
  tuneId,
}: ITuneEditorProps) {
  const { toast } = useToast();

  const handleError = useCallback(
    (message: string) => {
      toast({
        title: "Error",
        description: message,
      });
    },
    [toast],
  );

  // const squishFactorY = 0.75;
  const mainElement = document.querySelector("#main-content");
  if (!mainElement) {
    return <div>Missing main element</div>;
  }
  if (!tuneId) {
    return <div>Missing tune ID</div>;
  }
  // const origBoundingClientRect = mainElement.getBoundingClientRect();
  // const headerFooterHeight = window.innerHeight - origBoundingClientRect.height;
  // const buttonsHeightSortOf = headerFooterHeight / 2;
  // const [height, setHeight] = useState(origBoundingClientRect.height);
  const { triggerRefresh } = useTuneDataRefresh();
  const { setCurrentView } = useMainPaneView();
  const { importUrl, setImportUrl } = useImportUrl();
  const [publicMode, setPublicMode] = useState<boolean>(false);
  // Algorithm preference still controls which section opens by default
  const [fsrsOpen, setFsrsOpen] = useState<boolean>(true);
  const [sm2Open, setSm2Open] = useState<boolean>(false);

  // Track original practice record values to detect changes
  const [originalPracticeData, setOriginalPracticeData] = useState<{
    practiced?: string | null;
    quality?: number | null;
    easiness?: number | null;
    difficulty?: number | null;
    stability?: number | null;
    interval?: number | null;
    step?: number | null;
    repetitions?: number | null;
    review_date?: string | null;
    backup_practiced?: string | null;
    state?: number | null;
  } | null>(null);

  const { tunes: repertoireTunes } = useRepertoireTunes();

  const isTuneInRepertoire = (tuneId: number): boolean => {
    return repertoireTunes.some((tune) => tune.id === tuneId);
  };

  // useEffect(() => {
  //   // const mainElement = document.querySelector("#main-content");

  //   const handleResize = () => {
  //     if (mainElement) {
  //       setHeight(window.innerHeight - headerFooterHeight);
  //       // setHeight(mainElement.clientHeight);
  //       // const rect = mainElement.getBoundingClientRect();
  //       // setHeight(rect.height);
  //     }
  //   };

  //   if (mainElement) {
  //     setHeight(window.innerHeight - headerFooterHeight);
  //     // setHeight(mainElement.clientHeight);
  //     // const rect = mainElement.getBoundingClientRect();
  //     // setHeight(rect.height);
  //   }

  //   window.addEventListener("resize", handleResize);
  //   return () => {
  //     window.removeEventListener("resize", handleResize);
  //   };
  // }, [headerFooterHeight, mainElement]);

  const [tune, setTune] = useState<ITuneOverview | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {},
  });
  const {
    // control,
    // handleSubmit,
    formState: { errors },
  } = form;

  const [genres, setGenres] = useState<IGenre[]>([]);
  const [isGenresLoading, setIsGenresLoading] = useState(true);

  const { activeTab } = useTabsState();
  const { setCurrentTune } = useTune();

  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const genresData = await getAllGenresAction();
        if (Array.isArray(genresData)) {
          setGenres(genresData);
        } else {
          console.error("Error fetching genres:", genresData);
        }
      } catch (error) {
        console.error("Error fetching genres:", error);
      } finally {
        setIsGenresLoading(false);
      }
    };

    void fetchGenres();
  }, []);

  // Load playlist to determine algorithm preference for default collapsible state
  useEffect(() => {
    const loadPlaylistAlg = async () => {
      try {
        const playlist = await getPlaylistByIdAction(playlistId);
        if ("detail" in playlist) return;
        const alg = (playlist.sr_alg_type || "FSRS").toUpperCase();
        if (alg.includes("SM2")) {
          setSm2Open(true);
          setFsrsOpen(false);
        } else {
          setFsrsOpen(true);
          setSm2Open(false);
        }
      } catch {
        // default already set
      }
    };
    void loadPlaylistAlg();
  }, [playlistId]);

  // Prefer latest technique from practice record to decide which collapsible is open
  useEffect(() => {
    const tech = tune?.latest_technique?.toUpperCase();
    if (!tech) return;
    if (tech.includes("SM2")) {
      setSm2Open(true);
      setFsrsOpen(false);
    } else if (tech.includes("FSRS")) {
      setFsrsOpen(true);
      setSm2Open(false);
    }
  }, [tune?.latest_technique]);

  const [tuneTypeList, setTuneTypeList] = useState<ITuneType[]>([]);

  useEffect(() => {
    const fetchTune = () => {
      getPlaylistTuneOverviewAction(userId, playlistId, tuneId)
        .then((tuneData: ITuneOverview | { detail: string }) => {
          if (tuneData && (tuneData as ITuneOverview).id !== undefined) {
            const tuneOverview = tuneData as ITuneOverview;
            setTune(tuneOverview);
            if (tuneOverview.genre) {
              getTuneTypesByGenreAction(tuneOverview.genre)
                .then((types) => {
                  setTuneTypeList(types);
                })
                .catch((error) => {
                  const errorMessage = `Error fetching tune types for genre ${tuneOverview.genre}: ${error}`;
                  console.log(errorMessage);
                  handleError(errorMessage);
                });
            }
            form.reset({
              ...tuneOverview,
              title: tuneOverview.title ?? undefined,
              type: tuneOverview.type,
              latest_practiced: transformToDatetimeLocalForInput(
                tuneOverview.latest_practiced as string,
              ),
              // Show latest_review_date for now (historical), until playlist-level scheduled editing is wired.
              review_date: transformToDatetimeLocalForInput(
                (tuneOverview.latest_review_date as string) || "",
              ),
              // learned: transformToDatetimeLocal(tuneOverview.learned as string),
              latest_stability: tuneOverview.latest_stability ?? null,
              latest_state: tuneOverview.latest_state ?? null,
            });

            // Store original practice record values for change detection
            // Store the original UTC values for datetime fields for accurate comparison
            setOriginalPracticeData({
              practiced: tuneOverview.latest_practiced, // Store original UTC format
              quality: tuneOverview.latest_quality,
              easiness: tuneOverview.latest_easiness,
              difficulty: tuneOverview.latest_difficulty,
              stability: tuneOverview.latest_stability ?? null,
              interval: tuneOverview.latest_interval,
              step: tuneOverview.latest_step,
              repetitions: tuneOverview.latest_repetitions,
              review_date: tuneOverview.latest_review_date, // Historical review date from practice_record
              backup_practiced: tuneOverview.latest_backup_practiced,
              state: tuneOverview.latest_state ?? null,
            });
          } else {
            console.error(
              `Failed to fetch tune: ${userId} ${playlistId} ${tuneId}`,
            );
            setTune(ERROR_PLAYLIST_TUNE);
          }
        })
        .catch((error) => {
          console.error(
            `Error fetching tune (${userId} ${playlistId} ${tuneId}): ${error}`,
          );
          setTune(ERROR_PLAYLIST_TUNE);
        });
    };

    void fetchTune();
  }, [userId, playlistId, tuneId, form, handleError]);

  const { triggerCurrentTuneUpdate } = useTune();

  /**
   * Saves the playlist fields from the data by updating or creating a playlist tune.
   *
   * @param data - The data to be saved, inferred from the form schema.
   * @returns A promise that resolves to a boolean indicating whether there was an error.
   */
  async function savePlaylistPart(
    data: z.infer<typeof formSchema>,
  ): Promise<boolean> {
    const playlistTune: Partial<IPlaylistTune> = {
      learned: data.learned ?? "",
    };
    const responsePlaylistUpdate = await updatePlaylistTunesAction(
      [tuneId],
      playlistId,
      playlistTune,
    );
    if ("detail" in responsePlaylistUpdate) {
      console.log("Failed to update tune:", responsePlaylistUpdate.detail);
      const playlistTune2: IPlaylistTune = {
        tune_ref: tuneId,
        playlist_ref: playlistId,
        current: data.latest_practiced ?? "T", // for now
        learned: data.learned ?? "",
        deleted: false,
      };
      const responsePlaylistUpdate2 =
        await createPlaylistTuneAction(playlistTune2);
      if ("detail" in responsePlaylistUpdate2) {
        console.error("Failed to update tune:", responsePlaylistUpdate2.detail);
        handleError(
          `Failed to update tune: ${typeof responsePlaylistUpdate2.detail === "string" ? responsePlaylistUpdate2.detail : "Unknown error"}`,
        );
        // Don't close the editor on error
        return true;
      }
    }
    return false;
  }

  /**
   * Saves the practice record part of the data by updating the latest practice record.
   * If updating the latest practice record fails (404 - no record exists),
   * it attempts to create a new practice record.
   *
   * @param data - The data to be saved, inferred from the form schema.
   * @returns A promise that resolves to a boolean indicating whether an error occurred (true) or not (false).
   */
  async function savePracticeRecordPart(
    data: z.infer<typeof formSchema>,
  ): Promise<boolean> {
    const practiceRecord: Partial<IPracticeRecord> = {
      practiced: data.latest_practiced ?? "",
      quality: data.latest_quality ?? 0,
      easiness: data.latest_easiness ?? 0,
      difficulty: data.latest_difficulty ?? 0,
      stability: data.latest_stability ?? 0,
      interval: data.latest_interval ?? 0,
      step: data.latest_step ?? 0,
      repetitions: data.latest_repetitions ?? 0,
      review_date: data.review_date ?? "",
      state: data.latest_state ?? undefined,
      // tags: z.string().nullable().optional(),
    };

    // Try to update the latest practice record first
    const responsePracticeRecordUpdate = await updatePracticeRecordAction(
      tuneId,
      playlistId,
      practiceRecord,
    );
    if ("detail" in responsePracticeRecordUpdate) {
      console.log(
        "Failed to update latest practice record:",
        responsePracticeRecordUpdate.detail,
      );
      // If update failed (likely 404 - no record exists), create a new one
      const practiceRecord2: Partial<IPracticeRecord> = {
        tune_ref: tuneId,
        playlist_ref: playlistId,
        practiced: data.latest_practiced ?? "",
        quality: data.latest_quality ?? 0,
        easiness: data.latest_easiness ?? 0,
        difficulty: data.latest_difficulty ?? 0,
        stability: data.latest_stability ?? 0,
        interval: data.latest_interval ?? 0,
        step: data.latest_step ?? 0,
        repetitions: data.latest_repetitions ?? 0,
        review_date: data.review_date ?? "",
        state: data.latest_state ?? undefined,
      };
      const responsePracticeRecordUpdate2 = await createPracticeRecordAction(
        tuneId,
        playlistId,
        practiceRecord2,
      );
      if ("detail" in responsePracticeRecordUpdate2) {
        console.error(
          "Failed to create practice record:",
          responsePracticeRecordUpdate2.detail,
        );
        handleError(
          `Failed to create practice record: ${typeof responsePracticeRecordUpdate2.detail === "string" ? responsePracticeRecordUpdate2.detail : "Unknown error"}`,
        );
        // Don't close the editor on error
        return true;
      }
    }
    return false;
  }

  /**
   * Checks if any practice record fields have changed from their original values.
   *
   * @param currentData - The current form data (with UTC converted datetime fields)
   * @returns true if any practice record fields have changed, false otherwise
   */
  const hasPracticeRecordChanged = (
    currentData: z.infer<typeof formSchema>,
  ): boolean => {
    if (!originalPracticeData) {
      return false; // No original data to compare against
    }

    // For datetime fields, compare the UTC values (currentData already has UTC conversion)
    // Map form field names to originalPracticeData field names
    const datetimeFieldMappings = [
      {
        formField: "latest_practiced" as const,
        originalField: "practiced" as const,
      },
      {
        formField: "review_date" as const,
        originalField: "review_date" as const,
      },
    ];

    for (const { formField, originalField } of datetimeFieldMappings) {
      const currentUtcValue = currentData[formField];
      const originalUtcValue = originalPracticeData[originalField];

      // Handle null/undefined equivalence
      if ((currentUtcValue === null) !== (originalUtcValue === null)) {
        return true;
      }

      if (currentUtcValue !== originalUtcValue) {
        return true;
      }
    }

    // For non-datetime fields, compare directly
    // Map form field names to originalPracticeData field names
    const nonDatetimeFieldMappings = [
      {
        formField: "latest_quality" as const,
        originalField: "quality" as const,
      },
      {
        formField: "latest_easiness" as const,
        originalField: "easiness" as const,
      },
      {
        formField: "latest_difficulty" as const,
        originalField: "difficulty" as const,
      },
      {
        formField: "latest_stability" as const,
        originalField: "stability" as const,
      },
      {
        formField: "latest_interval" as const,
        originalField: "interval" as const,
      },
      {
        formField: "latest_step" as const,
        originalField: "step" as const,
      },
      {
        formField: "latest_repetitions" as const,
        originalField: "repetitions" as const,
      },
      {
        formField: "backup_practiced" as const,
        originalField: "backup_practiced" as const,
      },
      {
        formField: "latest_state" as const,
        originalField: "state" as const,
      },
    ];

    return nonDatetimeFieldMappings.some(({ formField, originalField }) => {
      const currentValue = currentData[formField];
      const originalValue = originalPracticeData[originalField];

      // Handle null/undefined equivalence
      if ((currentValue === null) !== (originalValue === null)) {
        return true;
      }

      // Compare actual values
      return currentValue !== originalValue;
    });
  };

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    console.log(data);
    // Get the base public tune.  Compare each field.  If it differs,
    //       then add to override object.
    // Is it always an override if not new?  No, I think we need to know if
    // the tune is public.  If it isn't the `private_for` field will be set to
    // the current user's ID.
    //
    // So, given I'm a little squishy on the logic here to figure out
    // when to save as an override, I broke it into
    // some atomic variables.  Hopefully this will make it easier to
    // read the intention?
    const isTuneUserPrivateForUser =
      isTuneUserPrivate() && tune?.private_for === userId;
    const isNewTuneImported = isNewTune() && isTuneImported();
    const saveInMainTuneTable = isTuneUserPrivateForUser || isNewTuneImported;
    const saveAsOverride = !saveInMainTuneTable;
    const practicedUtc = transformToDatetimeUtcForDB(
      data.latest_practiced ?? "",
    );
    const reviewDateUtc = transformToDatetimeUtcForDB(data.review_date ?? "");

    const dataLocal = {
      ...data,
      deleted: false,
      practiced: practicedUtc,
      review_date: reviewDateUtc,
    };

    const result = await updateTuneInPlaylistFromTuneOverviewAction(
      userId,
      playlistId,
      tuneId,
      saveAsOverride,
      dataLocal,
    );

    if ("detail" in result) {
      console.error("Failed to update tune:", result.detail);
      handleError(
        `Failed to update tune: ${typeof result.detail === "string" ? result.detail : "Unknown error"}`,
      );
      // Don't close the editor on error
      return;
    }
    console.log("Tune updated successfully");

    if (isTuneInRepertoire(tuneId) === true) {
      console.log("Saving user specific data");

      const errorOccured = await savePlaylistPart(dataLocal);
      if (errorOccured) {
        // Don't close the editor on error
        return;
      }

      // Only save practice record if the practice fields have actually changed
      if (hasPracticeRecordChanged(dataLocal)) {
        console.log("Practice record fields have changed, saving...");
        const errorOccured2 = await savePracticeRecordPart(dataLocal);
        if (errorOccured2) {
          // Don't close the editor on error
          return;
        }
      } else {
        console.log("Practice record fields unchanged, skipping save");
      }

      // TODO: Save tags
      // tags: z.string().nullable().optional(),
    }
    setCurrentTune(tuneId);

    const purpose = tabIdToPurpose(activeTab);
    void updateCurrentTuneInDb(userId, "full", purpose, playlistId, tuneId);

    triggerRefresh();
    setImportUrl(null);
    setCurrentView("tabs");
    triggerCurrentTuneUpdate();
  };

  const handleCancel = useCallback(async () => {
    // tune.deleted = true indicates this is a new tune, so it's
    // safe and proper to delete on cancel.
    if (tune?.deleted === true) {
      const response = await deleteTuneAction(tuneId);
      if (response && "detail" in response) {
        console.error("Failed to delete tune:", response.detail);
        handleError(`Failed to delete tune: ${response.detail}`);
      } else {
        console.log("Tune deleted successfully");
      }
    }
    setImportUrl(null);
    setCurrentView("tabs");
  }, [tune?.deleted, tuneId, handleError, setImportUrl, setCurrentView]);

  // Escape-to-cancel handler
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void handleCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleCancel]);

  if (isGenresLoading) {
    return <div>Loading...</div>;
  }

  if (!tune) {
    return <div>Loading...</div>;
  }

  // Tune state functions
  function isNewTune(): boolean {
    return tune?.deleted === true;
  }

  function isTuneInUsersRepertoire(): boolean {
    return isTuneInRepertoire(tune?.id ?? -987) === true;
  }

  function isTuneUserPrivate(): boolean {
    return (
      tune?.private_for !== null &&
      tune?.private_for !== undefined &&
      tune.private_for > 0
    );
  }

  function isTuneImported(): boolean {
    return importUrl !== null;
  }

  const handlePublicModeChange = (checked: boolean) => {
    setPublicMode(checked);
  };

  function isTuneOverride(): boolean {
    return !isNewTune() && !isTuneUserPrivate();
  }

  function getEditorInstructions(): string {
    let instructions = "";

    function baseNewTuneInstructions(tuneVsChanges: string): string {
      return `
      You may check the "Request Public" box to
      request that the ${tuneVsChanges} be made public by the administrator. If there are issues,
      the administrator may contact you for resolution. Once the administrator agrees, the
      ${tuneVsChanges} will be made public and available to all users.
    `;
    }
    const privateByDefaultText = "This tune will be user-private by default.";
    const publicTuneText = `
      Imported tunes are public to reduce duplication, and all edits here 
      will be for the public record.
    `;

    if (isNewTune()) {
      instructions = isTuneImported()
        ? `
          Please check the values imported from ${importUrl} for correctness.
          ${publicTuneText}
        `
        : `
          You are editing a new tune from scratch.
          ${privateByDefaultText}
          ${baseNewTuneInstructions("tune")}
        `;
    } else if (isTuneUserPrivate()) {
      instructions = `
      You are editing a tune that has not been marked as shared public, so changes
      will be made directly to the tune record.
      ${baseNewTuneInstructions("tune")}
    `;
    } else {
      instructions = `
      You are editing a tune that is shared public. Edits made here
      to the core tune data will be private overrides and will not affect the global tune data.
      ${baseNewTuneInstructions("changes")}
    `;
    }

    return instructions;
  }

  // Collapsible toggle chevron rotations
  const sm2ChevronRotation = sm2Open ? "rotate(90deg)" : "rotate(0deg)";
  const fsrsChevronRotation = fsrsOpen ? "rotate(90deg)" : "rotate(0deg)";

  const onGenreChange = async (
    e: React.ChangeEvent<HTMLSelectElement>,
    field: { onChange: (value: string) => void },
  ) => {
    const genreId = e.target.value;
    field.onChange(genreId);

    try {
      const types = await getTuneTypesByGenreAction(genreId);
      setTuneTypeList(types);
    } catch (error) {
      const errorMessage = `Error fetching tune types for genre ${genreId}: ${String(error)}`;
      console.log(errorMessage);
      handleError(errorMessage);
    }
  };

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex items-center justify-between space-x-2 w-3/5">
        <h1 className="text-2xl font-bold ml-4 mb-0">Tune #{tune.id}</h1>
        <div className="flex items-center space-x-4">
          <Label
            aria-disabled={!isTuneOverride()}
            className={!isTuneOverride() ? "text-gray-600" : ""}
          >
            Show Public
          </Label>
          <Switch
            checked={publicMode}
            onCheckedChange={handlePublicModeChange}
            disabled={!isTuneOverride()}
          />
        </div>
        <div className="flex space-x-12">
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            aria-label="Save edits"
            className="p-0 h-auto cursor-pointer"
            title="Save edits"
            onClick={() => {
              const formElement = document.querySelector(
                '[data-testid="tt-tune-editor-form"]',
              ) as HTMLFormElement;
              if (formElement) {
                formElement.requestSubmit();
              }
            }}
            data-testid="tt-tune-editor-submit-button"
          >
            <div className="flex items-end space-x-1">
              Submit
              <Save className="h-4 w-4 ml-2 mr-4 relative -top-0.5" />
            </div>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              handleCancel()
                .then(() => console.log("Cancelled"))
                .catch((error) => console.error("Error cancelling:", error));
            }}
            aria-label="Cancel edits"
            className="p-0 h-auto cursor-pointer"
            title="Cancel edits"
            data-testid="tt-tune-editor-cancel-button"
          >
            <div className="flex items-end space-x-1">
              Cancel
              <XCircle className="h-4 w-4 ml-2 mr-4 relative -top-0.5" />
            </div>
          </Button>
        </div>
      </div>
      <ScrollArea
        className="flex-grow w-full rounded-md border p-4"
        style={{
          height: "calc(100vh - 120px)", // Set a specific height
          overflow: "hidden", // Ensure the container doesn't scroll
        }}
        aria-label="Tune Editor scrollable region"
      >
        {tune.has_staged ? (
          <Alert data-testid="tt-tune-editor-staged-warning" className="mb-4">
            <AlertTitle>Staged changes present</AlertTitle>
            <AlertDescription>
              Only committed values are editable and visible; staged values are
              not.
            </AlertDescription>
          </Alert>
        ) : null}
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit(onSubmit)(e);
            }}
            className="flex flex-col w-full space-y-4"
            // style={{ height: `${height}px`, overflowY: "unset" }}
            data-testid="tt-tune-editor-form"
          >
            <div className="flex flex-col gap-2">
              <div className="items-center my-0 tune-form-item-style w-3/5">
                <hr className="flex-grow border-t border-gray-300" />
                <span className="px-4 text-gray-500">Core Tune Data</span>
                <hr className="flex-grow border-t border-gray-300" />
              </div>
              {/* how can we test for new tune edit here, vs edit exising? */}
              {/* Is the tune private? */}
              {/* Is the tune new? */}
              {/* is the tune in the user's repertoire? */}
              <div className="items-center my-2 w-3/5 text-gray-400 italic">
                {getEditorInstructions()}
              </div>

              {/* Ok, now I need:
              1. a "Request Public" checkbox.
              2. a read-only import url (if importUrl is set)
              3. a switch that shows read-only public fields, if private_for is set */}

              {/* Some subsequent fields may rely on the value of genre, so
              it should come first. */}
              <FormField
                control={form.control}
                name="genre"
                render={({ field }) => (
                  <FormItem
                    className="tune-form-item-style"
                    data-testid="tt-tune-editor-genre"
                  >
                    <FormLabel className="tune-form-label-style">
                      Genre:{" "}
                    </FormLabel>

                    <FormControl className="tune-form-control-style">
                      {/* <<Input {...field} value={field.value || ""} />> */}
                      <select
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => void onGenreChange(e, field)}
                        className="tune-form-control-style px-2"
                      >
                        <option value="">Select genre</option>
                        {genres.map((genre) => (
                          <option key={genre.id} value={genre.id}>
                            {genre.name}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem
                    className="tune-form-item-style"
                    data-testid="tt-tune-editor-title"
                  >
                    <FormLabel className="tune-form-label-style">
                      Title:{" "}
                    </FormLabel>

                    <FormControl className="tune-form-control-style">
                      <Input
                        {...field}
                        value={field.value || ""}
                        data-testid="tt-tune-editor-title-input"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem
                    className="tune-form-item-style"
                    data-testid="tt-tune-editor-type"
                  >
                    <FormLabel className="tune-form-label-style">
                      Type:{" "}
                    </FormLabel>

                    <FormControl className="tune-form-control-style">
                      <select
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value)}
                        className="tune-form-control-style px-2"
                      >
                        <option value="">Select type</option>
                        {tuneTypeList.map((val) => (
                          <option key={val.id} value={val.id}>
                            {val.name} {val.rhythm ? `(${val.rhythm})` : ""}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="structure"
                render={({ field }) => (
                  <FormItem
                    className="tune-form-item-style"
                    data-testid="tt-tune-editor-structure"
                  >
                    <FormLabel className="tune-form-label-style">
                      Structure:{" "}
                    </FormLabel>

                    <FormControl className="tune-form-control-style">
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* <FormField
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <FormItem
                    className="tune-form-item-style"
                    data-testid="tt-tune-editor-mode"
                  >
                    <FormLabel className="tune-form-label-style">
                      Mode:{" "}
                    </FormLabel>

                    <FormControl className="tune-form-control-style">
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              /> */}
              <FormField
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <FormItem
                    className="tune-form-item-style"
                    data-testid="tt-tune-editor-mode"
                  >
                    <FormLabel className="tune-form-label-style">
                      Mode:{" "}
                    </FormLabel>

                    <FormControl className="tune-form-control-style">
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                    {errors.mode && (
                      <p className="error-message">{errors.mode.message}</p>
                    )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="incipit"
                render={({ field }) => (
                  <FormItem
                    className="tune-form-item-style"
                    data-testid="tt-tune-editor-incipit"
                  >
                    <FormLabel className="tune-form-label-style">
                      Incipit:{" "}
                    </FormLabel>

                    <FormControl className="tune-form-control-style">
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="request_public"
                render={({ field }) => (
                  <FormItem
                    className="tune-form-item-style  pt-2"
                    data-testid="tt-tune-editor-request-public"
                  >
                    <FormLabel className="tune-form-label-style">
                      Request Public:
                    </FormLabel>
                    <FormControl
                    // className="tune-form-control-style"
                    >
                      <Checkbox
                        checked={field.value || false}
                        onCheckedChange={(checked) => field.onChange(checked)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* {importUrl && (
                <FormField
                  control={form.control}
                  name="import_url"
                  render={() => (
                    <FormItem
                      className="tune-form-item-style"
                      data-testid="tt-tune-editor-import-url"
                    >
                      <FormLabel className="tune-form-label-style">
                        Import URL:
                      </FormLabel>
                      <FormControl
                      // className="tune-form-control-style"
                      >
                        <Input value={importUrl} readOnly />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )} */}

              {isTuneInUsersRepertoire() && (
                <>
                  <div className="items-center my-4 tune-form-item-style w-3/5">
                    <hr className="flex-grow border-t border-gray-300" />
                    <span className="px-4 text-gray-500">
                      User/Repertoire Specific Data
                    </span>
                    <hr className="flex-grow border-t border-gray-300" />
                  </div>

                  <FormField
                    control={form.control}
                    name="learned"
                    render={({ field }) => (
                      <FormItem
                        className="tune-form-item-style"
                        data-testid="tt-tune-editor-learned"
                      >
                        <FormLabel className="tune-form-label-style">
                          <em>Learned Date:</em>{" "}
                        </FormLabel>

                        <FormControl className="tune-form-control-style">
                          <Input
                            type="date"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tags"
                    render={({ field }) => (
                      <FormItem
                        className="tune-form-item-style2"
                        data-testid="tt-tune-editor-tags"
                      >
                        <FormLabel className="tune-form-label-style">
                          <em>Tags:</em>{" "}
                        </FormLabel>

                        <FormControl className="tune-form-control-style">
                          <Input {...field} value={field.value || ""} />
                        </FormControl>

                        <FormDescription>
                          Separate tags with commas
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <div className="items-center my-4 tune-form-item-style w-3/5">
                    <hr className="flex-grow border-t border-gray-300" />
                    <span className="px-4 text-gray-500">
                      {`Most Recent Practice Record (${(tune.latest_technique ?? "SM2").toUpperCase()})`}
                    </span>
                    <hr className="flex-grow border-t border-gray-300" />
                  </div>

                  <FormField
                    control={form.control}
                    name="latest_practiced"
                    render={({ field }) => (
                      <FormItem
                        className="tune-form-item-style"
                        data-testid="tt-tune-editor-practiced"
                      >
                        <FormLabel className="tune-form-label-style">
                          <em>Practiced Date:</em>{" "}
                        </FormLabel>

                        <FormControl className="tune-form-control-style">
                          <Input
                            type="datetime-local"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="latest_quality"
                    render={({ field }) => (
                      <FormItem
                        className="tune-form-item-style"
                        data-testid="tt-tune-editor-quality"
                      >
                        <FormLabel className="tune-form-label-style">
                          <em>Quality:</em>{" "}
                        </FormLabel>

                        <FormControl className="tune-form-control-style">
                          <Input
                            type="number"
                            {...field}
                            value={field.value?.toString() || ""}
                            onChange={(e) =>
                              field.onChange(e.target.valueAsNumber)
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {/* SM2 Section: Easiness, Interval */}
                  <Collapsible
                    open={sm2Open}
                    onOpenChange={setSm2Open}
                    data-testid="tt-sm2-section"
                  >
                    <div className="tune-form-item-style my-2">
                      <div className="tune-form-label-style flex items-center justify-end">
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="flex items-center gap-2 bg-transparent px-0 py-0 text-sm font-medium text-foreground hover:opacity-80 focus:outline-none"
                            data-testid="tt-sm2-toggle"
                            aria-expanded={sm2Open}
                          >
                            SM2 Fields
                            <ChevronRight
                              className="h-4 w-4"
                              style={{
                                transform: sm2ChevronRotation,
                                transition: "transform 0.2s ease-in-out",
                              }}
                            />
                          </button>
                        </CollapsibleTrigger>
                      </div>
                      <div className="tune-form-control-style" />
                    </div>
                    <CollapsibleContent>
                      <FormField
                        control={form.control}
                        name="latest_easiness"
                        render={({ field }) => (
                          <FormItem
                            className="tune-form-item-style"
                            data-testid="tt-tune-editor-easiness"
                          >
                            <FormLabel className="tune-form-label-style">
                              <em>Easiness:</em>{" "}
                            </FormLabel>

                            <FormControl className="tune-form-control-style">
                              <Input
                                type="number"
                                {...field}
                                value={field.value?.toString() || ""}
                                onChange={(e) =>
                                  field.onChange(e.target.valueAsNumber)
                                }
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="latest_interval"
                        render={({ field }) => (
                          <FormItem
                            className="tune-form-item-style"
                            data-testid="tt-tune-editor-interval"
                          >
                            <FormLabel className="tune-form-label-style">
                              <em>Interval:</em>{" "}
                            </FormLabel>

                            <FormControl className="tune-form-control-style">
                              <Input
                                type="number"
                                {...field}
                                value={field.value?.toString() || ""}
                                onChange={(e) =>
                                  field.onChange(e.target.valueAsNumber)
                                }
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </CollapsibleContent>
                  </Collapsible>

                  {/* FSRS Section: Difficulty, Stability, Step, State */}
                  <Collapsible
                    open={fsrsOpen}
                    onOpenChange={setFsrsOpen}
                    data-testid="tt-fsrs-section"
                  >
                    <div className="tune-form-item-style my-2">
                      <div className="tune-form-label-style flex items-center justify-end">
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="flex items-center gap-2 bg-transparent px-0 py-0 text-sm font-medium text-foreground hover:opacity-80 focus:outline-none"
                            data-testid="tt-fsrs-toggle"
                            aria-expanded={fsrsOpen}
                          >
                            FSRS Fields
                            <ChevronRight
                              className="h-4 w-4"
                              style={{
                                transform: fsrsChevronRotation,
                                transition: "transform 0.2s ease-in-out",
                              }}
                            />
                          </button>
                        </CollapsibleTrigger>
                      </div>
                      <div className="tune-form-control-style" />
                    </div>
                    <CollapsibleContent>
                      <FormField
                        control={form.control}
                        name="latest_difficulty"
                        render={({ field }) => (
                          <FormItem
                            className="tune-form-item-style"
                            data-testid="tt-tune-editor-difficulty"
                          >
                            <FormLabel className="tune-form-label-style">
                              <em>Difficulty:</em>{" "}
                            </FormLabel>

                            <FormControl className="tune-form-control-style">
                              <Input
                                type="number"
                                {...field}
                                value={field.value?.toString() || ""}
                                onChange={(e) =>
                                  field.onChange(e.target.valueAsNumber)
                                }
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="latest_stability"
                        render={({ field }) => (
                          <FormItem
                            className="tune-form-item-style"
                            data-testid="tt-tune-editor-stability"
                          >
                            <FormLabel className="tune-form-label-style">
                              <em>Stability:</em>{" "}
                            </FormLabel>

                            <FormControl className="tune-form-control-style">
                              <Input
                                type="number"
                                {...field}
                                value={field.value?.toString() || ""}
                                onChange={(e) =>
                                  field.onChange(e.target.valueAsNumber)
                                }
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="latest_step"
                        render={({ field }) => (
                          <FormItem
                            className="tune-form-item-style"
                            data-testid="tt-tune-editor-step"
                          >
                            <FormLabel className="tune-form-label-style">
                              <em>Step:</em>{" "}
                            </FormLabel>

                            <FormControl className="tune-form-control-style">
                              <Input
                                type="number"
                                {...field}
                                value={field.value?.toString() || ""}
                                onChange={(e) =>
                                  field.onChange(e.target.valueAsNumber)
                                }
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="latest_state"
                        render={({ field }) => (
                          <FormItem
                            className="tune-form-item-style"
                            data-testid="tt-tune-editor-state"
                          >
                            <FormLabel className="tune-form-label-style">
                              <em>State:</em>{" "}
                            </FormLabel>

                            <FormControl className="tune-form-control-style">
                              <Input
                                type="number"
                                {...field}
                                value={field.value?.toString() || ""}
                                onChange={(e) =>
                                  field.onChange(e.target.valueAsNumber)
                                }
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </CollapsibleContent>
                  </Collapsible>

                  <FormField
                    control={form.control}
                    name="latest_repetitions"
                    render={({ field }) => (
                      <FormItem
                        className="tune-form-item-style"
                        data-testid="tt-tune-editor-repetitions"
                      >
                        <FormLabel className="tune-form-label-style">
                          <em>Repetitions:</em>{" "}
                        </FormLabel>

                        <FormControl className="tune-form-control-style">
                          <Input
                            type="number"
                            {...field}
                            value={field.value?.toString() || ""}
                            onChange={(e) =>
                              field.onChange(e.target.valueAsNumber)
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="review_date"
                    render={({ field }) => (
                      <FormItem
                        className="tune-form-item-style"
                        data-testid="tt-tune-editor-review_date"
                      >
                        <FormLabel className="tune-form-label-style">
                          <em>Scheduled:</em>{" "}
                        </FormLabel>
                        <div className="flex items-center gap-2 tune-form-control-style">
                          <FormControl className="flex-1">
                            <Input
                              type="datetime-local"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => form.setValue("review_date", null)}
                            data-testid="tt-tune-editor-scheduled-clear"
                            title="Clear scheduled date"
                          >
                            Clear
                          </Button>
                        </div>
                      </FormItem>
                    )}
                  />

                  {/* <FormField
                  control={form.control}
                  name="RecallEval"
                  render={({ field }) => (
                  <FormItem className="tune-form-item-style2" data-testid="tt-tune-editor-recall-eval">
                    <FormLabel className="tune-form-label-style">
                    <em>Recall Evaluation:</em>{" "}
                    </FormLabel>

                    <FormControl className="tune-form-control-style">
                    <Input {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                  )}
                  /> */}
                </>
              )}
            </div>
          </form>
        </Form>
      </ScrollArea>
    </div>
  );
}
