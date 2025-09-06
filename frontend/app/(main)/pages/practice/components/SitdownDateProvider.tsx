"use client";

// SitDownDateContext.tsx
import { convertToIsoUTCString } from "@/lib/date-utils";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
// import { getReviewSitdownDate } from "../queries";

// Returns a Date object for the sitdown date using browser globals, localStorage, or current date
export function getSitdownDateFromBrowser(): Date {
  if (typeof window !== "undefined") {
    const w = window as typeof window & {
      __TT_REVIEW_SITDOWN_DATE__?: string;
    };
    // Manual override flag: set when user explicitly chooses a non-today date.
    // Cleared automatically when user reverts to Today via chooser or when explicit date equals real today.
    // manualFlag semantics:
    // "true" => user explicitly selected a non-today calendar day; suppress midnight auto-rollover
    const rawStored =
      w.__TT_REVIEW_SITDOWN_DATE__ ||
      window.localStorage.getItem("TT_REVIEW_SITDOWN_DATE");
    const fallbackNowIso = new Date().toISOString();
    const dateString = rawStored || fallbackNowIso;
    const parsed = new Date(convertToIsoUTCString(dateString));
    let sitdownDate = parsed;
    if (
      !sitdownDate ||
      !(sitdownDate instanceof Date) ||
      Number.isNaN(sitdownDate.getTime())
    ) {
      // Corrupt stored value – reset to now and clear manual flag.
      sitdownDate = new Date();
      window.localStorage.setItem(
        "TT_REVIEW_SITDOWN_DATE",
        sitdownDate.toISOString(),
      );
      window.localStorage.removeItem("TT_REVIEW_SITDOWN_MANUAL");
    } else {
      // Auto rollover: if not manually pinned AND stored calendar day < local today, advance to today.
      try {
        const now = new Date();
        const storedDayKey = `${sitdownDate.getFullYear()}-${sitdownDate.getMonth()}-${sitdownDate.getDate()}`;
        const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
        if (storedDayKey !== todayKey) {
          // Only rollover forward (stale yesterday or older) when not manual.
          const storedTime = sitdownDate.getTime();
          // Build midnight boundaries for diff test.
          const todayMidnight = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          );
          const manualFlag = window.localStorage.getItem(
            "TT_REVIEW_SITDOWN_MANUAL",
          );
          if (
            (!manualFlag || manualFlag !== "true") &&
            storedTime < todayMidnight.getTime()
          ) {
            const advanced = new Date(now); // keep current time-of-day; downstream UI normalizes to noon where needed.
            window.localStorage.setItem(
              "TT_REVIEW_SITDOWN_DATE",
              advanced.toISOString(),
            );
            try {
              (
                w as typeof w & { __TT_REVIEW_SITDOWN_DATE__?: string }
              ).__TT_REVIEW_SITDOWN_DATE__ = advanced.toISOString();
            } catch {
              /* ignore */
            }
            sitdownDate = advanced;
            if (process.env.NODE_ENV !== "production") {
              console.debug(
                "[SitdownRollover] advanced stale sitdown to today",
                {
                  previous: dateString,
                  advanced: advanced.toISOString(),
                },
              );
            }
          }
        }
      } catch {
        // Non-fatal; leave existing sitdownDate in place.
      }
    }
    if (
      !sitdownDate ||
      !(sitdownDate instanceof Date) ||
      Number.isNaN(sitdownDate.getTime())
    ) {
      throw new Error(
        "No valid sitdown date found in browser globals, localStorage, or current date. This is required.",
      );
    }
    return sitdownDate;
  }
  throw new Error(
    "getSitdownDateFromBrowser must be called in a browser context",
  );
}

interface ISitDownDateContextType {
  sitDownDate: Date | null;
  // setSitDownDate is deprecated and removed
  acceptableDelinquencyDays: number;
  setAcceptableDelinquencyDays: (days: number) => void;
}

const SitDownDateContext = createContext<ISitDownDateContextType | undefined>(
  undefined,
);

export const SitDownDateProvider = ({ children }: { children: ReactNode }) => {
  const [sitDownDate, setSitDownDate] = useState<Date | null>(null);
  const [acceptableDelinquencyDays, setAcceptableDelinquencyDays] =
    useState<number>(7);

  useEffect(() => {
    // Initialize sitdown date from browser context
    try {
      const date = getSitdownDateFromBrowser();
      // Debugging aid: print raw source and derived local/UTC strings when not in prod
      try {
        if (
          process.env.NODE_ENV !== "production" &&
          typeof window !== "undefined"
        ) {
          const win = window as Window & {
            __TT_REVIEW_SITDOWN_DATE__?: string;
          };
          const raw =
            win.__TT_REVIEW_SITDOWN_DATE__ ??
            window.localStorage.getItem("TT_REVIEW_SITDOWN_DATE");
          console.debug("[SitdownDebug] raw sitdown string:", raw);
          console.debug("[SitdownDebug] parsed (toString):", date.toString());
          console.debug(
            "[SitdownDebug] parsed (toLocaleString):",
            date.toLocaleString(),
          );
        }
      } catch {
        // swallow debug errors
      }
      setSitDownDate(date);
    } catch (error) {
      console.error("Failed to initialize sitdown date:", error);
      // Fall back to current date
      setSitDownDate(new Date());
    }
  }, []); // the effect runs only once, after the initial render of the component.

  // Listen for external sitdown updates (tests or dev console helper)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      try {
        const updated = getSitdownDateFromBrowser();
        setSitDownDate(updated);
      } catch (error) {
        console.warn("[SitdownDateProvider] failed external refresh", error);
      }
    };
    window.addEventListener("tt-sitdown-updated", handler);
    return () => window.removeEventListener("tt-sitdown-updated", handler);
  }, []);

  return (
    <SitDownDateContext.Provider
      value={{
        sitDownDate,
        acceptableDelinquencyDays,
        setAcceptableDelinquencyDays,
      }}
    >
      {children}
    </SitDownDateContext.Provider>
  );
};

export const useSitDownDate = () => {
  const context = useContext(SitDownDateContext);
  if (context === undefined) {
    throw new Error("useTune must be used within a TuneProvider");
  }
  return context;
};
