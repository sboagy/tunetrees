import type React from "react";
import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ITuneOverview } from "../types";
import { useSitDownDate } from "./SitdownDateProvider";

interface IRepertoireTunesContextType {
  tunes: ITuneOverview[];
  setTunes: React.Dispatch<React.SetStateAction<ITuneOverview[]>>;
  tunesRefreshId: number | null;
  setTunesRefreshId: React.Dispatch<React.SetStateAction<number | null>>;
  lapsedCount: number | null;
  setLapsedCount: React.Dispatch<React.SetStateAction<number>>;
  currentCount: number | null;
  setCurrentCount: React.Dispatch<React.SetStateAction<number>>;
  futureCount: number | null;
  setFutureCount: React.Dispatch<React.SetStateAction<number>>;
  newCount: number | null;
  setNewCount: React.Dispatch<React.SetStateAction<number>>;
}

const TunesContextRepertoire = createContext<
  IRepertoireTunesContextType | undefined
>(undefined);

export const TunesProviderRepertoire = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [tunes, setTunesInner] = useState<ITuneOverview[]>([]);
  const [lapsedCount, setLapsedCount] = useState<number>(0);
  const [currentCount, setCurrentCount] = useState<number>(0);
  const [futureCount, setFutureCount] = useState<number>(0);
  const [newCount, setNewCount] = useState<number>(0);

  const [tunesRefreshId, setTunesRefreshId] = useState<number | null>(null);

  const { sitDownDate, acceptableDelinquencyDays } = useSitDownDate();

  // BOOKMARK: This is a useEffect that will run whenever the sitDownDate changes.
  //
  // since setTunes calls setCounts, we don't want to include tunes in the
  // dependency array, otherwise we'll be doing double counting, so we
  // bypass the lint rule.
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (!sitDownDate) {
      // Since sitDownDate is also relying on an async call, we need to
      // be tolerant of the fact that it may not be set yet.
      // in this case, we'll just return and wait for the next depency
      // trigger.
      return;
    }

    setCounts(tunes);
  }, [sitDownDate]); // Don't include tunes in the dependency array

  function setCounts(tuneList: ITuneOverview[]) {
    if (!sitDownDate) {
      return;
    }
    const lowerBoundReviewSitdownDate = new Date(sitDownDate);
    lowerBoundReviewSitdownDate.setDate(
      sitDownDate.getDate() - acceptableDelinquencyDays,
    );
    let lapsedCounter = 0;
    let currentCounter = 0;
    let futureCounter = 0;
    let newCounter = 0;
    for (const tune of tuneList) {
      if (!tune.review_date) {
        newCounter += 1;
        continue;
      }
      const scheduledDate = new Date(tune.review_date);
      if (scheduledDate < lowerBoundReviewSitdownDate) {
        lapsedCounter += 1;
      } else if (
        scheduledDate > lowerBoundReviewSitdownDate &&
        scheduledDate <= sitDownDate
      ) {
        currentCounter += 1;
      } else {
        futureCounter += 1;
      }
    }

    setLapsedCount(lapsedCounter);
    setCurrentCount(currentCounter);
    setFutureCount(futureCounter);
    setNewCount(newCounter);
  }

  const setTunes: Dispatch<SetStateAction<ITuneOverview[]>> = (value) => {
    if (typeof value === "function") {
      setTunesInner((prevTunes) => {
        const newTunes = (
          value as (prevState: ITuneOverview[]) => ITuneOverview[]
        )(prevTunes);
        setCounts(newTunes);
        return newTunes;
      });
    } else {
      setCounts(value);
      setTunesInner(value);
    }
  };

  return (
    <TunesContextRepertoire.Provider
      value={{
        tunes,
        setTunes,
        tunesRefreshId,
        setTunesRefreshId,
        lapsedCount,
        setLapsedCount,
        currentCount,
        setCurrentCount,
        futureCount,
        setFutureCount,
        newCount,
        setNewCount,
      }}
    >
      {children}
    </TunesContextRepertoire.Provider>
  );
};

export const useRepertoireTunes = () => {
  const context = useContext(TunesContextRepertoire);
  if (!context) {
    throw new Error("useTunes must be used within a TunesProvider");
  }
  return context;
};
