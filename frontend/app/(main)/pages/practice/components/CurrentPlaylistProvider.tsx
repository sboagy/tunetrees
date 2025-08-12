// CurrentPlaylistContext.tsx
import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";

interface IPlaylistIdContextType {
  currentPlaylist: number;
  setCurrentPlaylist: (playlistId: number) => void;
}

const CurrentPlaylistContext = createContext<
  IPlaylistIdContextType | undefined
>(undefined);

export const CurrentPlaylistProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  // Default to playlist 1 so main grids can render promptly after auth;
  // PlaylistChooser will override this from server state shortly after mount.
  const [currentPlaylist, setCurrentPlaylist] = useState<number>(1);
  return (
    <CurrentPlaylistContext.Provider
      value={{
        currentPlaylist,
        setCurrentPlaylist,
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
