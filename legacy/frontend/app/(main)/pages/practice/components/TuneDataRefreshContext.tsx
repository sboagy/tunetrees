import type React from "react";
import { createContext, useCallback, useContext, useState } from "react";

interface ITuneDataRefreshContextType {
  refreshId: number; // Unique identifier for each refresh
  triggerRefresh: () => void; // Function to trigger a refresh
}

const TuneDataRefreshContext = createContext<
  ITuneDataRefreshContextType | undefined
>(undefined);

export const TuneDataRefreshProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [refreshId, setRefreshId] = useState(Date.now());

  // Function to trigger a refresh (sets a new unique identifier)
  const triggerRefresh = useCallback(() => {
    const newRefreshId = Date.now();
    setRefreshId(newRefreshId);
  }, []);

  return (
    <TuneDataRefreshContext.Provider value={{ refreshId, triggerRefresh }}>
      {children}
    </TuneDataRefreshContext.Provider>
  );
};

export const useTuneDataRefresh = () => {
  const context = useContext(TuneDataRefreshContext);
  if (!context) {
    throw new Error(
      "useTuneDataRefresh must be used within a TuneDataRefreshProvider",
    );
  }
  return context;
};
