// CurrentTuneContext.tsx
import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";

interface ITuneContextType {
  currentTune: number | null;
  setCurrentTune: (tuneId: number | null) => void;
}

const CurrentTuneContext = createContext<ITuneContextType | undefined>(undefined);

export const CurrentTuneProvider = ({ children }: { children: ReactNode }) => {
  const [currentTune, setCurrentTune] = useState<number | null>(null);
  return (
    <CurrentTuneContext.Provider value={{ currentTune, setCurrentTune }}>
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
