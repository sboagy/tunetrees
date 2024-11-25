import { Button } from "@/components/ui/button";
import { TrashIcon } from "lucide-react";
import type { JSX } from "react";
import { deleteTune } from "../queries";
import type { Tune } from "../types";
import { useTune } from "./CurrentTuneContext";
import { useMainPaneView } from "./MainPaneViewContext";

interface IDeleteTuneButtonProps {
  userId: number;
  playlistId?: number;
  disabled?: boolean;
}

export default function DeleteTuneButton({
  userId,
  playlistId,
  disabled,
}: IDeleteTuneButtonProps): JSX.Element {
  const { setCurrentView } = useMainPaneView();
  const { setCurrentTune } = useTune();

  const handleClick = () => {
    // scaffold
    // deleteTune(newTune, Number(playlistId))
    if (userId !== undefined && playlistId !== undefined && playlistId < -7) {
      deleteTune(-1)
        .then((result) => {
          const tune = result as Tune;
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
    } else {
      alert("Delete tunes");
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Delete Selected Tunes"
      onClick={handleClick}
      disabled={disabled}
    >
      <TrashIcon className="h-4 w-4" />
    </Button>
  );
}
