"use client";

import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import { useEffect, useState } from "react";
import { getTune } from "../queries";
import type { Tune } from "../types";
import NoteCards from "./NoteCards";
import ReferenceCards from "./ReferenceCards";
import "./Sidebar.css";
import { useTune } from "./TuneContext";

interface ISidebarProps {
  userId: number;
  playlistId: number;
  onEditTune: (tuneId: number) => void;
}

const Sidebar = ({ onEditTune }: ISidebarProps) => {
  // const [selectedTune, setSelectedTune] = useState(1);

  // const urls = [
  //   { title: "Favorite URL", url: "http://example.com", favorite: true },
  //   { title: "Another URL", url: "http://example2.com", favorite: false },
  // ];

  const [tuneTitle, setTuneTitle] = useState<string | null>(null);
  const { currentTune } = useTune();

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

  const handleTuneEditClick = (tuneId: number) => {
    onEditTune(tuneId);
  };

  return currentTune ? (
    <div className="flex flex-col h-full">
      <div className="sidebar flex-grow overflow-y-auto">
        <div className="flex items-center justify-between mb-2 cursor-auto">
          <h4>{tuneTitle}</h4>
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
