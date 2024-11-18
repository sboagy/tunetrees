import type React from "react";
import { type ReactNode, createContext, useContext, useState } from "react";
import type { Tune } from "../types";

interface ITunesContextType {
  tunes: Tune[];
  setTunes: React.Dispatch<React.SetStateAction<Tune[]>>;
  tunesRefreshId: number | null;
  setTunesRefreshId: (newRefreshId: number) => void;
}

const TunesContext = createContext<ITunesContextType | undefined>(undefined);

export const TunesProvider = ({ children }: { children: ReactNode }) => {
  const [tunes, setTunes] = useState<Tune[]>([]);
  const [tunesRefreshId, setTunesRefreshId] = useState<number | null>(null);

  return (
    <TunesContext.Provider
      value={{ tunes, setTunes, tunesRefreshId, setTunesRefreshId }}
    >
      {children}
    </TunesContext.Provider>
  );
};

export const useTunes = () => {
  const context = useContext(TunesContext);
  if (!context) {
    throw new Error("useTunes must be used within a TunesProvider");
  }
  return context;
};
