import { useGenresList } from "@/components/GenreContext";
import { GenreSelector } from "@/components/GenreSelector";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { normalizeKey, normalizeTuneType } from "@/lib/abc-utils";
import type { VoiceItem, VoiceItemBar } from "abcjs";
import abcjs from "abcjs";
import { Import } from "lucide-react";
import { useSession } from "next-auth/react";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { ITheSessionTune } from "../import-the-session-schemas";
import {
  fetchTheSessionURLsFromTitle,
  fetchTuneInfoFromTheSessionURL,
  scrapeIrishTuneInfoTune,
} from "../import-utils";
import {
  createEmptyTune,
  createReference,
  getInstrumentById,
  getPlaylistById,
  getPlaylistTuneOverview,
  queryReferences,
  searchTunesByTitle,
} from "../queries";
import type {
  IExtractedTuneInfo,
  IReferenceData,
  ITheSessionTuneSummary,
  ITune,
  ITuneOverview,
} from "../types";
import { usePlaylist } from "./CurrentPlaylistProvider";
import { useTune } from "./CurrentTuneContext";
import { useImportUrl } from "./ImportContext";
import { useMainPaneView } from "./MainPaneViewContext";
import NewTuneButton from "./NewTuneButton";
import { SelectSettingDialog } from "./SelectSettingDialog"; // Import the new component
import { SelectTuneDialog } from "./SelectTuneDialog";

interface IImportButtonProps {
  userId: number;
  playlistId: number;
}

// interface IPromptForSettingResult {
//   settingIndex: number;
// }

function usePromptForSetting() {
  const [isOpenPromptForSetting, setIsOpenPromptForSetting] = useState(false);
  const [resolvePromise, setResolvePromise] =
    useState<(value: number) => void>();
  const [settingsData, setSettingsData] = useState<
    { abc: string; id: number }[]
  >([]);

  const promptUserForSetting = (
    settings: { abc: string; id: number }[],
  ): Promise<number> => {
    setIsOpenPromptForSetting(true);
    setSettingsData(settings);
    return new Promise<number>((resolve) => {
      setResolvePromise(() => resolve);
    });
  };

  const handlePromptUserForSetting = (input: number) => {
    if (resolvePromise) {
      resolvePromise(input);
      setIsOpenPromptForSetting(false);
      setSettingsData([]);
    }
  };

  return {
    isOpenPromptForSetting,
    promptUserForSetting,
    handlePromptUserForSetting,
    settingsData,
  };
}

