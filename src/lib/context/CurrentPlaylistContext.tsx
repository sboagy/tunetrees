/**
 * Current Playlist Context (Compatibility Alias)
 *
 * This file provides backward compatibility for components still using
 * "playlist" terminology. It re-exports from CurrentRepertoireContext.
 *
 * @deprecated Use CurrentRepertoireContext directly instead
 * @module lib/context/CurrentPlaylistContext
 */

import {
  CurrentRepertoireProvider,
  useCurrentRepertoire,
} from "./CurrentRepertoireContext";

/**
 * @deprecated Use CurrentRepertoireProvider instead
 */
export const CurrentPlaylistProvider = CurrentRepertoireProvider;

/**
 * @deprecated Use useCurrentRepertoire instead
 */
export function useCurrentPlaylist() {
  const context = useCurrentRepertoire();
  return {
    currentPlaylistId: context.currentRepertoireId,
    setCurrentPlaylistId: context.setCurrentRepertoireId,
  };
}
