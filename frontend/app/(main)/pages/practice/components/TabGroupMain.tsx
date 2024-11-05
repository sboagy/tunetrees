"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";

import type { Tune } from "../types";

import RepertoireGrid from "./RepertoireGrid";
import ScheduledTunesGrid from "./ScheduledTunesGrid";
import {
  getTabGroupMainState,
  type ITabGroupMainStateModel,
  updateTabGroupMainState,
} from "../settings";

function CircularProgress() {
  return (
    <div className="flex justify-center items-center h-32">
      <div className="w-12 h-12 border-t-2 border-b-2 border-gray-900 rounded-full animate-spin" />
    </div>
  );
}

interface IPracticeProps {
  user_id: string;
  playlist_id: string;
  setCurrentTune: (tuneId: number | null) => void; // Add setCurrentTune prop
  loading: boolean;
  scheduled: Tune[] | undefined;
  recentlyPracticed: Tune[] | undefined;
  refreshData: () => Promise<{
    scheduledData: Tune[];
    repertoireData: Tune[];
  }>;
}

const tabSpec = [
  {
    id: "scheduled",
    name: "Practice",
    content: "Review and practice your scheduled tunes.",
  },
  {
    id: "repertoire",
    name: "Repertoire",
    content: "Manage your repertoire.",
  },
  {
    id: "analysis",
    name: "Analysis",
    content: "Practice Analytics.",
  },
];

export default function TabGroupMain({
  user_id,
  playlist_id,
  setCurrentTune, // Destructure setCurrentTune
  loading,
  scheduled,
  recentlyPracticed,
  refreshData,
}: IPracticeProps): JSX.Element {
  const [playlistRef] = useState<string>(playlist_id);
  const [userRef] = useState<string>(user_id);
  // const [origRecentlyPracticed, setOrigRecentlyPracticed] = useState<Tune[]>();

  const [activeTab, setActiveTab] = useState<string | null>(null);

  const changeActiveTab = (whichTag: string) => {
    setActiveTab(whichTag);
    const userIdInt = Number.parseInt(user_id, 10);
    const tabGroupMainState: ITabGroupMainStateModel = {
      user_id: userIdInt,
      which_tab: whichTag,
    };
    void updateTabGroupMainState(userIdInt, tabGroupMainState);
  };

  useEffect(() => {
    const doInitialization = async (user_id: string) => {
      try {
        console.log("Initializing...");
        const userIdInt = Number.parseInt(user_id, 10);
        const tabGroupMainState: ITabGroupMainStateModel | null =
          await getTabGroupMainState(userIdInt);
        if (tabGroupMainState !== null) {
          setActiveTab(tabGroupMainState.which_tab);
        } else {
          setActiveTab(tabSpec[0].id);
        }
      } catch (error) {
        console.error("Error fetching active tab:", error);
      }
    };
    void doInitialization(user_id);
  }, [user_id]);

  // useEffect(() => {
  //   const getScheduled = async (user_id: string, playlist_id: string) => {
  //     const data = await getPracticeListScheduled(user_id, playlist_id);
  //     setScheduled(data);
  //   };
  //   void getScheduled(user_id, playlist_id);
  // }, [user_id, playlist_id]);

  // useEffect(() => {
  //   const getRecent = async (user_id: string, playlist_id: string) => {
  //     const data = await getRecentlyPracticed(user_id, playlist_id);
  //     setRecentlyPracticed(data);
  //     setOrigRecentlyPracticed(data);
  //   };
  //   void getRecent(user_id, playlist_id);
  // }, [user_id, playlist_id]);

  if (loading) {
    return <div>Loading...</div>; // Render a loading state while fetching data
  }

  return (
    <Tabs
      defaultValue={activeTab || "scheduled"}
      onValueChange={changeActiveTab}
      className="flex h-full w-full flex-col"
    >
      <TabsList className="grid w-full grid-cols-3 rounded-none bg-transparent p-0 gap-2">
        {tabSpec.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className={`rounded-t-lg border-t border-l border-r border-gray-300 px-4 py-2 text-sm font-medium transition-colors duration-200
          ${activeTab === tab.id ? "bg-gray-500 text-gray-900" : "bg-gray-900 text-gray-100 hover:bg-gray-600"}`}
          >
            {tab.name}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="scheduled">
        <Card>
          <CardContent className="space-y-2">
            {scheduled ? (
              <ScheduledTunesGrid
                tunes={scheduled}
                user_id={userRef}
                playlist_id={playlistRef}
                table_purpose="practice"
                refreshData={refreshData}
                setCurrentTune={setCurrentTune} // Pass setCurrentTune to ScheduledTunesGrid
              />
            ) : (
              <CircularProgress />
            )}
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="repertoire">
        <Card>
          <CardContent className="space-y-2">
            {recentlyPracticed ? (
              <RepertoireGrid
                tunes={recentlyPracticed}
                user_id={userRef}
                playlist_id={playlistRef}
                table_purpose="repertoire"
                refreshData={refreshData}
                setCurrentTune={setCurrentTune} // Pass setCurrentTune to RepertoireGrid
              />
            ) : (
              <CircularProgress />
            )}
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
