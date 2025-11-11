"use client";
import { getSession, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { logVerbose } from "@/lib/logging";
import { usePlaylist } from "./CurrentPlaylistProvider";
import { useTune } from "./CurrentTuneContext";
import "./MainPanel.css";
import { useMainPaneView } from "./MainPaneViewContext";
import Sidebar from "./Sidebar";
import TabGroupMain from "./TabGroupMain";
import TuneEditor from "./TuneEditor";

interface IMainPanelProps {
  userId: number;
}

const MainPanel: React.FC<IMainPanelProps> = ({ userId }) => {
  const { currentView } = useMainPaneView();
  const { currentTune } = useTune();
  const sidebarRef = useRef<ImperativePanelHandle>(null);
  const { currentPlaylist: currentPlaylistId } = usePlaylist();
  const [isClient, setIsClient] = useState(false);
  logVerbose(
    `LF1 render MainPanel: playlistId=${currentPlaylistId}, userId=${userId}`,
  );

  const toggleSidebar = () => {
    if (sidebarRef.current) {
      if (sidebarRef.current.isCollapsed()) {
        sidebarRef.current.expand();
      } else {
        sidebarRef.current.collapse();
      }
    }
  };

  const { status } = useSession();
  logVerbose("MainPanel status", status);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const refreshSession = async () => {
      if (status === "unauthenticated") {
        logVerbose("MainPanel forcing session refresh...");
        setIsRefreshing(true); // Indicate that the session is being refreshed
        try {
          const newSession = await getSession();
          if (newSession) {
            logVerbose("MainPanel session refreshed", newSession);
          } else {
            console.error("MainPanel ===> Failed to refresh session.");
          }
        } catch (error) {
          console.error("MainPanel ===> Error refreshing session:", error);
        } finally {
          setIsRefreshing(false); // Refreshing is complete
        }
      }
    };

    void refreshSession(); // Call the async function
    // Collapse the sidebar if on a small device
    if (window !== undefined && sidebarRef.current && window.innerWidth < 768) {
      sidebarRef.current.collapse();
    }
  }, [status]);

  // const { status } = useSession();
  // console.log("MainPanel ===> MainPanel.tsx:53 ~ status", status);

  if (status === "loading" || isRefreshing) {
    // I'm not sure if this will occur, but it's here just in case.
    return <div>Loading...</div>;
  }
  // Add extra logic to make double-sure the user is authenticated.
  // But the user should be always authenticated before they get here,
  // and it's a bug if they're not.
  if (status === "unauthenticated") {
    return <div>Not authenticated</div>;
  }

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return (
    <div className="main-panel">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel
          ref={sidebarRef}
          className={"sidebar flex flex-col overflow-y-auto"} // Add overflow-y-auto for vertical scrolling
          collapsedSize={0} // Set collapsed size to 0
          collapsible={true} // Enable collapsing
          // NOTE: Keep sidebar at 24% so remaining panel can naturally flex to ~76%.
          // We removed explicit 100% default on the content panel below to avoid layout total > 100% warnings.
          defaultSize={24}
          minSize={12} // Adjust minimum size based on collapsed state
          // maxSize={35} // Adjust maximum size based on collapsed state
        >
          <Sidebar
            userId={Number(userId)}
            playlistId={Number(currentPlaylistId)}
          />{" "}
          {/* Pass currentTune to Sidebar */}
        </ResizablePanel>
        <ResizableHandle
          withHandle
          onDoubleClick={toggleSidebar} // Add double-click event listener
        />
        <ResizablePanel
          className="content-panel flex-grow"
          collapsedSize={0}
          collapsible={true}
          // Removed explicit defaultSize (previously 100) so library can auto-calc remaining space.
          // Setting minSize ensures it won't collapse too small when sidebar is expanded.
          minSize={70}
        >
          <div className="flex flex-col h-full">
            {currentView === "tabs" ? (
              <TabGroupMain userId={userId} playlistId={currentPlaylistId} />
            ) : currentTune ? (
              <TuneEditor
                userId={userId}
                playlistId={currentPlaylistId}
                tuneId={currentTune}
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
