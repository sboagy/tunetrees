import type React from "react";
import { createContext, type ReactNode, useContext, useState } from "react";
import type { ITuneOverview } from "../types";

interface ICatalogTunesContextType {
  tunes: ITuneOverview[];
  setTunes: React.Dispatch<React.SetStateAction<ITuneOverview[]>>;
  tunesRefreshId: number | null;
  setTunesRefreshId: (newRefreshId: number) => void;
}

const TunesContextCatalog = createContext<ICatalogTunesContextType | undefined>(
  undefined,
);

export const TunesProviderCatalog = ({ children }: { children: ReactNode }) => {
  const [tunes, setTunes] = useState<ITuneOverview[]>([]);
  const [tunesRefreshId, setTunesRefreshId] = useState<number | null>(null);

  return (
    <TunesContextCatalog.Provider
      value={{ tunes, setTunes, tunesRefreshId, setTunesRefreshId }}
    >
      {children}
    </TunesContextCatalog.Provider>
  );
};

export const useCatalogTunes = () => {
  const context = useContext(TunesContextCatalog);
  if (!context) {
    throw new Error("useTunes must be used within a TunesProvider");
  }
  return context;
};
