"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";

import { getPracticeListScheduled, getRecentlyPracticed } from "./queries";

import type { Tune } from "./types";

import RepertoireGrid from "./components/RepertoireGrid";
import ScheduledTunesGrid from "./components/ScheduledTunesGrid";
import type { NextPage } from "next";

function CircularProgress() {
  return (
    <div className="flex justify-center items-center h-32">
      <div className="w-12 h-12 border-t-2 border-b-2 border-gray-900 rounded-full animate-spin" />
    </div>
  );
}

interface PracticeProps {
  user_id: string;
  playlist_id: string;
}

const Practice: NextPage<PracticeProps> = ({
  user_id,
  playlist_id,
}): JSX.Element => {
  const [playlist_ref] = useState<string>(playlist_id);
  const [user_ref] = useState<string>(user_id);
  const [scheduled, setScheduled] = useState<Tune[]>();
  const [recentlyPracticed, setRecentlyPracticed] = useState<Tune[]>();

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
    };
    getRecent(user_id, playlist_id);
  }, [user_id, playlist_id]);

  return (
    <Tabs defaultValue="scheduled" className="flex h-full w-full flex-col">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="scheduled">Practice</TabsTrigger>
        <TabsTrigger value="repertoire">Repertoire</TabsTrigger>
        <TabsTrigger value="analysis">Analysis</TabsTrigger>
      </TabsList>
      <TabsContent value="scheduled">
        <Card>
          <CardContent className="space-y-2">
            {scheduled ? (
              <ScheduledTunesGrid
                tunes={scheduled}
                user_id={user_ref}
                playlist_id={playlist_ref}
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
                user_id={user_ref}
                playlist_id={playlist_ref}
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

export default Practice;
