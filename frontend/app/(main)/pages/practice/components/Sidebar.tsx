"use client";

import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getTune } from "../queries";
import type { ITuneOverview } from "../types";
import { useTune } from "./CurrentTuneContext";
import { useMainPaneView } from "./MainPaneViewContext";
import NoteCards from "./NoteCards";
import ReferenceCards from "./ReferenceCards";
import "./Sidebar.css";

interface ISidebarProps {
  userId: number;
  playlistId: number;
}

const Sidebar = ({ userId, playlistId }: ISidebarProps) => {
  const { setCurrentView } = useMainPaneView();
  console.log(`Sidebar: userId=${userId}, playlistId=${playlistId}`);

  const [tuneTitle, setTuneTitle] = useState<string | null>(null);
  const { currentTune, currentTuneUpdate } = useTune();
  const prevCurrentTuneUpdate = useRef<number>(currentTuneUpdate);

  useEffect(() => {
    if (currentTune !== null) {
      if (prevCurrentTuneUpdate.current !== currentTuneUpdate) {
        // This is really here just so I don't hae to disable the variable with eslint.
        console.log(
          "Sidebar ===> Sidebar.tsx:30 ~ useEffect triggered by currentTuneUpdate",
        );
      }
      const tune = getTune(currentTune);
      tune
        .then((result: ITuneOverview | { detail: string }) => {
          const tuneBare = result as ITuneOverview;
          setTuneTitle(tuneBare.title ?? "No Title");
        })
        .catch((error) => {
          console.error("Error fetching tune:", error);
          setTuneTitle(null);
        });
    } else {
      setTuneTitle(null);
    }
  }, [currentTune, currentTuneUpdate]);

  const handleTuneEditClick = (tuneId: number) => {
    console.log(
      "handleTuneEditClick (current tune should already be set): tuneId=",
      tuneId,
    );
    setCurrentView("edit");
  };

  return currentTune && currentTune > 0 ? (
    <div className="flex flex-col h-full">
      <div className="sidebar flex-grow overflow-y-auto">
        <div className="flex items-center justify-between mb-2 mt-4 cursor-auto">
          <h2 id="current-tune-title" className="text-xl font-bold">
            {tuneTitle}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Edit"
            className="p-0 h-auto"
            title="Edit"
            onClick={() => {
              console.log("Edit button clicked");
              handleTuneEditClick(currentTune);
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
      </div>
    </div>
  ) : (
    <p>No Tune selected</p>
  );
};

export default Sidebar;
