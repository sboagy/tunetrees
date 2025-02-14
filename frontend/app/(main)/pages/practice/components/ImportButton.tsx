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
import { Import } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { importTune } from "../import-utils";
import { createEmptyTune, createReference } from "../queries";
import type { IReferenceData, ITune, ITuneOverview } from "../types";
import { useTune } from "./CurrentTuneContext";
import { useImportUrl } from "./ImportContext";
import { useMainPaneView } from "./MainPaneViewContext";

interface IImportButtonProps {
  userId: number;
  playlistId: number;
}

export default function ImportButton({
  userId,
  playlistId,
}: IImportButtonProps): JSX.Element {
  const { setCurrentView } = useMainPaneView();
  const { setCurrentTune } = useTune();

  const { toast } = useToast();

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

  return (
    <>
      <Dialog modal={true}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            aria-label="Import tune or tunes"
            data-testid="tt-import-button"
          >
            Import
            <Import className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent
          className="w-[64ch] max-w-[100ch] min-w-[30ch] resize"
          style={{ resize: "horizontal", overflow: "auto" }}
        >
          <DialogHeader>
            <DialogTitle>Import</DialogTitle>
            <DialogDescription>
              Import a tune or a list of tunes from external web site.
              <br />
              At this time, only tunes from the following sites can be imported:
            </DialogDescription>
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
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                URL
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
            <Button
              variant="outline"
              type="submit"
              onClick={handleImport}
              disabled={importUrl === ""}
            >
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
              Import New Tune Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
