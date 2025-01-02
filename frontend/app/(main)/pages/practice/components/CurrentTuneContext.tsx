// CurrentTuneContext.tsx
import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import type { TablePurpose } from "../types";

interface ITuneContextType {
  currentTune: number | null;
  setCurrentTune: (tuneId: number | null) => void;
  currentTablePurpose: TablePurpose | null;
  setCurrentTablePurpose: (purpose: TablePurpose) => void;
  triggerCurrentTuneUpdate: () => void;
  currentTuneUpdate: number;
}

const CurrentTuneContext = createContext<ITuneContextType | undefined>(
  undefined,
);

export const CurrentTuneProvider = ({ children }: { children: ReactNode }) => {
  const [currentTune, setCurrentTune] = useState<number | null>(null);
  const [currentTuneUpdate, setUpdateTrigger] = useState<number>(0);

  const triggerCurrentTuneUpdate = () => {
    setUpdateTrigger((prev) => prev + 1);
  };

  const [currentTablePurpose, setCurrentTablePurpose] =
    useState<TablePurpose | null>(null);
  return (
    <CurrentTuneContext.Provider
      value={{
        currentTune,
        setCurrentTune,
        currentTablePurpose,
        setCurrentTablePurpose,
        triggerCurrentTuneUpdate,
        currentTuneUpdate,
      }}
    >
      {children}
    </CurrentTuneContext.Provider>
  );
};

export const useTune = () => {
  const context = useContext(CurrentTuneContext);
  if (context === undefined) {
    throw new Error("useTune must be used within a TuneProvider");
  }
  return context;
};
