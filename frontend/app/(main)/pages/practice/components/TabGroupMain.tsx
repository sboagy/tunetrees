"use client";
import type { ITabSpec } from "@/app/(main)/pages/practice/tab-spec";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { JSX } from "react";
import type { ITabGroupMainStateModel } from "../settings";
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

  const { tabSpec, activeTab, setActiveTab } = useTabsState(); // Use the context

  const changeActiveTab = (whichTag: string) => {
    console.log("tabGroupMainState changeActiveTab:", whichTag);
    setActiveTab(whichTag);
    const tabGroupMainState: Partial<ITabGroupMainStateModel> = {
      user_id: userId,
      which_tab: whichTag,
    };
    console.log(
      "tabGroupMainState updateTabGroupMainState:",
      tabGroupMainState.which_tab,
    );
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={changeActiveTab}
      className="flex h-full w-full flex-col"
    >
      <TabsList
        id="tt-tabs"
        className="grid w-full grid-cols-4 rounded-none bg-transparent p-0 gap-2"
      >
        {tabSpec
          .filter((tab) => tab.visible)
          .map(
            (
              tab: ITabSpec, // Ensure tab is typed as ITabSpec
            ) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={`rounded-t-lg border-t border-l border-r border-gray-300 px-4 py-2 text-sm font-medium transition-colors duration-200 ${activeTab === tab.id ? "bg-gray-500 text-gray-900" : "bg-gray-900 text-gray-100 hover:bg-gray-600"}`}
              >
                {tab.name}
              </TabsTrigger>
            ),
          )}
      </TabsList>
      <TabsContent value="scheduled">
        <TunesGridScheduled userId={userId} />
      </TabsContent>
      <TabsContent value="repertoire">
        <TunesGridRepertoire userId={userId} />
      </TabsContent>
      <TabsContent value="all">
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
