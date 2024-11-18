"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import {
  type ITabGroupMainStateModel,
  getTabGroupMainState,
  updateTabGroupMainState,
} from "../settings";
import RepertoireGrid from "./RepertoireGrid";
import ScheduledTunesGrid from "./ScheduledTunesGrid";
import { TunesProvider } from "./TunesContext";

interface IPracticeProps {
  userId: number;
  playlistId: number;
  onEditTune: (tuneId: number) => void;
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
  onEditTune,
}: IPracticeProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<string>("scheduled");

  const changeActiveTab = (whichTag: string) => {
    console.log("tabGroupMainState changeActiveTab:", whichTag);
    setActiveTab(whichTag);
    const tabGroupMainState: ITabGroupMainStateModel = {
      user_id: userId,
      which_tab: whichTag,
    };
    console.log(
      "tabGroupMainState updateTabGroupMainState:",
      tabGroupMainState.which_tab,
    );
    void updateTabGroupMainState(userId, tabGroupMainState);
  };

  useEffect(() => {
    const doInitialization = async () => {
      try {
        console.log("Initializing...");
        const tabGroupMainState: ITabGroupMainStateModel | null =
          await getTabGroupMainState(userId);
        if (tabGroupMainState !== null) {
          console.log("tabGroupMainState (init):", tabGroupMainState.which_tab);
          setActiveTab(tabGroupMainState.which_tab);
        } else {
          console.log("tabGroupMainState tabSpec[0].id:", tabSpec[0].id);
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
      value={activeTab}
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
            <ScheduledTunesGrid
              userId={userId}
              playlistId={playlistId}
              onEditTune={onEditTune}
            />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="repertoire">
        <Card>
          <CardContent className="space-y-2">
            <TunesProvider>
              <RepertoireGrid
                userId={userId}
                playlistId={playlistId}
                onEditTune={onEditTune}
              />
            </TunesProvider>
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
