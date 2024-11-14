// TuneDataRefreshContext.tsx
import React, { createContext, useState } from "react";

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
  const triggerRefresh = () => {
    setRefreshId(Date.now());
  };

  return (
    <TuneDataRefreshContext.Provider
      value={{
        refreshId,
        triggerRefresh,
      }}
    >
      {children}
    </TuneDataRefreshContext.Provider>
  );
};

export const useTuneDataRefresh = () => {
  const context = React.useContext(TuneDataRefreshContext);
  if (context === undefined) {
    throw new Error(
      "useTuneDataRefresh must be used within a TuneDataRefreshProvider",
    );
  }
  return context;
};
