"use client";
import type { ITabSpec } from "@/app/(main)/pages/practice/tab-spec";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { JSX } from "react";
import TabsMenu from "./TabsMenu";
import { useTabsState } from "./TabsStateContext";
import TunesGridCatalog from "./TunesGridCatalog";
import TunesGridRepertoire from "./TunesGridRepertoire";
import TunesGridScheduled from "./TunesGridScheduled";

interface IPracticeProps {
  userId: number;
  playlistId: number;
}

export default function TabGroupMain({ userId }: IPracticeProps): JSX.Element {
  console.log("LF1: TabGroupMain Rendering...");

  const { tabSpec, activeTab, tabsContextLoading, setActiveTab } =
    useTabsState(); // Use the context

  const changeActiveTab = (whichTag: string) => {
    console.log("tabGroupMainState changeActiveTab:", whichTag);
    setActiveTab(whichTag);
  };

  if (tabsContextLoading) {
    return <p>Loading...</p>;
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={changeActiveTab}
      className="flex h-full w-full flex-col"
    >
      <TabsList id="tt-tabs" className="bg-transparent">
        {tabSpec
          .filter((tab) => tab.visible)
          .map(
            (
              tab: ITabSpec, // Ensure tab is typed as ITabSpec
            ) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={`w-80 rounded-t-lg border-t border-l border-r border-gray-300 px-4 py-2 text-sm font-medium transition-colors duration-200 ${activeTab === tab.id ? "bg-gray-500 text-gray-900" : "bg-gray-900 text-gray-100 hover:bg-gray-600"}`}
              >
                {tab.name}
              </TabsTrigger>
            ),
          )}
        <TabsMenu />
      </TabsList>
      <TabsContent value="scheduled">
        <TunesGridScheduled userId={userId} />
      </TabsContent>
      <TabsContent value="repertoire">
        <TunesGridRepertoire userId={userId} />
      </TabsContent>
      <TabsContent value="catalog">
        <TunesGridCatalog userId={userId} />
      </TabsContent>
      <TabsContent value="analysis">
        <Card>
          <CardContent className="space-y-2">
            <p>
              Coming soon: Analysis, will hold visualizations and statistics
            </p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
