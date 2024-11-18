// TuneContext.tsx
import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";

interface ITuneContextType {
  currentTune: number | null;
  setCurrentTune: (tuneId: number | null) => void;
}

const TuneContext = createContext<ITuneContextType | undefined>(undefined);

export const TuneProvider = ({ children }: { children: ReactNode }) => {
  const [currentTune, setCurrentTune] = useState<number | null>(null);
  return (
    <TuneContext.Provider value={{ currentTune, setCurrentTune }}>
      {children}
    </TuneContext.Provider>
  );
};

export const useTune = () => {
  const context = useContext(TuneContext);
  if (context === undefined) {
    throw new Error("useTune must be used within a TuneProvider");
  }
  return context;
};
