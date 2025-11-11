"use client";

import { CalendarDays, ChevronDown } from "lucide-react";
import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { getSitdownDateFromBrowser } from "./SitdownDateProvider";

interface IPracticeDateChooserProps {
  value: Date | null;
  onChange: (d: Date) => void;
  // When all tunes in today's queue are submitted, label should be plain "Tomorrow"
  allSubmittedToday?: boolean;
}

const makeLocalDateNoon = (y: number, mIdx: number, d: number) =>
  new Date(y, mIdx, d, 12, 0, 0, 0);

const toLocalYmd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export default function PracticeDateChooser({
  value,
  onChange,
  allSubmittedToday = false,
}: IPracticeDateChooserProps) {
  // Base date must always come from getSitdownDateFromBrowser, never the currently chosen value.
  const sitdownBaseNoon = useMemo(() => {
    const base = new Date(getSitdownDateFromBrowser());
    return makeLocalDateNoon(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
    );
  }, []);

  const prevDayNoon = useMemo(() => {
    return makeLocalDateNoon(
      sitdownBaseNoon.getFullYear(),
      sitdownBaseNoon.getMonth(),
      sitdownBaseNoon.getDate() - 1,
    );
  }, [sitdownBaseNoon]);
  const nextDayNoon = useMemo(() => {
    return makeLocalDateNoon(
      sitdownBaseNoon.getFullYear(),
      sitdownBaseNoon.getMonth(),
      sitdownBaseNoon.getDate() + 1,
    );
  }, [sitdownBaseNoon]);

  const isSameYmd = useCallback(
    (a: Date | null | undefined, b: Date | null | undefined) => {
      if (!a || !b) return false;
      return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
      );
    },
    [],
  );

  const nextLabel = allSubmittedToday ? "Tomorrow" : "Tomorrow (Preview)";
  const triggerLabel = useMemo(() => {
    const v = value ?? sitdownBaseNoon;
    if (isSameYmd(v, sitdownBaseNoon)) return "Today";
    if (isSameYmd(v, prevDayNoon)) return "Yesterday";
    if (isSameYmd(v, nextDayNoon)) return nextLabel;
    return toLocalYmd(v);
  }, [value, sitdownBaseNoon, prevDayNoon, nextDayNoon, nextLabel, isSameYmd]);

  return (
    <div
      className="flex items-center gap-2"
      data-testid="practice-date-chooser"
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-7 px-2 text-xs">
            <CalendarDays className="h-4 w-4 mr-1" />
            {triggerLabel}
            <ChevronDown className="h-4 w-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[12rem]">
          <DropdownMenuItem
            onClick={() => onChange(prevDayNoon)}
            data-testid="datechooser-prev"
          >
            Yesterday
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onChange(sitdownBaseNoon)}
            data-testid="datechooser-today"
          >
            Today
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onChange(nextDayNoon)}
            title={
              allSubmittedToday
                ? "Switch to tomorrow's queue"
                : "Preview tomorrow's queue (snapshot will be generated)"
            }
            data-testid="datechooser-next"
          >
            {nextLabel}
          </DropdownMenuItem>
          <div className="px-2 py-1.5">
            <Input
              type="date"
              className="h-7 text-xs"
              value={value ? toLocalYmd(value) : ""}
              max={toLocalYmd(nextDayNoon)}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                const [y, m, d] = v.split("-").map((t) => Number(t));
                if (!y || !m || !d) return;
                const picked = makeLocalDateNoon(y, m - 1, d);
                // Restrict to <= tomorrow (preview)
                if (picked > nextDayNoon) {
                  onChange(nextDayNoon);
                } else {
                  onChange(picked);
                }
              }}
              data-testid="datechooser-input"
            />
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              if (
                !confirm(
                  "Reset active queues? This will regenerate snapshots on next access.",
                )
              ) {
                return;
              }
              try {
                interface IGlobalWithIds extends Window {
                  __TT_USER_ID__?: string;
                  __TT_PLAYLIST_ID__?: string;
                }
                const g = window as unknown as IGlobalWithIds;
                const userIdStr = g.__TT_USER_ID__;
                const playlistIdStr = g.__TT_PLAYLIST_ID__;
                if (!userIdStr || !playlistIdStr) return;
                const userId = Number(userIdStr);
                const playlistId = Number(playlistIdStr);
                // Fire and forget; we do not await to keep handler sync
                fetch(
                  `/api/tunetrees/practice-queue/${userId}/${playlistId}/reset`,
                  { method: "POST" },
                )
                  .then(() => {
                    try {
                      window.dispatchEvent(
                        new Event("tt-practice-queues-reset"),
                      );
                    } catch {
                      /* ignore */
                    }
                  })
                  .catch((error) => {
                    console.error("Reset queues failed", error);
                  });
              } catch (error) {
                console.error("Reset queues failed (threw)", error);
              }
            }}
            className="text-red-600 focus:text-red-600"
            data-testid="reset-active-queues"
          >
            Reset Active Queues
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
