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
import { Import } from "lucide-react";
import { type JSX, useState } from "react";
import { importTune } from "../import-utils";
import { createEmptyTune } from "../queries";
import type { ITuneOverview } from "../types";
import { useTune } from "./CurrentTuneContext";
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

  const [importUrl, setImportUrl] = useState(
    // "https://www.irishtune.info/tune/1081/",
    "https://thesession.org/tunes/393",
  );

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setImportUrl(event.target.value);
  };

  const handleImport = () => {
    importTune(importUrl)
      .then((scrapedTune) => {
        console.log("===> ImportButton.tsx:62 ~ scrapedTune", scrapedTune);
        const importedTune: Partial<ITuneOverview> = {
          title: scrapedTune.title ?? "",
          type: scrapedTune.type ?? "",
          structure: scrapedTune.structure ?? "",
          mode: scrapedTune.mode ?? "",
          incipit: scrapedTune.incipit ?? "",
          genre: "ITRAD",
          deleted: true, // This is a new tune, so it's deleted by default
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
          notes: null,
        };
        createEmptyTune(importedTune, Number(playlistId))
          .then((result) => {
            const tune = result as ITuneOverview;
            console.log(
              `Tune created successfully /pages/tune-edit?userId=${userId}&playlistId=${playlistId}&tuneId=${tune.id}`,
            );
            if (tune?.id === undefined) {
              console.error("Error creating tune: tune.id is undefined");
              return;
            }
            setCurrentTune(tune.id);
            setCurrentView("edit");
            // void refreshData();
          })
          .catch((error) => {
            console.error("Error creating tune:", error);
          });
      })
      .catch((error) => {
        alert(`Error extracting tune from URL: ${error.message}`);
      });
  };

  return (
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
              value={importUrl}
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
  );
}
