"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { getPracticeListScheduled, getRecentlyPracticed } from "./queries";

import { Tune } from "./types";

import ScheduledTunesGrid from "./components/ScheduledTunesGrid";
import RepertoireGrid from "./components/RepertoireGrid";

function CircularProgress() {
  return (
    <div className="flex justify-center items-center h-32">
      <div className="w-12 h-12 border-t-2 border-b-2 border-gray-900 rounded-full animate-spin"></div>
    </div>
  );
}

type PracticeProps = {
  user_id: string;
  playlist_id: string;
};

export default function Practice({ user_id, playlist_id }: PracticeProps): JSX.Element {
  let [scheduled, setScheduled] = useState<Tune[]>();
  let [recentlyPracticed, setRecentlyPracticed] = useState<Tune[]>();
  // const [progress, setProgress] = React.useState(13);

  useEffect(() => {
    const getScheduled = async () => {
      const data = await getPracticeListScheduled(user_id, playlist_id);
      setScheduled(data);
    };
    getScheduled();
  }, []);

  useEffect(() => {
    const getRecent = async () => {
      const data = await getRecentlyPracticed(user_id, playlist_id);
      setRecentlyPracticed(data);
    };
    getRecent();
  }, []);

  return (
    <Tabs defaultValue="scheduled" className="flex h-full w-full flex-col">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="scheduled">Scheduled for Practice</TabsTrigger>
        <TabsTrigger value="repertoire">Repertoire</TabsTrigger>
      </TabsList>
      <TabsContent value="scheduled">
        <Card>
          {/* <CardHeader>
            <CardTitle>Scheduled for Practice</CardTitle>
            <CardDescription>Daily Review.</CardDescription>
          </CardHeader> */}
          <CardContent className="space-y-2">
            {scheduled ? (
              <ScheduledTunesGrid tunes={scheduled} />
            ) : (
              <CircularProgress />
            )}
          </CardContent>
          {/* <CardFooter>
            <Button>Save changes</Button>
          </CardFooter> */}
        </Card>
      </TabsContent>
      <TabsContent value="repertoire">
        <Card>
          {/* <CardHeader>
            <CardTitle>Repertoire</CardTitle>
            <CardDescription>Overall repertoire.</CardDescription>
          </CardHeader> */}
          <CardContent className="space-y-2">
            {recentlyPracticed ? (
              <RepertoireGrid tunes={recentlyPracticed} />
            ) : (
              <CircularProgress />
            )}
          </CardContent>
          {/* <CardFooter>
            <Button>Save password</Button>
          </CardFooter> */}
        </Card>
      </TabsContent>
    </Tabs>
  );
}
