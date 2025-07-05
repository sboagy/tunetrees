// SitDownDateContext.tsx
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
// import { getReviewSitdownDate } from "../queries";

interface ISitDownDateContextType {
  sitDownDate: Date | null;
  // setSitDownDate is deprecated and removed
  acceptableDelinquencyDays: number;
  setAcceptableDelinquencyDays: (days: number) => void;
}

const SitDownDateContext = createContext<ISitDownDateContextType | undefined>(
  undefined,
);

export const SitDownDateProvider = ({ children }: { children: ReactNode }) => {
  const [sitDownDate] = useState<Date | null>(null);
  const [acceptableDelinquencyDays, setAcceptableDelinquencyDays] =
    useState<number>(7);

  useEffect(() => {
    // Prefer a test date injected by Playwright or set in localStorage
    // Sitdown date is now handled in browser-driven logic elsewhere
  }, []); // the effect runs only once, after the initial render of the component.

  return (
    <SitDownDateContext.Provider
      value={{
        sitDownDate,
        acceptableDelinquencyDays,
        setAcceptableDelinquencyDays,
      }}
    >
      {children}
    </SitDownDateContext.Provider>
  );
};

export const useSitDownDate = () => {
  const context = useContext(SitDownDateContext);
  if (context === undefined) {
    throw new Error("useTune must be used within a TuneProvider");
  }
  return context;
};
