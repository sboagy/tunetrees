"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";

import { getPracticeListScheduled, getRecentlyPracticed } from "./queries";

import type { Tune } from "./types";

import RepertoireGrid from "./components/RepertoireGrid";
import ScheduledTunesGrid from "./components/ScheduledTunesGrid";

function CircularProgress() {
  return (
    <div className="flex justify-center items-center h-32">
      <div className="w-12 h-12 border-t-2 border-b-2 border-gray-900 rounded-full animate-spin" />
    </div>
  );
}

type PracticeProps = {
  user_id: string;
  playlist_id: string;
};

export default function Practice({
  user_id,
  playlist_id,
}: PracticeProps): JSX.Element {
  const [scheduled, setScheduled] = useState<Tune[]>();
  const [recentlyPracticed, setRecentlyPracticed] = useState<Tune[]>();
  // const [progress, setProgress] = React.useState(13);

  //  wrap with useEffect to avoid infinite loop (apparently)
  // biome-ignore lint/correctness/useExhaustiveDependencies: Not sure how to fix this, or if it's a real issue
  useEffect(() => {
    const getScheduled = async (user_id: string, playlist_id: string) => {
      const data = await getPracticeListScheduled(user_id, playlist_id);
      setScheduled(data);
    };
    getScheduled(user_id, playlist_id);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Not sure how to fix this, or if it's a real issue
  useEffect(() => {
    const getRecent = async (user_id: string, playlist_id: string) => {
      const data = await getRecentlyPracticed(user_id, playlist_id);
      setRecentlyPracticed(data);
    };
    getRecent(user_id, playlist_id);
  }, []);

  return (
    <Tabs defaultValue="scheduled" className="flex h-full w-full flex-col">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="scheduled">Practice</TabsTrigger>
        <TabsTrigger value="repertoire">Repertoire</TabsTrigger>
        <TabsTrigger value="analysis">Analysis</TabsTrigger>
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
      <TabsContent value="analysis">
        <Card>
          {/* <CardHeader>
            <CardTitle>Analysis</CardTitle>
            <CardDescription>Overall analysis.</CardDescription>
          </CardHeader> */}
          <CardContent className="space-y-2">
            <p>
              Coming soon: Analysis, will hold visualizations and statistics
            </p>
          </CardContent>
          {/* <CardFooter>
            <Button>Save password</Button>
          </CardFooter> */}
        </Card>
      </TabsContent>
    </Tabs>
  );
}
