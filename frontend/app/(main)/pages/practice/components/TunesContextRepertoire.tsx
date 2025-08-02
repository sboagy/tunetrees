import type { TableState } from "@tanstack/react-table";
import { useSession } from "next-auth/react";
import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { getRepertoireTunesOverview } from "../queries";
import { getTableStateTable } from "../settings";
import type { ITuneOverview } from "../types";
import { usePlaylist } from "./CurrentPlaylistProvider";
import { useSitDownDate } from "./SitdownDateProvider";
import { globalFlagManualSorting } from "./TunesTable";

interface IRepertoireTunesContextType {
  tunes: ITuneOverview[];
  setTunes: Dispatch<SetStateAction<ITuneOverview[]>>;
  tunesRefreshId: number | null;
  setTunesRefreshId: Dispatch<SetStateAction<number | null>>;
  lapsedCount: number | null;
  setLapsedCount: Dispatch<SetStateAction<number>>;
  currentCount: number | null;
  setCurrentCount: Dispatch<SetStateAction<number>>;
  futureCount: number | null;
  setFutureCount: Dispatch<SetStateAction<number>>;
  newCount: number | null;
  setNewCount: Dispatch<SetStateAction<number>>;
  refreshTunes: () => Promise<void>;
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

  const { data: session } = useSession();
  const userId = session?.user?.id ? Number.parseInt(session?.user?.id) : -1;

  const { currentPlaylist: playlistId } = usePlaylist();

  const showDeleted = false; // Should become a state variable at some point

  const refreshTunes = useCallback(async () => {
    try {
      let sortingState: TableState["sorting"] | null = null;
      if (globalFlagManualSorting) {
        const tableStateTable = await getTableStateTable(
          userId,
          "full",
          "repertoire",
          playlistId,
        );
        sortingState =
          (tableStateTable?.settings as TableState)?.sorting ?? null;
      }
      const result = await getRepertoireTunesOverview(
        userId,
        playlistId,
        showDeleted,
        sortingState,
      );
      setTunes(result);
      console.log(
        `TunesProviderRepertoire setTunes with ${result.length} tunes`,
      );
    } catch (error) {
      console.error("Error refreshing tunes:", error);
    }
  }, [userId, playlistId]);

  useEffect(() => {
    if (userId > 0 && playlistId > 0) {
      void refreshTunes();
    }
  }, [refreshTunes, userId, playlistId]);

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
      if (!tune.scheduled) {
        newCounter += 1;
        continue;
      }
      const scheduledDate = new Date(tune.scheduled);
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
        refreshTunes,
      }}
    >
      {children}
    </TunesContextRepertoire.Provider>
  );
};

export const useRepertoireTunes = (): IRepertoireTunesContextType => {
  const context = useContext(TunesContextRepertoire);
  if (!context) {
    throw new Error("useTunes must be used within a TunesProvider");
  }
  return context;
};
