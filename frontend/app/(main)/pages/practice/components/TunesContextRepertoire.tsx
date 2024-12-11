import type React from "react";
import { type ReactNode, createContext, useContext, useState } from "react";
import type { ITuneOverview } from "../types";

interface IRepertoireTunesContextType {
  tunes: ITuneOverview[];
  setTunes: React.Dispatch<React.SetStateAction<ITuneOverview[]>>;
  tunesRefreshId: number | null;
  setTunesRefreshId: React.Dispatch<React.SetStateAction<number | null>>;
}

const TunesContextRepertoire = createContext<
  IRepertoireTunesContextType | undefined
>(undefined);

export const TunesProviderRepertoire = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [tunes, setTunes] = useState<ITuneOverview[]>([]);
  const [tunesRefreshId, setTunesRefreshId] = useState<number | null>(null);

  return (
    <TunesContextRepertoire.Provider
      value={{
        tunes,
        setTunes,
        tunesRefreshId,
        setTunesRefreshId,
      }}
    >
      {children}
    </TunesContextRepertoire.Provider>
  );
};

export const useRepertoireTunes = () => {
  const context = useContext(TunesContextRepertoire);
  if (!context) {
    throw new Error("useTunes must be used within a TunesProvider");
  }
  return context;
};
