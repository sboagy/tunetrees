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

  const handleClick = () => {
    const importedTune: ITuneOverview = {
      title: "",
      type: "",
      structure: null,
      mode: null,
      incipit: null,
      genre: null,
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
  };

  const [importUrl, setImportUrl] = useState("");

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setImportUrl(event.target.value);
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
          </DialogDescription>
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
            onClick={handleClick}
            disabled={importUrl === ""}
          >
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
