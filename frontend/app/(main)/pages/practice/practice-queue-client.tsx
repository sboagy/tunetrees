"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { IPracticeQueueWithMeta, IPracticeQueueEntry } from "./types";
import { refillPracticeQueue } from "./queries";

interface IProps {
  queue: IPracticeQueueWithMeta;
}

function groupByBucket(
  entries: IPracticeQueueEntry[],
): Record<number, IPracticeQueueEntry[]> {
  return entries.reduce<Record<number, IPracticeQueueEntry[]>>((acc, e) => {
    acc[e.bucket] = acc[e.bucket] || [];
    acc[e.bucket].push(e);
    return acc;
  }, {});
}

export default function PracticeQueueClient({ queue }: IProps) {
  const [showCompleted, setShowCompleted] = useState(true);
  const [entries, setEntries] = useState<IPracticeQueueEntry[]>(queue.entries);
  const grouped = useMemo(() => groupByBucket(entries), [entries]);
  const router = useRouter();
  const params = useSearchParams();
  const [refillLoading, setRefillLoading] = useState(false);

  const handleForceRefresh = () => {
    const newParams = new URLSearchParams(params.toString());
    newParams.set("force_regen", "1");
    // Add a cache-busting timestamp to ensure server revalidation
    newParams.set("_", Date.now().toString());
    router.replace(`?${newParams.toString()}`);
  };

  const bucketMeta: Record<
    number,
    { title: string; description: string; color: string }
  > = {
    1: {
      title: "Due Today",
      description: "Scheduled for current day",
      color: "border-green-500",
    },
    2: {
      title: "Recently Lapsed",
      description: "Within delinquency window",
      color: "border-amber-500",
    },
    3: {
      title: "Backfill",
      description: "Older backlog beyond window",
      color: "border-slate-500",
    },
  };

  const handleRefill = async (): Promise<void> => {
    if (refillLoading) return;
    try {
      setRefillLoading(true);
      // Derive sitdown date from window_start_utc first entry (fallback now)
      const first = entries[0];
      const sitdownIso = first?.window_start_utc || new Date().toISOString();
      const sitdownDate = new Date(sitdownIso);
      const userId = first?.user_ref;
      const playlistId = first?.playlist_ref;
      if (!userId || !playlistId) {
        console.warn("Refill skipped: missing user or playlist id");
        return;
      }
      const newRows = await refillPracticeQueue(
        userId,
        playlistId,
        sitdownDate,
        5,
      );
      if (newRows.length > 0) {
        setEntries((prev) =>
          [...prev, ...newRows].sort((a, b) => a.order_index - b.order_index),
        );
      }
    } finally {
      setRefillLoading(false);
    }
  };

  const renderEntry = (e: IPracticeQueueEntry) => {
    const completed = !!e.completed_at;
    if (!showCompleted && completed) return null;
    return (
      <li
        key={e.id}
        className={`flex items-center justify-between rounded border px-3 py-2 text-sm mb-1 ${completed ? "opacity-60 line-through" : ""}`}
        data-testid={`practice-queue-item-${e.tune_ref}`}
      >
        <span>
          {e.tune_title ? (
            <>
              <span className="font-medium">{e.tune_title}</span>
              <span className="ml-2 text-xs text-slate-500">
                # {e.tune_ref}
              </span>
            </>
          ) : (
            <>Tune #{e.tune_ref}</>
          )}
          <span className="ml-2 text-xs text-slate-500">
            (order {e.order_index})
          </span>
        </span>
        {completed ? (
          <span
            className="text-xs text-green-600"
            data-testid="practice-queue-item-completed"
          >
            Done
          </span>
        ) : (
          <span className="text-xs text-blue-600">Pending</span>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-6" data-testid="practice-queue-root">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-medium">New tunes due since snapshot:</span>{" "}
          <span data-testid="practice-queue-new-count">
            {queue.new_tunes_due_count}
          </span>
        </div>
        <button
          type="button"
          onClick={handleForceRefresh}
          className="rounded bg-blue-100 px-2 py-1 text-xs hover:bg-blue-200"
          data-testid="practice-queue-force-regen"
        >
          Force Regenerate
        </button>
        <button
          type="button"
          onClick={() => setShowCompleted((v) => !v)}
          className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
          data-testid="practice-queue-toggle-completed"
        >
          {showCompleted ? "Hide Completed" : "Show Completed"}
        </button>
        <button
          type="button"
          onClick={() => {
            // Fire and forget; internal state handles loading
            void handleRefill();
          }}
          disabled={refillLoading}
          className="rounded bg-amber-100 px-2 py-1 text-xs hover:bg-amber-200 disabled:opacity-50"
          data-testid="practice-queue-refill"
        >
          {refillLoading ? "Refilling..." : "Refill Backlog"}
        </button>
      </div>
      {[1, 2, 3].map((bucket) => {
        const items = grouped[bucket] || [];
        return (
          <section key={bucket} data-testid={`practice-queue-bucket-${bucket}`}>
            <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
              <span>{bucketMeta[bucket].title}</span>
              <span className="text-xs font-normal text-slate-500">
                {bucketMeta[bucket].description}
              </span>
              <span
                className={`inline-block h-2 w-2 rounded-full border ${bucketMeta[bucket].color}`}
              />
              <span className="text-xs text-slate-500">({items.length})</span>
            </h2>
            {items.length === 0 ? (
              <div className="text-xs text-slate-500 mb-4">
                No tunes in this bucket.
              </div>
            ) : (
              <ul
                className="mb-4"
                data-testid={`practice-queue-list-${bucket}`}
              >
                {items.map(renderEntry)}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
