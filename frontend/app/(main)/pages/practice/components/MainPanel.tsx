"use client";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import Sidebar from "./Sidebar";
import TabGroupMain from "./TabGroupMain";
import { useEffect } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { useRef } from "react";
import "./MainPanel.css";
import { TuneProvider } from "./TuneContext";
import { TuneDataRefreshProvider } from "./TuneDataRefreshContext";

interface IMainPanelProps {
  userId: number;
  playlistId: number;
}

const MainPanel: React.FC<IMainPanelProps> = ({ userId, playlistId }) => {
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

  useEffect(() => {
    // Collapse the sidebar if on a small device
    if (window !== undefined && sidebarRef.current && window.innerWidth < 768) {
      sidebarRef.current.collapse();
    }
  }, []);

  return (
    <TuneDataRefreshProvider>
      <TuneProvider>
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
                <TabGroupMain userId={userId} playlistId={playlistId} />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </TuneProvider>
    </TuneDataRefreshProvider>
  );
};

export default MainPanel;
