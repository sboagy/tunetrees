import {
  createContext,
  createEffect,
  createSignal,
  type ParentComponent,
  useContext,
} from "solid-js";

import { useAuth } from "@/lib/auth/AuthContext";
import { useCurrentPlaylist } from "@/lib/context/CurrentPlaylistContext";

interface CurrentTuneContextValue {
  currentTuneId: () => string | null;
  setCurrentTuneId: (id: string | null) => void;
}

const CurrentTuneContext = createContext<CurrentTuneContextValue>();

/**
 * CurrentTuneProvider - Tracks which tune is currently being viewed/practiced
 *
 * This context allows sidebar panels (Notes, References) to know which tune's data to load
 * without prop drilling through the entire component tree.
 *
 * Usage:
 * ```tsx
 * // In practice session or tune detail:
 * const { setCurrentTuneId } = useCurrentTune();
 * createEffect(() => {
 *   setCurrentTuneId(tune().id);
 * });
 *
 * // In sidebar panel:
 * const { currentTuneId } = useCurrentTune();
 * const [notes] = createResource(currentTuneId, loadNotes);
 * ```
 */
export const CurrentTuneProvider: ParentComponent = (props) => {
  const { user } = useAuth();
  const { currentPlaylistId } = useCurrentPlaylist();

  const [currentTuneId, setCurrentTuneIdInternal] = createSignal<string | null>(
    null
  );

  const storageKey = () => {
    if (typeof window === "undefined") return null;
    const userId = user()?.id;
    if (!userId) return null;
    const playlistId = currentPlaylistId();
    // Scope tune selection to the active playlist when available.
    return playlistId
      ? `tunetrees:selectedTune:${userId}:${playlistId}`
      : `tunetrees:selectedTune:${userId}`;
  };

  // Restore selection on refresh (and when user/playlist changes).
  createEffect(() => {
    const key = storageKey();
    if (!key) {
      setCurrentTuneIdInternal(null);
      return;
    }

    const stored = localStorage.getItem(key);
    setCurrentTuneIdInternal(stored || null);
  });

  const setCurrentTuneId = (id: string | null) => {
    setCurrentTuneIdInternal(id);
    const key = storageKey();
    if (!key) return;

    if (id) localStorage.setItem(key, id);
    else localStorage.removeItem(key);
  };

  const value: CurrentTuneContextValue = {
    currentTuneId,
    setCurrentTuneId,
  };

  return (
    <CurrentTuneContext.Provider value={value}>
      {props.children}
    </CurrentTuneContext.Provider>
  );
};

/**
 * useCurrentTune - Access current tune context
 *
 * @throws Error if used outside CurrentTuneProvider
 */
export function useCurrentTune(): CurrentTuneContextValue {
  const context = useContext(CurrentTuneContext);
  if (!context) {
    throw new Error("useCurrentTune must be used within CurrentTuneProvider");
  }
  return context;
}
