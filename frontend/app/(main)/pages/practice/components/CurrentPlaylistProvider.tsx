// CurrentPlaylistContext.tsx
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { getPrefsSpacedRepetitionForUser } from "@/app/(main)/pages/practice/preferences";

interface IPlaylistIdContextType {
  currentPlaylist: number;
  setCurrentPlaylist: (playlistId: number) => void;
  srAlgType?: "FSRS" | "SM2" | null;
  setSrAlgType?: (alg: "FSRS" | "SM2" | null) => void;
}

const CurrentPlaylistContext = createContext<
  IPlaylistIdContextType | undefined
>(undefined);

export const CurrentPlaylistProvider = ({
  children,
  userId,
}: {
  children: ReactNode;
  userId?: number | null;
}) => {
  // Default to playlist 1 so main grids can render promptly after auth;
  // PlaylistChooser will override this from server state shortly after mount.
  const [currentPlaylist, setCurrentPlaylist] = useState<number>(1);
  // Default SR algorithm to FSRS synchronously so adaptive columns (Stability/Difficulty)
  // render deterministically on first paint (important for headless/E2E).
  const [srAlgType, setSrAlgType] = useState<"FSRS" | "SM2" | null>("FSRS");
  // Auto-fetch user's spaced repetition algorithm preference once (or when userId changes)
  useEffect(() => {
    let cancelled = false;
    const loadAlg = async () => {
      if (!userId || userId <= 0) return;
      try {
        const prefs = await getPrefsSpacedRepetitionForUser(userId);
        if (!cancelled) {
          if (prefs && prefs.length > 0) {
            // backend field name appears as `algorithm` in form mapping
            const first = prefs[0] as unknown as { algorithm?: string };
            // Normalize to canonical enum values
            const alg = (first.algorithm || "FSRS").toUpperCase();
            if (alg === "FSRS" || alg === "SM2") setSrAlgType(alg);
            else setSrAlgType("FSRS");
          }
        }
      } catch {
        // Silent fail; leave default (error intentionally ignored)
      }
    };
    loadAlg().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <CurrentPlaylistContext.Provider
      value={{
        currentPlaylist,
        setCurrentPlaylist,
        srAlgType,
        setSrAlgType,
      }}
    >
      {children}
    </CurrentPlaylistContext.Provider>
  );
};

export const usePlaylist = () => {
  const context = useContext(CurrentPlaylistContext);
  if (context === undefined) {
    throw new Error("useTune must be used within a TuneProvider");
  }
  return context;
};
