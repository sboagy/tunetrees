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
    const dateString =
      w.__TT_REVIEW_SITDOWN_DATE__ ||
      window.localStorage.getItem("TT_REVIEW_SITDOWN_DATE") ||
      new Date().toISOString();
    const sitdownDate = new Date(convertToIsoUTCString(dateString));
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
