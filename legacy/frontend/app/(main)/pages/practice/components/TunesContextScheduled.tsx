import type React from "react";
import { createContext, type ReactNode, useContext, useState } from "react";
import type { ITuneOverviewScheduled } from "../types";

interface IScheduledTunesContextType {
  tunes: ITuneOverviewScheduled[];
  setTunes: React.Dispatch<React.SetStateAction<ITuneOverviewScheduled[]>>;
  tunesRefreshId: number | null;
  setTunesRefreshId: (newRefreshId: number) => void;
}

const TunesContextScheduled = createContext<
  IScheduledTunesContextType | undefined
>(undefined);

export const TunesProviderScheduled = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [tunes, setTunes] = useState<ITuneOverviewScheduled[]>([]);
  const [tunesRefreshId, setTunesRefreshId] = useState<number | null>(null);

  return (
    <TunesContextScheduled.Provider
      value={{ tunes, setTunes, tunesRefreshId, setTunesRefreshId }}
    >
      {children}
    </TunesContextScheduled.Provider>
  );
};

export const useScheduledTunes = () => {
  const context = useContext(TunesContextScheduled);
  if (!context) {
    throw new Error("useTunes must be used within a TunesProvider");
  }
  return context;
};
