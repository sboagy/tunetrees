import type React from "react";
import { type ReactNode, createContext, useContext, useState } from "react";
import type { Tune } from "../types";

interface IScheduledTunesContextType {
  tunes: Tune[];
  setTunes: React.Dispatch<React.SetStateAction<Tune[]>>;
  tunesRefreshId: number | null;
  setTunesRefreshId: (newRefreshId: number) => void;
}

const ScheduledTunesContext = createContext<
  IScheduledTunesContextType | undefined
>(undefined);

export const ScheduledTunesProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [tunes, setTunes] = useState<Tune[]>([]);
  const [tunesRefreshId, setTunesRefreshId] = useState<number | null>(null);

  return (
    <ScheduledTunesContext.Provider
      value={{ tunes, setTunes, tunesRefreshId, setTunesRefreshId }}
    >
      {children}
    </ScheduledTunesContext.Provider>
  );
};

export const useScheduledTunes = () => {
  const context = useContext(ScheduledTunesContext);
  if (!context) {
    throw new Error("useTunes must be used within a TunesProvider");
  }
  return context;
};
