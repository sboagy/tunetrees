"use client";

// SitDownDateContext.tsx
import { convertToIsoUTCString } from "@/lib/date-utils";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
// import { getReviewSitdownDate } from "../queries";

/**
 * getSitdownDateFromBrowser
 * -------------------------------------------------------------
 * Single authoritative reader for the current "sitdown" (practice anchor) date used by
 * scheduling, practice queue snapshots, and UI date chooser labels.
 *
 * SOURCE PRIORITY (highest first):
 * 1. window.__TT_REVIEW_SITDOWN_DATE__ (ephemeral in‑memory override set by tests or user
 *    interactions via global helper)
 * 2. localStorage["TT_REVIEW_SITDOWN_DATE"] (persisted across reloads)
 * 3. Fallback: current browser time (new Date())
 *
 * MANUAL FLAG (localStorage["TT_REVIEW_SITDOWN_MANUAL"] === "true"):
 * Indicates the user intentionally pinned a non‑today calendar day. While set, automatic
 * midnight rollover (see below) is suppressed so the chosen day persists across sessions
 * until the user selects Today (or picks a date whose calendar day == real today, which
 * implicitly clears manual intent elsewhere).
 *
 * MIDNIGHT ROLLOVER LOGIC:
 * If the stored date is before the browser's current local calendar day AND there is no
 * manual flag, we advance (roll forward) to "today" (keeping the current time-of-day) to
 * avoid silently operating on stale historical queues. This prevents users who leave a tab
 * open overnight from unknowingly working on yesterday's review snapshot after midnight.
 *
 * VALIDATION / SELF-HEALING:
 * - Corrupt / unparsable stored value -> reset to now & clear manual flag.
 * - Always returns a valid Date object or throws (non-browser contexts only).
 *
 * INVARIANTS EXPECTED BY OTHER COMPONENTS:
 * - Returned Date's calendar day defines the anchors for PracticeDateChooser: Yesterday =
 *   base - 1 day, Today = base, Tomorrow = base + 1 day.
 * - Arbitrary user-picked dates (e.g. via PracticeDateChooser free input) MUST NOT mutate
 *   the underlying sitdown base; they are transient selection values. The chooser therefore
 *   always recomputes its Yesterday/Today/Tomorrow labels from getSitdownDateFromBrowser(),
 *   not from the currently selected value.
 *
 * USAGE GUIDELINES:
 * - Prefer the SitDownDateContext (useSitDownDate()) inside React components when reactivity
 *   is needed. Direct calls to this function are acceptable only for one-off, immediate
 *   computations (e.g. forming a snapshot request pushed during initial render) or within
 *   utility helpers outside React.
 * - Avoid duplicating rollover or storage logic elsewhere—centralize here.
 * - Tests should modify the sitdown date via the injected global setter or URL param (in
 *   permitted environments) so that UI + context stay consistent.
 *
 * POTENTIAL FUTURE REFACTOR:
 * We may eventually hide direct exports and expose only a context-driven hook plus an
 * explicit imperative helper (setSitdownDate) to reduce mixed usage.
 *
 * FURTHER EXPLANATION:
 *
 * `TT_REVIEW_SITDOWN_MANUAL` encodes user intent so we can distinguish:
 * - “Stale leftover date” (should auto‑advance) vs “User deliberately pinned this date”
 *   (must not auto‑advance).
 * - Without it, a user who intentionally selects yesterday (e.g., finishing an incomplete
 *   prior session) would have that choice silently overridden on any reload or midnight
 *   boundary.
 * - It lets a manually pinned date persist across navigation/reloads until the user
 *   explicitly picks Today (or uses reset).
 * - Prevents mid‑session anchor drift: multiple calls wouldn’t suddenly shift the base date,
 *   which would otherwise cause inconsistent queue snapshot boundaries.
 * - Enables tests / tooling to simulate pinned vs auto dates explicitly.
 * - Avoids ambiguity if the stored date is in the future (user scheduled ahead) — we don’t
 *   want to auto “correct” it unless it was auto mode.
 *
 * If, for current date, a value was each time with no manual flag, we’d either:
 * 1. Always use real now → sitdown anchor could change during a long session, or
 * 2. Keep the first stored date but auto-roll everything old → destroys intentional pinning.
 *
 * So the manual flag is the minimal persisted bit that preserves intentional selection while
 * allowing safe automatic rollover for unattended stale dates.
 */
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
      // Fallback bootstrap (client hydration) — if for any reason the early inline <script>
      // seeding via buildSitdownBootstrap did not run (e.g. production streaming race, CSP
      // blocking inline scripts in CI, or very slow chunk delivery) we still want the
      // ?tt_sitdown=... URL param semantics to apply before the rest of the app relies on
      // localStorage having a value. This mirrors logic in sitdown-bootstrap.ts and is
      // idempotent (runs only when storage key absent). Safe to keep minimal here to avoid
      // duplicating more than necessary.
      try {
        if (typeof window !== "undefined") {
          const ls = window.localStorage;
          // Only attempt if not already set by SSR inline bootstrap.
          if (!ls.getItem("TT_REVIEW_SITDOWN_DATE")) {
            const qp = window.location.search;
            if (qp) {
              const usp = new URLSearchParams(qp);
              const raw = usp.get("tt_sitdown");
              if (raw && raw.length > 0) {
                if (raw === "reset") {
                  // Mirror reset semantics: reseed with *today* local noon (auto mode)
                  try {
                    const now = new Date();
                    const todayNoon = new Date(
                      now.getFullYear(),
                      now.getMonth(),
                      now.getDate(),
                      12,
                      0,
                      0,
                      0,
                    );
                    const isoToday = todayNoon.toISOString();
                    ls.setItem("TT_REVIEW_SITDOWN_DATE", isoToday);
                    ls.removeItem("TT_REVIEW_SITDOWN_MANUAL");
                    (
                      window as typeof window & {
                        __TT_REVIEW_SITDOWN_DATE__?: string;
                      }
                    ).__TT_REVIEW_SITDOWN_DATE__ = isoToday;
                  } catch {
                    // swallow; non‑critical fallback
                  }
                } else {
                  const [, mode] = raw.split(",");
                  if (mode === "auto") {
                    ls.removeItem("TT_REVIEW_SITDOWN_MANUAL");
                  } else {
                    // Treat absence of ,auto as an intentional manual pin (aligns with SSR bootstrap)
                    ls.setItem("TT_REVIEW_SITDOWN_MANUAL", "true");
                  }
                  const parsed = new Date(raw);
                  if (!Number.isNaN(parsed.getTime())) {
                    ls.setItem("TT_REVIEW_SITDOWN_DATE", raw);
                    try {
                      (
                        window as typeof window & {
                          __TT_REVIEW_SITDOWN_DATE__?: string;
                        }
                      ).__TT_REVIEW_SITDOWN_DATE__ = raw;
                    } catch {
                      /* ignore */
                    }
                  }
                }
              }
            }
          }
        }
      } catch {
        // Non-fatal: fallback seeding not strictly required; main parsing still proceeds below.
      }
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

  // Secondary pass: if a tt_sitdown param with ,auto is present but a prior render or
  // earlier bootstrap already set a manual flag, ensure it is cleared so tests expecting
  // auto mode (no TT_REVIEW_SITDOWN_MANUAL) pass consistently.
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const ls = window.localStorage;
      const qp = window.location.search;
      if (!qp) return;
      const usp = new URLSearchParams(qp);
      const raw = usp.get("tt_sitdown");
      if (!raw) return;
      if (raw === "reset") {
        // Reset already seeds today + clears manual in initial bootstrap branch; nothing extra.
        return;
      }
      const [, mode] = raw.split(",");
      if (mode === "auto") {
        // If auto explicitly requested, guarantee manual flag removal even if previously set.
        if (ls.getItem("TT_REVIEW_SITDOWN_MANUAL")) {
          ls.removeItem("TT_REVIEW_SITDOWN_MANUAL");
        }
      }
    } catch {
      /* non-fatal */
    }
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
    throw new Error("useSitDownDate must be used within a SitDownDateProvider");
  }
  return context;
};
