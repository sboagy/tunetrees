import type React from "react";
import { type ReactNode, createContext, useContext, useState } from "react";
import type { Tune } from "../types";

interface IAllTunesContextType {
  tunes: Tune[];
  setTunes: React.Dispatch<React.SetStateAction<Tune[]>>;
  tunesRefreshId: number | null;
  setTunesRefreshId: (newRefreshId: number) => void;
}

const TunesContextAll = createContext<IAllTunesContextType | undefined>(
  undefined,
);

export const TunesProviderAll = ({ children }: { children: ReactNode }) => {
  const [tunes, setTunes] = useState<Tune[]>([]);
  const [tunesRefreshId, setTunesRefreshId] = useState<number | null>(null);

  return (
    <TunesContextAll.Provider
      value={{ tunes, setTunes, tunesRefreshId, setTunesRefreshId }}
    >
      {children}
    </TunesContextAll.Provider>
  );
};

export const useAllTunes = () => {
  const context = useContext(TunesContextAll);
  if (!context) {
    throw new Error("useTunes must be used within a TunesProvider");
  }
  return context;
};
