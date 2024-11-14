// TabGroupMain.tsx
"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import RepertoireGrid from "./RepertoireGrid";
import ScheduledTunesGrid from "./ScheduledTunesGrid";
import {
  getTabGroupMainState,
  type ITabGroupMainStateModel,
  updateTabGroupMainState,
} from "../settings";

interface IPracticeProps {
  userId: number;
  playlistId: number;
}

const tabSpec = [
  {
    id: "scheduled",
    name: "Practice",
    content: "Review and practice your scheduled tunes.",
  },
  { id: "repertoire", name: "Repertoire", content: "Manage your repertoire." },
  { id: "analysis", name: "Analysis", content: "Practice Analytics." },
];

export default function TabGroupMain({
  userId,
  playlistId,
}: IPracticeProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const changeActiveTab = (whichTag: string) => {
    setActiveTab(whichTag);
    const tabGroupMainState: ITabGroupMainStateModel = {
      user_id: userId,
      which_tab: whichTag,
    };
    void updateTabGroupMainState(userId, tabGroupMainState);
  };

  useEffect(() => {
    const doInitialization = async () => {
      try {
        console.log("Initializing...");
        const tabGroupMainState: ITabGroupMainStateModel | null =
          await getTabGroupMainState(userId);
        if (tabGroupMainState !== null) {
          setActiveTab(tabGroupMainState.which_tab);
        } else {
          setActiveTab(tabSpec[0].id);
        }
      } catch (error) {
        console.error("Error fetching active tab:", error);
      }
    };
    void doInitialization();
  }, [userId]);

  return (
    <Tabs
      defaultValue={activeTab || "scheduled"}
      onValueChange={changeActiveTab}
      className="flex h-full w-full flex-col"
    >
      <TabsList
        id="tt-tabs"
        className="grid w-full grid-cols-3 rounded-none bg-transparent p-0 gap-2"
      >
        {tabSpec.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className={`rounded-t-lg border-t border-l border-r border-gray-300 px-4 py-2 text-sm font-medium transition-colors duration-200 ${activeTab === tab.id ? "bg-gray-500 text-gray-900" : "bg-gray-900 text-gray-100 hover:bg-gray-600"}`}
          >
            {tab.name}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="scheduled">
        <Card>
          <CardContent className="space-y-2">
            <ScheduledTunesGrid userId={userId} playlistId={playlistId} />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="repertoire">
        <Card>
          <CardContent className="space-y-2">
            <RepertoireGrid userId={userId} playlistId={playlistId} />
          </CardContent>
        </Card>
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
