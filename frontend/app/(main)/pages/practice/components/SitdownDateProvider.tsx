// SitDownDateContext.tsx
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { getReviewSitdownDate } from "../queries";

interface ISitDownDateContextType {
  sitDownDate: Date | null;
  setSitDownDate: (sitdowndate: Date | null) => void;
  acceptableDelinquencyDays: number;
  setAcceptableDelinquencyDays: (days: number) => void;
}

const SitDownDateContext = createContext<ISitDownDateContextType | undefined>(
  undefined,
);

export const SitDownDateProvider = ({ children }: { children: ReactNode }) => {
  const [sitDownDate, setSitDownDate] = useState<Date | null>(null);
  const [acceptableDelinquencyDays, setAcceptableDelinquencyDays] =
    useState<number>(7);

  useEffect(() => {
    getReviewSitdownDate()
      .then((dateString: string) => {
        const reviewSitdown = dateString ? new Date(dateString) : new Date();
        setSitDownDate(reviewSitdown);
      })
      .catch((error) => {
        console.error(
          "TunesGrid useEffect getReviewSitdownDate error: %s",
          error,
        );
      });
  }, []); // the effect runs only once, after the initial render of the component.

  return (
    <SitDownDateContext.Provider
      value={{
        sitDownDate,
        setSitDownDate,
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
