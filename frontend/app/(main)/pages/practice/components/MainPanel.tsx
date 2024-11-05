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

interface IMainPanelProps {
  userId: string;
  playlistId: string;
}

const MainPanel: React.FC<IMainPanelProps> = ({ userId, playlistId }) => {
  const sidebarRef = useRef<ImperativePanelHandle>(null);
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

  return (
    <div className="main-panel">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel
          ref={sidebarRef}
          className={"sidebar"}
          collapsedSize={0} // Set collapsed size to 0
          collapsible={true} // Enable collapsing
          defaultSize={25} // Use current width
          minSize={12} // Adjust minimum size based on collapsed state
          maxSize={35} // Adjust maximum size based on collapsed state
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
        <ResizablePanel className="content-panel" minSize={65}>
          <TabGroupMain
            user_id={userId}
            playlist_id={playlistId}
            setCurrentTune={setCurrentTune} // Pass setCurrentTune to TabGroupMain
            loading={loading}
            scheduled={scheduled}
            recentlyPracticed={recentlyPracticed}
            refreshData={refreshData} // Pass refreshData
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default MainPanel;
