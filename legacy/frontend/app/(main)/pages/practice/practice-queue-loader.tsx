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
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    try {
      const d = getSitdownDateFromBrowser();
      setSitdownDate(d);
      setLoading(true);
      getPracticeQueueAction(userId, playlistId, d, forceRegen)
        .then((q) => setQueue(q))
        .catch((error_) => setError(String(error_)))
        .finally(() => setLoading(false));
    } catch (error_) {
      setError(String(error_ as Error));
    }
  }, [userId, playlistId, forceRegen]);

  // Helpers -----------------------------------------------------------
  const toLocalYmd = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const makeLocalDateNoon = (year: number, monthIndex: number, day: number) =>
    new Date(year, monthIndex, day, 12, 0, 0, 0);

  const setAndFetch = async (d: Date) => {
    try {
      setLoading(true);
      // Persist for all practice routes to read consistently
      window.localStorage.setItem("TT_REVIEW_SITDOWN_DATE", d.toISOString());
      setSitdownDate(d);
      const q = await getPracticeQueueAction(userId, playlistId, d, false);
      setQueue(q);
      setError(null);
    } catch (error_) {
      setError(String(error_));
    } finally {
      setLoading(false);
    }
  };

  const changeByDays = (delta: number) => {
    const base = sitdownDate ?? new Date();
    const next = makeLocalDateNoon(
      base.getFullYear(),
      base.getMonth(),
      base.getDate() + delta,
    );
    void setAndFetch(next);
  };

  const goToday = () => {
    const now = new Date();
    const next = makeLocalDateNoon(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    void setAndFetch(next);
  };

  const onDatePickerChange = (value: string) => {
    if (!value) return;
    const [y, m, d] = value.split("-").map((v) => Number(v));
    if (!y || !m || !d) return;
    const next = makeLocalDateNoon(y, m - 1, d);
    void setAndFetch(next);
  };

  const localDateString = sitdownDate
    ? sitdownDate.toLocaleString()
    : "Loading date...";

  // Banners -----------------------------------------------------------
  const now = new Date();
  const localTodayNoon = makeLocalDateNoon(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const localTomorrowNoon = makeLocalDateNoon(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  const isPreviewTomorrow =
    !!sitdownDate && toLocalYmd(sitdownDate) === toLocalYmd(localTomorrowNoon);
  const isLateNight = now.getHours() >= 0 && now.getHours() < 3;
  const isLookingAtToday =
    !!sitdownDate && toLocalYmd(sitdownDate) === toLocalYmd(localTodayNoon);

  return (
    <div className="space-y-4" data-testid="practice-queue-loader-root">
      <div className="flex flex-col gap-2">
        <div
          className="text-sm text-muted-foreground"
          data-testid="effective-sitdown-date"
        >
          Effective Sitdown: {localDateString}
          {loading ? <span className="ml-2 text-xs">(loading…)</span> : null}
        </div>
        <div
          className="flex items-center gap-2"
          data-testid="practice-queue-date-nav"
        >
          <button
            type="button"
            onClick={() => changeByDays(-1)}
            className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
            data-testid="practice-queue-nav-prev"
          >
            Previous Day
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
            data-testid="practice-queue-nav-today"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => changeByDays(1)}
            className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
            data-testid="practice-queue-nav-next-preview"
            title="Preview tomorrow's queue (snapshot will be generated)"
          >
            Tomorrow (Preview)
          </button>
          <div className="ml-2 text-xs text-slate-500">or pick date:</div>
          <input
            type="date"
            className="rounded border px-2 py-1 text-xs"
            value={sitdownDate ? toLocalYmd(sitdownDate) : ""}
            onChange={(e) => onDatePickerChange(e.target.value)}
            data-testid="practice-queue-date-input"
          />
        </div>
        {isPreviewTomorrow && (
          <div
            className="text-xs text-amber-600"
            data-testid="practice-queue-preview-banner"
          >
            Preview mode: tomorrow's snapshot depends on completing today's
            reviews.
          </div>
        )}
        {isLateNight && isLookingAtToday && (
          <div
            className="flex items-center gap-2 text-xs text-slate-600"
            data-testid="practice-queue-finish-yesterday"
          >
            Practicing after midnight? You can finish yesterday's queue.
            <button
              type="button"
              onClick={() => changeByDays(-1)}
              className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200"
              data-testid="practice-queue-finish-yesterday-button"
            >
              Switch to Yesterday
            </button>
          </div>
        )}
      </div>
      {error && (
        <div className="text-red-500" data-testid="practice-queue-error">
          {error}
        </div>
      )}
      {loading && <div data-testid="practice-queue-loading">Loading...</div>}
      {queue && <PracticeQueueClient queue={queue} />}
    </div>
  );
}
