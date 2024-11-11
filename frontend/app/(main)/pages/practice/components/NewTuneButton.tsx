import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { createTune } from "../queries";
import type { Tune } from "../types";

interface INewTuneButtonProps {
  user_id: string;
  playlist_id: string;
  refreshData: () => Promise<{
    scheduledData: Tune[];
    repertoireData: Tune[];
  }>;
}

export default function NewTuneButton({
  user_id,
  playlist_id,
  refreshData,
}: INewTuneButtonProps): JSX.Element {
  const router = useRouter();

  const handleClick = () => {
    const newTune: Tune = {
      title: "New Tune",
      type: "",
      structure: null,
      mode: null,
      incipit: null,
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
    createTune(newTune, Number(playlist_id))
      .then((result) => {
        const tune = result as Tune;
        console.log(
          `Tune created successfully /pages/tune-edit?userId=${user_id}&playlistId=${playlist_id}&tuneId=${tune.id}`,
        );
        router.push(
          `/pages/tune-edit?userId=${user_id}&playlistId=${playlist_id}&tuneId=${tune.id}`,
        );
        void refreshData();
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
