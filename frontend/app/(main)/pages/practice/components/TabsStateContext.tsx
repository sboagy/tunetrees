import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";

export interface ITabSpec {
  id: string;
  name: string;
  content: string;
  visible: boolean;
}

interface ITabsStateContextType {
  tabSpec: ITabSpec[];
  activeTab: string;
  setActiveTab: (tabId: string) => void;
  setTabVisibility: (id: string, visible: boolean) => void;
}

const TabsStateContext = createContext<ITabsStateContextType | undefined>(
  undefined,
);

const initialTabSpec: ITabSpec[] = [
  {
    id: "scheduled",
    name: "Practice",
    content: "Review and practice your scheduled tunes.",
    visible: true,
  },
  {
    id: "repertoire",
    name: "Repertoire",
    content: "Manage your repertoire.",
    visible: true,
  },
  {
    id: "all",
    name: "All",
    content: "Add tunes to repertoire from TuneTrees Database.",
    visible: true,
  },
  {
    id: "analysis",
    name: "Analysis",
    content: "Practice Analytics.",
    visible: true,
  },
];

export const TabsStateProvider = ({ children }: { children: ReactNode }) => {
  const [tabSpec, setTabSpec] = useState<ITabSpec[]>(initialTabSpec);
  const [activeTab, setActiveTab] = useState<string>(initialTabSpec[0].id);

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

  return (
    <TabsStateContext.Provider
      value={{ tabSpec, activeTab, setActiveTab, setTabVisibility }}
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
