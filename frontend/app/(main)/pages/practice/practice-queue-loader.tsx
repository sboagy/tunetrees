"use client";

import { useEffect, useState } from "react";
import { getPracticeQueueAction } from "./actions/practice-actions";
import PracticeQueueClient from "./practice-queue-client";
import { getSitdownDateFromBrowser } from "./components/SitdownDateProvider";
import type { IPracticeQueueWithMeta } from "./types";

interface IPracticeQueueLoaderProps {
  userId: number;
  playlistId: number;
  forceRegen: boolean;
}

export default function PracticeQueueLoader({
  userId,
  playlistId,
  forceRegen,
}: IPracticeQueueLoaderProps) {
  const [queue, setQueue] = useState<IPracticeQueueWithMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sitdownDate, setSitdownDate] = useState<Date | null>(null);

  useEffect(() => {
    try {
      const d = getSitdownDateFromBrowser();
      setSitdownDate(d);
      getPracticeQueueAction(userId, playlistId, d, forceRegen)
        .then((q) => setQueue(q))
        .catch((error_) => setError(String(error_)));
    } catch (error_) {
      setError(String(error_ as Error));
    }
  }, [userId, playlistId, forceRegen]);

  const localDateString = sitdownDate
    ? sitdownDate.toLocaleString()
    : "Loading date...";

  return (
    <div className="space-y-4" data-testid="practice-queue-loader-root">
      <div
        className="text-sm text-muted-foreground"
        data-testid="effective-sitdown-date"
      >
        Effective Sitdown: {localDateString}
      </div>
      {error && (
        <div className="text-red-500" data-testid="practice-queue-error">
          {error}
        </div>
      )}
      {!queue && !error && (
        <div data-testid="practice-queue-loading">Loading...</div>
      )}
      {queue && <PracticeQueueClient queue={queue} />}
    </div>
  );
}
