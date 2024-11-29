import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { JSX } from "react";
import { createEmptyTune } from "../queries";
import type { TuneOverview } from "../types";
import { useTune } from "./CurrentTuneContext";
import { useMainPaneView } from "./MainPaneViewContext";

interface INewTuneButtonProps {
  userId: number;
  playlistId: number;
}

export default function NewTuneButton({
  userId,
  playlistId,
}: INewTuneButtonProps): JSX.Element {
  const { setCurrentView } = useMainPaneView();
  const { setCurrentTune } = useTune();

  const handleClick = () => {
    const newTune: TuneOverview = {
      title: "New Tune",
      type: "",
      structure: null,
      mode: null,
      incipit: null,
      genre: null,
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
    createEmptyTune(newTune, Number(playlistId))
      .then((result) => {
        const tune = result as TuneOverview;
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

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Add new reference"
      onClick={handleClick}
    >
      <Plus className="h-4 w-4" />
    </Button>
  );
}
