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
  const [currentPlaylist, setCurrentPlaylist] = useState<number>(-1);
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
