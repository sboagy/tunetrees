/* eslint-disable unicorn/filename-case */
"use client";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import NoteCards from "./NoteCards";
import ReferenceCards from "./ReferenceCards";
import { Edit } from "lucide-react";
import { getTune } from "../queries";
import { useEffect, useState } from "react";
import type { Tune } from "../types";

interface ISidebarProps {
  currentTune: number | null; // Add currentTune prop
  userId: number;
  playlistId: number;
  refreshData: () => Promise<{
    scheduledData: Tune[];
    repertoireData: Tune[];
  }>;
}

const Sidebar = ({
  currentTune,
  userId,
  playlistId,
  refreshData,
}: ISidebarProps) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // const [selectedTune, setSelectedTune] = useState(1);

  // const urls = [
  //   { title: "Favorite URL", url: "http://example.com", favorite: true },
  //   { title: "Another URL", url: "http://example2.com", favorite: false },
  // ];

  const router = useRouter();
  const [tuneTitle, setTuneTitle] = useState<string | null>(null);

  useEffect(() => {
    if (currentTune !== null) {
      const tune = getTune(currentTune);
      tune
        .then((result) => {
          const tuneBare = result as Tune;
          setTuneTitle(tuneBare.title);
        })
        .catch((error) => {
          console.error("Error fetching tune:", error);
          setTuneTitle(null);
        });
    } else {
      setTuneTitle(null);
    }
  }, [currentTune]);

  return currentTune ? (
    <>
      <div className="flex items-right justify-between mb-2 cursor-auto">
        <h4>{tuneTitle}</h4>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Edit"
          className="p-0 h-auto"
          title="Edit"
          onClick={() => {
            console.log("Edit button clicked");
            router.push(
              `/pages/tune-edit?userId=${userId}&playlistId=${playlistId}&tuneId=${currentTune}`,
            );
            void refreshData();
          }}
        >
          <Edit className="h-4 w-4" />
        </Button>
      </div>
      <div className="urls">
        <ReferenceCards
          tuneRef={currentTune}
          userRef={1}
          displayPublic={true}
        />
      </div>
      <div className="notes">
        <NoteCards tuneRef={currentTune} userRef={1} displayPublic={true} />
      </div>
    </>
  ) : (
    <p>No Tune selected</p>
  );
};

export default Sidebar;