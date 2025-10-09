/**
 * Current Playlist Context
 *
 * Global state management for the currently selected playlist.
 * All components that need to know which playlist is active should use this context.
 *
 * @module lib/context/CurrentPlaylistContext
 */

import {
  createContext,
  createSignal,
  type ParentComponent,
  useContext,
} from "solid-js";

interface CurrentPlaylistContextValue {
  currentPlaylistId: () => number | null;
  setCurrentPlaylistId: (id: number | null) => void;
}

const CurrentPlaylistContext = createContext<CurrentPlaylistContextValue>();

/**
 * CurrentPlaylistProvider - Tracks which playlist is currently selected
 *
 * This context allows all components to reactively respond to playlist changes
 * without prop drilling through the entire component tree.
 *
 * Usage:
 * ```tsx
 * // In TopNav or Practice tab:
 * const { setCurrentPlaylistId } = useCurrentPlaylist();
 * setCurrentPlaylistId(playlistId);
 *
 * // In any component that needs to know current playlist:
 * const { currentPlaylistId } = useCurrentPlaylist();
 * const [tunes] = createResource(currentPlaylistId, loadTunesForPlaylist);
 * ```
 */
export const CurrentPlaylistProvider: ParentComponent = (props) => {
  const [currentPlaylistId, setCurrentPlaylistId] = createSignal<number | null>(
    null
  );

  const value: CurrentPlaylistContextValue = {
    currentPlaylistId,
    setCurrentPlaylistId,
  };

  return (
    <CurrentPlaylistContext.Provider value={value}>
      {props.children}
    </CurrentPlaylistContext.Provider>
  );
};

/**
 * useCurrentPlaylist - Access current playlist context
 *
 * @throws Error if used outside CurrentPlaylistProvider
 */
export function useCurrentPlaylist(): CurrentPlaylistContextValue {
  const context = useContext(CurrentPlaylistContext);
  if (!context) {
    throw new Error(
      "useCurrentPlaylist must be used within CurrentPlaylistProvider"
    );
  }
  return context;
}
