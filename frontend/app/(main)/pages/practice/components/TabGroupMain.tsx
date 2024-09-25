"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";

import { getPracticeListScheduled, getRecentlyPracticed } from "../queries";

import type { Tune } from "../types";

import RepertoireGrid from "./RepertoireGrid";
import ScheduledTunesGrid from "./ScheduledTunesGrid";
import type { NextPage } from "next";

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
}

const tabGroupMain: NextPage<IPracticeProps> = ({
  user_id,
  playlist_id,
}): JSX.Element => {
  const [playlistRef] = useState<string>(playlist_id);
  const [userRef] = useState<string>(user_id);
  const [scheduled, setScheduled] = useState<Tune[]>();
  const [recentlyPracticed, setRecentlyPracticed] = useState<Tune[]>();
  const [origRecentlyPracticed, setOrigRecentlyPracticed] = useState<Tune[]>();

  const handleFilterChange = (filter: React.ChangeEvent<HTMLInputElement>) => {
    if (origRecentlyPracticed === undefined) return;
    const filterValue = filter.target.value;

    const filteredData = origRecentlyPracticed.filter((item) =>
      Object.values(item).some((value) =>
        value
          ? value.toString().toLowerCase().includes(filterValue.toLowerCase())
          : false,
      ),
    );
    setRecentlyPracticed(filteredData);
  };

  useEffect(() => {
    const getScheduled = async (user_id: string, playlist_id: string) => {
      const data = await getPracticeListScheduled(user_id, playlist_id);
      setScheduled(data);
    };
    getScheduled(user_id, playlist_id);
  }, [user_id, playlist_id]);

  useEffect(() => {
    const getRecent = async (user_id: string, playlist_id: string) => {
      const data = await getRecentlyPracticed(user_id, playlist_id);
      setRecentlyPracticed(data);
      setOrigRecentlyPracticed(data);
    };
    getRecent(user_id, playlist_id);
  }, [user_id, playlist_id]);

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

  const [activeTab, setActiveTab] = useState(tabSpec[0].id);

  return (
    <Tabs
      defaultValue="scheduled"
      onValueChange={setActiveTab}
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
      {/* <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="scheduled">Practice</TabsTrigger>
        <TabsTrigger value="repertoire">Repertoire</TabsTrigger>
        <TabsTrigger value="analysis">Analysis</TabsTrigger>
      </TabsList> */}
      <TabsContent value="scheduled">
        <Card>
          <CardContent className="space-y-2">
            {scheduled ? (
              <ScheduledTunesGrid
                tunes={scheduled}
                user_id={userRef}
                playlist_id={playlistRef}
                table_purpose="practice"
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
                handleFilterChange={handleFilterChange}
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
};

export default tabGroupMain;
