import type React from "react";
import { type ReactNode, createContext, useContext, useState } from "react";
import type { Tune } from "../types";

interface IRepertoireTunesContextType {
  tunes: Tune[];
  setTunes: React.Dispatch<React.SetStateAction<Tune[]>>;
  tunesRefreshId: number | null;
  setTunesRefreshId: (newRefreshId: number) => void;
}

const RepertoireTunesContext = createContext<
  IRepertoireTunesContextType | undefined
>(undefined);

export const RepertoireTunesProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [tunes, setTunes] = useState<Tune[]>([]);
  const [tunesRefreshId, setTunesRefreshId] = useState<number | null>(null);

  return (
    <RepertoireTunesContext.Provider
      value={{ tunes, setTunes, tunesRefreshId, setTunesRefreshId }}
    >
      {children}
    </RepertoireTunesContext.Provider>
  );
};

export const useRepertoireTunes = () => {
  const context = useContext(RepertoireTunesContext);
  if (!context) {
    throw new Error("useTunes must be used within a TunesProvider");
  }
  return context;
};