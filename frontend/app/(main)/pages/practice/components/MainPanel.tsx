"use client";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useEffect, useRef, useState } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import "./MainPanel.css";
import Sidebar from "./Sidebar";
import TabGroupMain from "./TabGroupMain";
import TuneEditor from "./TuneEditor";

interface IMainPanelProps {
  userId: number;
  playlistId: number;
}

const MainPanel: React.FC<IMainPanelProps> = ({ userId, playlistId }) => {
  const [currentView, setCurrentView] = useState<"tabs" | "editor">("tabs");
  const [currentTuneId, setCurrentTuneId] = useState<number | null>(null);
  const sidebarRef = useRef<ImperativePanelHandle>(null);

  const toggleSidebar = () => {
    if (sidebarRef.current) {
      if (sidebarRef.current.isCollapsed()) {
        sidebarRef.current.expand();
      } else {
        sidebarRef.current.collapse();
      }
    }
  };

  const handleEditTune = (tuneId: number) => {
    setCurrentTuneId(tuneId);
    setCurrentView("editor");
  };

  const handleBackToTabs = () => {
    setCurrentView("tabs");
  };

  useEffect(() => {
    // Collapse the sidebar if on a small device
    if (window !== undefined && sidebarRef.current && window.innerWidth < 768) {
      sidebarRef.current.collapse();
    }
  }, []);

  return (
    <div className="main-panel">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel
          ref={sidebarRef}
          className={"sidebar flex flex-col overflow-y-auto"} // Add overflow-y-auto for vertical scrolling
          collapsedSize={0} // Set collapsed size to 0
          collapsible={true} // Enable collapsing
          defaultSize={25} // Use current width
          minSize={12} // Adjust minimum size based on collapsed state
          // maxSize={35} // Adjust maximum size based on collapsed state
        >
          <Sidebar
            userId={Number(userId)}
            playlistId={Number(playlistId)}
            onEditTune={handleEditTune}
          />{" "}
          {/* Pass currentTune to Sidebar */}
        </ResizablePanel>
        <ResizableHandle
          withHandle
          onDoubleClick={toggleSidebar} // Add double-click event listener
        />
        <ResizablePanel
          className="content-panel flex-grow"
          collapsedSize={0} // Set collapsed size to 0
          collapsible={true} // Enable collapsing
          minSize={65}
        >
          <div className="flex flex-col h-full">
            {currentView === "tabs" ? (
              <TabGroupMain
                userId={userId}
                playlistId={playlistId}
                onEditTune={handleEditTune}
              />
            ) : currentTuneId !== null ? (
              <TuneEditor
                userId={userId}
                playlistId={playlistId}
                tuneId={currentTuneId}
                onCancel={handleBackToTabs}
              />
            ) : (
              (() => {
                throw new Error("currentTuneId is not defined");
              })()
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default MainPanel;
