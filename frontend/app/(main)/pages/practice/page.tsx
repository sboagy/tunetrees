"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { getPracticeListScheduled, getRecentlyPracticed } from "./queries";

import { Tune } from "./types";

import ScheduledTunesGrid from "./components/ScheduledTunesGrid";
import ScheduledTunesGridOld from "./components/ScheduledTunesGridOld";
import RecentlyPracticed from "./components/RecentlyPracticed";

function CircularProgress() {
  return (
    <div className="flex justify-center items-center h-32">
      <div className="w-12 h-12 border-t-2 border-b-2 border-gray-900 rounded-full animate-spin"></div>
    </div>
  );
}

export default function Practice() {
  let [scheduled, setScheduled] = useState<Tune[]>();
  let [recentlyPracticed, setRecentlyPracticed] = useState<Tune[]>();
  // const [progress, setProgress] = React.useState(13);

  useEffect(() => {
    const getScheduled = async () => {
      const data = await getPracticeListScheduled();
      setScheduled(data);
    };
    getScheduled();
  }, []);

  useEffect(() => {
    const getRecent = async () => {
      const data = await getRecentlyPracticed();
      setRecentlyPracticed(data);
    };
    getRecent();
  }, []);

  return (
    <Tabs defaultValue="scheduled" className="flex h-full w-full flex-col">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="scheduled">Scheduled for Practice</TabsTrigger>
        <TabsTrigger value="repertoire">Repertoire</TabsTrigger>
        {/* <TabsTrigger value="xxx">Material-ui Grid</TabsTrigger> */}
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
              <RecentlyPracticed tunes={recentlyPracticed} />
            ) : (
              <CircularProgress />
            )}
          </CardContent>
          {/* <CardFooter>
            <Button>Save password</Button>
          </CardFooter> */}
        </Card>
      </TabsContent>

      <TabsContent value="xxx">
        <Card>
          {/* <CardHeader>
            <CardTitle>Scheduled for Practice (Material-ui Grid)</CardTitle>
            <CardDescription>Older grid for reference.</CardDescription>
          </CardHeader> */}
          <CardContent className="space-y-2">
            {scheduled ? (
              <ScheduledTunesGridOld tunes={scheduled} />
            ) : (
              <CircularProgress />
            )}
          </CardContent>
          {/* <CardFooter>
            <Button>Save changes</Button>
          </CardFooter> */}
        </Card>
      </TabsContent>
    </Tabs>
  );
}
