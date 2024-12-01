import { Button } from "@/components/ui/button";
import type { Table as TanstackTable } from "@tanstack/react-table";
import { TrashIcon } from "lucide-react";
import type { JSX } from "react";
import { updatePlaylistTunes, updateTunes } from "../queries";
import type { TuneOverview } from "../types";
import { useTune } from "./CurrentTuneContext";
import { useMainPaneView } from "./MainPaneViewContext";
import { useTuneDataRefresh } from "./TuneDataRefreshContext";

interface IDeleteTuneButtonProps {
  userId: number;
  playlistId?: number;
  disabled?: boolean;
  table: TanstackTable<TuneOverview>;
}

export default function DeleteTuneButton({
  playlistId,
  disabled,
  table,
}: IDeleteTuneButtonProps): JSX.Element {
  const { currentView, setCurrentView } = useMainPaneView();
  const { currentTune, setCurrentTune } = useTune();
  const { triggerRefresh } = useTuneDataRefresh();

  const handleClick = () => {
    // If playlistId is undefined, the operation is on the all tunes table.
    // Otherwise, the operation is on the playlist (repertoire) tunes table.
    //
    // Deletions will be "soft" deletions, meaning that the tune will be marked
    // as deleted in the database but not actually removed. This allows for
    // recovery of deleted tunes, and overall integrety of references to tune IDs.
    //
    // Consider: if the tune doesn't have a title, it's a new tune that propably
    // hasn't been referenced anywhere yet. In that case, it's probably safe to
    // delete it?

    const selectedTunes: TuneOverview[] = table
      .getSelectedRowModel()
      .rows.map((row) => row.original);

    const selectedTuneIds = selectedTunes.map((tune) => tune.id as number);

    function resetCurrentTuneAndView() {
      table.resetRowSelection();
      if (selectedTuneIds.includes(currentTune as number)) {
        console.log(
          `LF6 resetCurrentTuneAndView (DeleteTuneButton) to null: currentTune (before change)=${currentTune}`,
        );
        setCurrentTune(null);
        const rows = table.getRowModel().rows;
        const currentIndex = rows.findIndex(
          (row) => row.original.id === currentTune,
        );
        let tuneToSet = null;
        if (currentIndex >= 0 && currentIndex < rows.length - 1) {
          tuneToSet = rows[currentIndex + 1].original.id ?? null;
        }
        console.log(
          `LF6 resetCurrentTuneAndView (DeleteTuneButton): tuneToSet=${tuneToSet}`,
        );
        setCurrentTune(tuneToSet);
      }
      if (currentView === "edit") {
        setCurrentView("tabs");
      }
      triggerRefresh();
    }

    if (playlistId !== undefined) {
      if (
        !confirm(
          `Are you sure you want to delete the selected tunes from your repertoire with IDs: ${selectedTuneIds.join(", ")}?`,
        )
      ) {
        return;
      }
      updatePlaylistTunes(selectedTuneIds, playlistId, {
        deleted: true,
      })
        .then((result) => {
          console.log("PlaylistTunes deleted successfully:", result);
          resetCurrentTuneAndView();
        })
        .catch((error) => {
          console.error("Error deleting tunes:", error);
        });
    } else {
      if (
        !confirm(
          `Are you sure you want to delete the selected tunes from TuneTrees with IDs: ${selectedTuneIds.join(", ")}?`,
        )
      ) {
        return;
      }
      updateTunes(selectedTuneIds, { deleted: true })
        .then((result) => {
          console.log("Tunes deleted successfully:", result);
          resetCurrentTuneAndView();
        })
        .catch((error) => {
          console.error("Error deleting tunes:", error);
        });
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
