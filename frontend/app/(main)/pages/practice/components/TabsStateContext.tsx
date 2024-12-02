import {
  type ITabSpec,
  initialTabSpec,
} from "@/app/(main)/pages/practice/tab-spec";
import { useSession } from "next-auth/react";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import {
  type ITabGroupMainStateModel,
  createTabGroupMainState,
  getTabGroupMainState,
  updateTabGroupMainState,
} from "../settings";
import { usePlaylist } from "./CurrentPlaylistProvider";

// For this context, I'm going to use a bit of a different approach to the one
// I used in the other contexts, in that I'm going to implement the persistence
// operations to the database storage in the context itself. This is to see if
// it's a viable approach to take with the other contexts, and, if successful,
// may isolate the persistence logic from the components that use the context,
// which seems like a good idea to me.

interface ITabsStateContextType {
  tabSpec: ITabSpec[];
  activeTab: string;
  setActiveTab: (tabId: string) => void;
  setTabVisibility: (id: string, visible: boolean) => void;
  setTabSpec: (tabSpec: ITabSpec[]) => void;
}

const TabsStateContext = createContext<ITabsStateContextType | undefined>(
  undefined,
);

export const TabsStateProvider = ({ children }: { children: ReactNode }) => {
  const [tabSpec, setTabSpec] = useState<ITabSpec[]>(initialTabSpec);
  const [activeTab, setActiveTab] = useState<string>(initialTabSpec[0].id);
  const { data: session } = useSession();
  const userId = session?.user?.id ? Number.parseInt(session?.user?.id) : -1;
  const { currentPlaylist: playlistId } = usePlaylist();

  const setTabVisibility = (id: string, visible: boolean) => {
    setTabSpec((prevTabSpec) =>
      prevTabSpec.map((tab) => (tab.id === id ? { ...tab, visible } : tab)),
    );

    if (!visible && activeTab === id) {
      const nextVisibleTab = tabSpec.find(
        (tab) => tab.id !== id && tab.visible,
      );
      if (nextVisibleTab) {
        setActiveTab(nextVisibleTab.id);
      }
    }
  };

  useEffect(() => {
    // If the user is logged in, retrieve the tab group main state from the
    // database, if available, on mount or when the user ID changes.
    const fetchTabGroupMainState = async () => {
      if (userId === -1) {
        // This is a normal state when the user is not logged in
        return;
      }
      try {
        const tabGroupMainState = await getTabGroupMainState(
          userId,
          playlistId,
        );
        if (tabGroupMainState) {
          setTabSpec(
            tabGroupMainState.tab_spec
              ? (tabGroupMainState.tab_spec as ITabSpec[])
              : initialTabSpec,
          );
          setActiveTab(tabGroupMainState.which_tab ?? initialTabSpec[0].id);
        } else {
          setTabSpec(initialTabSpec);
          setActiveTab(initialTabSpec[0].id);
        }
      } catch {
        setTabSpec(initialTabSpec);
        setActiveTab(initialTabSpec[0].id);
        const tabGroupMainStateModel: Partial<ITabGroupMainStateModel> = {
          user_id: userId,
          which_tab: initialTabSpec[0].id,
          tab_spec: initialTabSpec,
        };
        try {
          await createTabGroupMainState(userId, tabGroupMainStateModel);
        } catch (error) {
          console.error("Error creating tab group main state:", error);
          throw error;
        }
        // alert("Error fetching tab group main state (using default state)");
      }
    };
    // fetch in the background
    void fetchTabGroupMainState();
  }, [userId, playlistId]);

  useEffect(() => {
    // Save the tab group main state to the database when the tab spec or active tab changes,
    // but only if the user is logged in.
    const saveTabGroupMainState = async () => {
      if (userId === -1) {
        // This is a normal state when the user is not logged in
        return;
      }
      try {
        const tabGroupMainState = {
          user_id: userId,
          which_tab: activeTab,
          tab_spec: tabSpec,
        };
        await updateTabGroupMainState(userId, tabGroupMainState);
      } catch (error) {
        console.error("Error saving tab group main state:", error);
        alert("Error saving tab group main state");
      }
    };
    // Debounce the save operation to reduce the number of requests to the server
    const debounceSave = setTimeout(() => {
      void saveTabGroupMainState();
    }, 300); // Debounce for 300ms
    return () => clearTimeout(debounceSave); // Cleanup on unmount or state change
  }, [tabSpec, activeTab, userId]);

  return (
    <TabsStateContext.Provider
      value={{ tabSpec, activeTab, setActiveTab, setTabVisibility, setTabSpec }}
    >
      {children}
    </TabsStateContext.Provider>
  );
};

export const useTabsState = () => {
  const context = useContext(TabsStateContext);
  if (context === undefined) {
    throw new Error("useTabsState must be used within a TabsStateProvider");
  }
  return context;
};
