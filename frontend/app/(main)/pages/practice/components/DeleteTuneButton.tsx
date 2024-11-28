import { Button } from "@/components/ui/button";
import type { Table as TanstackTable } from "@tanstack/react-table";
import { TrashIcon } from "lucide-react";
import type { JSX } from "react";
import { deleteTune } from "../queries";
import type { TuneOverview } from "../types";
import { useTune } from "./CurrentTuneContext";
import { useMainPaneView } from "./MainPaneViewContext";

interface IDeleteTuneButtonProps {
  userId: number;
  playlistId?: number;
  disabled?: boolean;
  table: TanstackTable<TuneOverview>;
}

export default function DeleteTuneButton({
  userId,
  playlistId,
  disabled,
  table,
}: IDeleteTuneButtonProps): JSX.Element {
  const { setCurrentView } = useMainPaneView();
  const { currentTune, setCurrentTune } = useTune();

  const handleClick = () => {
    // If playlistId is undefined, the operation is on the all tunes table.
    // For now, in that case, just mark the tune as deleted, but don't actually delete from
    // the database, because outstanding references to the tune may exist.  Then, filter the
    // tune from (just) the all tunes table.  Play lists may still show the tune.
    //
    // If playlistId is defined, delete the tune from the `playlist_tunes` table.
    // Maybe in this we should also mark the tune as deleted, but not actually delete it?

    const selectedTunes: TuneOverview[] = table
      .getSelectedRowModel()
      .rows.map((row) => row.original);

    if (userId !== undefined && playlistId !== undefined) {
      for (const tune of selectedTunes) {
        deleteTune(tune.id as number)
          .then((result: { success?: string; detail?: string }) => {
            console.log(
              `Tune deleted successfully: ${tune.id}, result: ${result.detail}`,
            );
            if (currentTune === tune.id) {
              setCurrentTune(null);
            }
            setCurrentView("tabs");
            // void refreshData();
          })
          .catch((error) => {
            console.error(`Error deleting tune ${tune.id}:`, error);
          });
      }
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
