"use client";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import Sidebar from "./Sidebar";
import TabGroupMain from "./TabGroupMain";
import { useEffect, useState } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { useRef } from "react";
import type { Tune } from "../types";
import { getPracticeListScheduled, getRecentlyPracticed } from "../queries";
import "./MainPanel.css";

interface IMainPanelProps {
  userId: string;
  playlistId: string;
}

const MainPanel: React.FC<IMainPanelProps> = ({ userId, playlistId }) => {
  const sidebarRef = useRef<ImperativePanelHandle>(null);

  // Important Note (1): There are two levels of "currentTune" states.
  // The first level is in the MainPanel component, which is user to track the current tune for
  // sharing between the Sidebar and TabGroupMain components.
  // The second level is that both the RepertoireGrid and ScheduledTunesGrid components have their
  // own "currentTune" states, which are used to track the current tune for each grid.  These grid
  // states are also stored in the `table_state` table in the database.
  // Trying to keep these states in sync is a bit tricky and messy, including making sure the
  // table callback functions can access the current tune states.  Hopefully I can polish this up
  // over time.
  const [currentTune, setCurrentTune] = useState<number | null>(null); // Add currentTune state
  const [scheduled, setScheduled] = useState<Tune[]>();
  const [recentlyPracticed, setRecentlyPracticed] = useState<Tune[]>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const doInitialization = async (userId: string) => {
      try {
        // TODO: The tab components should fetch their own data
        const scheduledData = await getPracticeListScheduled(
          userId,
          playlistId,
        );
        setScheduled(scheduledData);

        const repertoireData = await getRecentlyPracticed(userId, playlistId);
        setRecentlyPracticed(repertoireData);
        // setOrigRecentlyPracticed(repertoireData);
      } catch (error) {
        console.error("Error fetching active tab:", error);
      } finally {
        setLoading(false);
      }
    };
    void doInitialization(userId);
  }, [userId, playlistId]);

  const refreshData = async (): Promise<{
    scheduledData: Tune[];
    repertoireData: Tune[];
  }> => {
    try {
      const scheduledData = await getPracticeListScheduled(userId, playlistId);
      setScheduled(scheduledData);

      const repertoireData = await getRecentlyPracticed(userId, playlistId);
      setRecentlyPracticed(repertoireData);

      return { scheduledData, repertoireData };
    } catch (error) {
      console.error("Error refreshing data:", error);
      throw error;
    }
  };

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
            currentTune={currentTune}
            userId={Number(userId)}
            playlistId={Number(playlistId)}
            refreshData={refreshData} // Pass refreshData callback
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
            <TabGroupMain
              user_id={userId}
              playlist_id={playlistId}
              setCurrentTune={setCurrentTune} // Pass setCurrentTune to TabGroupMain
              currentTune={currentTune}
              loading={loading}
              scheduled={scheduled}
              recentlyPracticed={recentlyPracticed}
              refreshData={refreshData} // Pass refreshData
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default MainPanel;