export default function AddTuneButtonAndDialog({
  userId,
  playlistId,
}: IImportButtonProps): JSX.Element {
  const { setCurrentView } = useMainPaneView();
  const { setCurrentTune } = useTune();

  const { toast } = useToast();

  const {
    isOpenPromptForSetting,
    promptUserForSetting,
    handlePromptUserForSetting,
    settingsData,
  } = usePromptForSetting();

  const handleError = (message: string) => {
    toast({
      title: "Error",
      description: message,
      // status: "error",
    });
  };

  // const [importUrl, setImportUrl] = useState(
  //   // "https://www.irishtune.info/tune/1081/",
  //   "https://thesession.org/tunes/393",
  // );
  const { importUrl, setImportUrl } = useImportUrl();
  const [existingMatchesList, setExistingMatchesList] = useState<ITune[]>([]);
  const [showMatchesDialog, setShowMatchesDialog] = useState(false);
  const [scrapedTuneData, setScrapedTuneData] =
    useState<Partial<ITuneOverview> | null>(null);

  const [tuneSettingsList, setTuneSettingsList] = useState<
    ITheSessionTuneSummary[]
  >([]);
  const [showSettingsSelectDialog, setShowSettingsSelectDialog] =
    useState(false);

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setImportUrl(event.target.value);
  };

  function createReferenceFromURL(
    importURL: string,
    tuneId: number,
    userId: number,
  ) {
    const foreignId = importURL.split("/").findLast(Boolean);
    const title = importURL.includes("://www.irishtune.info")
      ? `irishtune.info #${foreignId}`
      : importURL.includes("://thesession.org")
        ? `thesession.org #${foreignId}`
        : `Source #${foreignId}`;

    const referenceData: IReferenceData = {
      tune_ref: tuneId,
      user_ref: userId,
      public: 1,
      url: importURL,
      ref_type: "website",
      favorite: 0,
      comment: null,
      title: title,
      deleted: false,
      isNew: true,
    };
    createReference(referenceData)
      .then((refData: IReferenceData) => {
        if (refData.tune_ref !== undefined) {
          setCurrentTune(refData.tune_ref);
          setImportUrl(importUrl);
          setCurrentView("edit");
        }
      })
      .catch((error) => {
        console.error("Error creating reference:", error);
      });
  }

  function createTuneAndUseIt(
    data: Partial<ITuneOverview>,
    importURL: string | null,
    secondaryURL?: string | null,
  ): void {
    createEmptyTune(data, Number(playlistId))
      .then((result) => {
        const tune = result as ITuneOverview;
        if (tune?.id === undefined) {
          console.error("Error creating tune: tune.id is undefined");
          return;
        }
        console.log(
          `Tune created successfully /pages/tune-edit?userId=${userId}&playlistId=${playlistId}&tuneId=${tune.id}`,
        );
        if (importURL) {
          createReferenceFromURL(importURL, tune.id, data.user_ref ?? userId);
        }
        if (secondaryURL) {
          createReferenceFromURL(
            secondaryURL,
            tune.id,
            data.user_ref ?? userId,
          );
        }
      })
      .catch((error) => {
        console.error("Error creating reference:", error);
      });
  }

  function getImportedTuneData(
    scrapedTune: Partial<ITuneOverview>,
  ): Partial<ITuneOverview> {
    return {
      title: scrapedTune.title ?? "",
      type: scrapedTune.type ?? "",
      structure: scrapedTune.structure ?? "",
      mode: scrapedTune.mode ?? "",
      incipit: scrapedTune.incipit ?? "",
      genre: "ITRAD",
      deleted: true,
      learned: null,
      practiced: null,
      quality: null,
      easiness: null,
      interval: null,
      repetitions: null,
      review_date: null,
      backup_practiced: null,
      external_ref: null,
      tags: null,
      recall_eval: null,
      notes: scrapedTune.notes ?? null,
    };
  }

  // Type guard to check if subElement is a VoiceItemBar
  function isVoiceItemBar(element: VoiceItem): element is VoiceItemBar {
    return element.el_type === "bar";
  }

  function extractIncipitFromTheSessionJson(
    tuneParsed: abcjs.TuneObject[],
    abcString: string,
    numberMeasuresToExtract = 4,
    numberBarsPerSection: number | null = 8,
  ): IExtractedTuneInfo {
    const firstTune = tuneParsed[0];
    const measures: string[] = [];
    let measureCount = 0;
    let structure = "";
    let sectionCount = 0;
    let incipitComplete = false;

    for (const line of firstTune.lines) {
      if (!line.staff) continue;
      for (const element of line.staff) {
        for (const subElement of element.voices?.flat() || []) {
          const elType = subElement.el_type;

          if (elType === "bar") {
            measureCount++;
            if (
              numberBarsPerSection &&
              measureCount % numberBarsPerSection === 0
            ) {
              sectionCount++;
              structure += String.fromCodePoint(65 + sectionCount); // A, B, C, etc.
            }
            if (measureCount >= numberMeasuresToExtract) {
              incipitComplete = true;
            }
          }

          if (
            (elType === "note" || elType === "bar") &&
            "startChar" in subElement &&
            "endChar" in subElement &&
            !incipitComplete
          ) {
            measures.push(
              abcString.slice(subElement.startChar, subElement.endChar),
            );
          }

          // Handle repeats
          if (
            isVoiceItemBar(subElement) &&
            subElement.type &&
            (subElement.type === "bar_left_repeat" ||
              subElement.type === "bar_right_repeat")
          ) {
            structure += String.fromCodePoint(65 + sectionCount);
          }
        }
      }
    }

    // Convert the measures back to an ABC string
    const abcMeasures = `${measures.join("")}|`;

    return { incipit: abcMeasures, structure };
  }

  async function fetchTheSessionURLFromTitle(
    title: string,
    tuneType: string,
  ): Promise<string | undefined> {
    try {
      const results = await fetchTheSessionURLsFromTitle(title, tuneType);
      if (results.total > 0) {
        if (results.total === 1) {
          const tuneUrlBase = results.tunes[0].url;
          return tuneUrlBase;
        }
        const tuneSettingsListLocal: ITheSessionTuneSummary[] = [];
        for (const tune of results.tunes) {
          tuneSettingsListLocal.push({
            name: tune.name,
            url: tune.url,
            type: tune.type,
          });
        }
        setTuneSettingsList(tuneSettingsListLocal);
        setShowSettingsSelectDialog(true);

        // let closestMatchIndex = 0;
        // let bestDistance = levenshteinDistance(
        //   results.tunes[0].name.toLowerCase(),
        //   title.toLowerCase(),
        // );

        // for (let index = 1; index < results.tunes.length; index++) {
        //   const tune = results.tunes[index];
        //   const currentDistance = levenshteinDistance(
        //     tune.name.toLowerCase(),
        //     title.toLowerCase(),
        //   );

        //   if (currentDistance < bestDistance) {
        //     bestDistance = currentDistance;
        //     closestMatchIndex = index;
        //   }
        // }
        // const tuneUrlBase = results.tunes[closestMatchIndex].url;
        return undefined;
      }
      return "";
    } catch (error) {
      console.error("Error fetching data:", error);
      throw error;
    }
  }

  async function fetchTheSessionIncipitFromTitle(
    title: string,
    tuneType: string,
  ): Promise<[string, string]> {
    const theSessionURL = await fetchTheSessionURLFromTitle(title, tuneType);
    if (!theSessionURL) {
      return ["", ""];
    }
    const incipit = await extractTuneMeasuresFromURL(theSessionURL);
    return [incipit, theSessionURL];
  }

  async function fetchTuneFromTheSessionURL(tuneUrlBase: string): Promise<{
    tuneParsed: abcjs.TuneObject[];
    abcString: string;
    tuneJson: ITheSessionTune;
  }> {
    const tuneJson = await fetchTuneInfoFromTheSessionURL(tuneUrlBase);
    // TODO: Fetch multiple settings here
    if (tuneJson.settings.length === 0) {
      throw new Error("No settings found for tune");
    }
    let whichSetting = 0;
    if (tuneJson.settings.length > 1) {
      const settings = tuneJson.settings.map((setting) => ({
        abc: setting.abc,
        id: setting.id,
      }));
      whichSetting = await promptUserForSetting(settings);
    }

    const setting = tuneJson.settings[whichSetting];
    const abcString = setting.abc;
    const tuneParsed = abcjs.parseOnly(abcString);
    return { tuneParsed, abcString, tuneJson };
  }

  async function extractTuneMeasuresFromURL(
    tuneUrlBase: string,
    numberMeasuresToExtract = 4,
  ) {
    const { tuneParsed, abcString } =
      await fetchTuneFromTheSessionURL(tuneUrlBase);
    const { incipit } = extractIncipitFromTheSessionJson(
      tuneParsed,
      abcString,
      numberMeasuresToExtract,
    );

    return incipit;
  }

  function getBarsPerSection(tuneType: string): number | null {
    const tuneTypeLower = tuneType.toLowerCase(); // Handle variations in capitalization

    switch (tuneTypeLower) {
      case "jig":
      case "single jig":
      case "double jig":
      case "slip jig":
      case "reel":
      case "hornpipe":
      case "polka":
      case "waltz":
        return 8; // Most common case

      case "air":
      case "slow air":
        return null; // Could vary, treat as unknown or handle separately

      // Add more cases as needed for specific tune types with variations
      // Example:
      // case "special jig":  return 16;

      default:
        return null; // Default: unknown, handle specially or assume 8
    }
  }

  async function findExistingMatches(url: string, title: string, type: string) {
    const existingMatches: ITune[] = [];

    const refs = await queryReferences(url);

    // In order to getPlaylistTuneOverview, we need the playlist and user ID.
    // For the moment, we'll just use the current playlist and user from the
    // context and session, rather than drilling it in.
    const { currentPlaylist } = usePlaylist();
    const { data: session } = useSession();
    const userId = session?.user?.id ? Number.parseInt(session?.user?.id) : -1;

    if (refs.length > 0) {
      const tuneRef = refs[0].tune_ref;
      if (tuneRef) {
        // REVIEW: calling getPlaylistTuneOverview() instead of getTune()
        //         This will ensure we get tune override data, which may or may
        //         not be what we want.
        const existingTune: ITuneOverview | { detail: string } =
          await getPlaylistTuneOverview(userId, currentPlaylist, tuneRef);
        if ("detail" in existingTune) {
          throw new Error(`Existing tune not found: ${existingTune.detail}`);
        }
        if (existingTune) {
          existingMatches.push(existingTune);
          return existingMatches;
        }
      }
    }

    if (title) {
      const matches = await searchTunesByTitle(title);
      for (const match of matches) {
        if (match.type === type) {
          existingMatches.push(match);
        }
      }
    }
    return existingMatches;
  }

  async function extractTheSessionTune(
    url: string,
  ): Promise<[Partial<ITuneOverview>, ITune[], string]> {
    const extractedTune: Partial<ITuneOverview> = {};

    try {
      const { tuneParsed, abcString, tuneJson } =
        await fetchTuneFromTheSessionURL(url);

      extractedTune.title = tuneJson.name;
      extractedTune.type = normalizeTuneType(tuneJson.type);

      extractedTune.mode = normalizeKey(tuneJson.settings[0].key);
      const barsPerSection = getBarsPerSection(tuneJson.type);
      const { incipit, structure } = extractIncipitFromTheSessionJson(
        tuneParsed,
        abcString,
        4,
        barsPerSection,
      );
      extractedTune.incipit = incipit;
      extractedTune.structure = structure;

      const existingMatches = await findExistingMatches(
        url,
        extractedTune.title ?? "",
        extractedTune.type ?? "",
      );

      return [extractedTune, existingMatches, ""];
    } catch (error) {
      console.error("Error extracting data:", error);
      throw error;
    }
  }

  async function extractIncipit(
    scrapedTune: Partial<ITuneOverview>,
  ): Promise<string> {
    const title = scrapedTune.title;
    const rhythm = scrapedTune.type;
    let secondarySourceUrl = "";
    if (title) {
      const [incipit, incipitURL] = await fetchTheSessionIncipitFromTitle(
        title,
        rhythm ?? "",
      );
      secondarySourceUrl = incipitURL;
      scrapedTune.incipit = incipit;
    }

    return secondarySourceUrl;
  }

  async function importTune(
    url: string,
  ): Promise<[Partial<ITuneOverview> | null, ITune[], string]> {
    try {
      if (url.startsWith("https://")) {
        if (url.includes("://www.irishtune.info")) {
          const scrapedTune = await scrapeIrishTuneInfoTune(url);
          if (!scrapedTune) {
            return [null, [], ""];
          }
          let secondarySourceUrl = "";
          if (!scrapedTune.incipit) {
            // Questionalble if we should do this at all, but it's here for now
            secondarySourceUrl = await extractIncipit(scrapedTune);
          }
          // I don't think we want to have findExistingMatches search by title here.
          const existingMatches = await findExistingMatches(url, "", "");
          return [scrapedTune, existingMatches, secondarySourceUrl];
        }
        if (url.includes("://thesession.org")) {
          return await extractTheSessionTune(url);
        }
        throw new Error("Unsupported URL");
      }
      // else assume it's a tune title
      const titleQuery = url;
      const theSessionURL = await fetchTheSessionURLFromTitle(titleQuery, "");
      if (theSessionURL === undefined) {
        return [null, [], ""];
      }
      if (theSessionURL) {
        return await extractTheSessionTune(theSessionURL);
      }
      throw new Error("No tune found");
    } catch (error) {
      console.error("Error scraping data:", error);
      throw error;
    }
  }

  const handleTuneSelect = (url: string | null) => {
    if (url) {
      setImportUrl(url);
      importTune(url)
        .then(([scrapedTune, existingMatches, secondaryURL]) => {
          if (scrapedTune === null) {
            // Should never happen
            throw new Error("scrapedTune is null, but it shouldn't be here");
          }

          const importedData = getImportedTuneData(scrapedTune);

          if (existingMatches.length > 0) {
            setScrapedTuneData(importedData);
            setExistingMatchesList(existingMatches);
            setShowMatchesDialog(true);
            return;
          }

          createTuneAndUseIt(importedData, url, secondaryURL);
        })
        .catch((error) => {
          handleError(`Error extracting tune from URL: ${error.message}`);
        });
    }
    setShowSettingsSelectDialog(false);
  };

  const handleImport = (): void => {
    if (!importUrl) {
      return;
    }
    importTune(importUrl)
      .then(([scrapedTune, existingMatches, secondaryURL]) => {
        console.log("===> ImportButton.tsx:62 ~ scrapedTune", scrapedTune);
        console.log(
          "===> ImportButton.tsx:63 ~ existingMatches",
          existingMatches,
        );

        if (scrapedTune === null) {
          // Assume the TheSessionTuneDialog is open
          return;
        }

        const importedData = getImportedTuneData(scrapedTune);

        if (existingMatches.length > 0) {
          setScrapedTuneData(importedData);
          setExistingMatchesList(existingMatches);
          setShowMatchesDialog(true);
          return;
        }

        createTuneAndUseIt(importedData, importUrl, secondaryURL);
      })
      .catch((error) => {
        handleError(`Error extracting tune from URL: ${error.message}`);
      });
  };

  function handleUseExisting(match: ITune): void {
    if (!match.id) {
      console.error("Error using existing tune: match.id is undefined");
      return;
    }
    setCurrentTune(match.id);
    setCurrentView("edit");
  }

  function handleProceedWithImport(): void {
    if (!scrapedTuneData) return;
    // TODO: need to set the secondary URL in the import context
    createTuneAndUseIt(scrapedTuneData, importUrl, "");
    setShowMatchesDialog(false);
  }

  // const [currentPlaylist, setCurrentPlaylist] = useState<
  //   IPlaylist | { detail: string } | null
  // >(null);
  // const [currentInstrument, setCurrentInstrument] =
  //   useState<IInstrument | null>(null);
  // const [genreDefault, setGenreDefault] = useState<string | null>(null);

  const [currentGenre, setCurrentGenre] = useState<string | null>(null);

  useEffect(() => {
    if (playlistId) {
      getPlaylistById(playlistId)
        .then((playlist) => {
          console.log("Fetched playlist:", playlist);
          // setCurrentPlaylist(playlist);
          if (!playlist || "detail" in playlist) {
            console.error("Playlist not found");
            return;
          }
          if (playlist.instrument_ref) {
            getInstrumentById(playlist.instrument_ref)
              .then((instrument) => {
                console.log("Fetched instrument:", instrument);
                if (!instrument || "detail" in instrument) {
                  console.error("Instrument not found");
                  return;
                }
                // setCurrentInstrument(instrument);
                // setGenreDefault(instrument.genre_default ?? null);
                setCurrentGenre(instrument.genre_default ?? null);
              })
              .catch((error) => {
                console.error("Error fetching instrument:", error);
              });
          }
        })
        .catch((error) => {
          console.error("Error fetching playlist:", error);
        });
    }
  }, [playlistId]);

  const { genres, isGenresLoading } = useGenresList();

  const handleEditGenre = (value: string) => {
    setCurrentGenre(value);
  };

  if (isGenresLoading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Dialog modal={true}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            aria-label="Import tune or tunes"
            data-testid="tt-import-button"
          >
            Add Tune
            <Import className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent
          className="w-[64ch] max-w-[100ch] min-w-[30ch] resize"
          style={{ resize: "horizontal", overflow: "auto" }}
        >
          <DialogHeader>
            <DialogTitle>Add Tune</DialogTitle>
            <DialogDescription>Add or Import a tune.</DialogDescription>
            {currentGenre === "ITRAD" ? (
              <>
                <p className="text-sm text-muted-foreground">
                  You can import a tune from a URL or search for a tune by
                  title. At this time, only tunes from the following sites can
                  be imported:
                </p>
                <table className="text-sm text-muted-foreground">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Site</th>
                      <th>URL</th>
                      <th>Type</th>
                      <th>Genre</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>1</td>
                      <td>irishtune.info</td>
                      <td>
                        <a
                          href="https://www.irishtune.info/"
                          target="_blank"
                          rel="noreferrer"
                        >
                          https://www.irishtune.info/
                        </a>
                      </td>
                      <td>Individual Tune Only</td>
                      <td>ITRAD</td>
                    </tr>
                    <tr>
                      <td>2</td>
                      <td>The Session</td>
                      <td>
                        <a
                          href="https://thesession.org/"
                          target="_blank"
                          rel="noreferrer"
                        >
                          https://thesession.org/
                        </a>
                      </td>
                      <td>Individual Tune Only</td>
                      <td>ITRAD</td>
                    </tr>
                  </tbody>
                </table>
              </>
            ) : (
              <p>No import sites implemented for this Genre.</p>
            )}
          </DialogHeader>
          <div className="grid gap-4 py-4 pb-0 mb-0">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Select Genre:
              </Label>
              <GenreSelector
                genre_default={currentGenre ?? ""}
                private_to_user={1}
                genres={genres}
                onSelect={(genreId) => {
                  handleEditGenre(genreId);
                }}
              />
            </div>
          </div>

          <div className="grid gap-4 py-0">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                URL or Title:
              </Label>
              <Input
                id="import-url"
                value={importUrl ?? ""}
                className="col-span-3 w-full"
                onChange={handleUrlChange}
              />
            </div>
          </div>
          <DialogFooter>
            <NewTuneButton userId={userId} playlistId={playlistId} />
            <Button
              variant="outline"
              type="submit"
              onClick={handleImport}
              disabled={importUrl === "" || currentGenre !== "ITRAD"}
            >
              {importUrl?.startsWith("https://") ? "Import" : "Search"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* --------------------- */}
      <SelectTuneDialog
        open={showSettingsSelectDialog}
        onOpenChange={setShowSettingsSelectDialog}
        tunes={tuneSettingsList}
        onTuneSelect={handleTuneSelect}
      />
      {/* --------------------- */}
      <SelectSettingDialog
        open={isOpenPromptForSetting}
        onOpenChange={() => handlePromptUserForSetting(-1)}
        settings={settingsData}
        onSettingSelect={handlePromptUserForSetting}
      />
      {/* --------------------- */}
      <Dialog open={showMatchesDialog} onOpenChange={setShowMatchesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Found Possible Existing Matches</DialogTitle>
            <DialogDescription>
              found possible existing matches for this tune, would you like to
              use one of these instead of importing a new tune?
            </DialogDescription>
          </DialogHeader>
          <ul>
            {existingMatchesList.map((match) => (
              <li key={match.id}>
                <Button variant="link" onClick={() => handleUseExisting(match)}>
                  {match.title}
                </Button>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={handleProceedWithImport}>
              Import as New Tune Instead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
