import {
  createContext,
  createSignal,
  type ParentComponent,
  useContext,
} from "solid-js";

interface CurrentTuneContextValue {
  currentTuneId: () => string | null;
  setCurrentTuneId: (id: string | null) => void;
}

const CurrentTuneContext = createContext<CurrentTuneContextValue>();

/**
 * CurrentTuneProvider - Tracks which tune is currently being viewed/practiced
 *
 * This context allows sidebar panels (Notes, References) to know which tune's data to load
 * without prop drilling through the entire component tree.
 *
 * Usage:
 * ```tsx
 * // In practice session or tune detail:
 * const { setCurrentTuneId } = useCurrentTune();
 * createEffect(() => {
 *   setCurrentTuneId(tune().id);
 * });
 *
 * // In sidebar panel:
 * const { currentTuneId } = useCurrentTune();
 * const [notes] = createResource(currentTuneId, loadNotes);
 * ```
 */
export const CurrentTuneProvider: ParentComponent = (props) => {
  const [currentTuneId, setCurrentTuneId] = createSignal<string | null>(null);

  const value: CurrentTuneContextValue = {
    currentTuneId,
    setCurrentTuneId,
  };

  return (
    <CurrentTuneContext.Provider value={value}>
      {props.children}
    </CurrentTuneContext.Provider>
  );
};

/**
 * useCurrentTune - Access current tune context
 *
 * @throws Error if used outside CurrentTuneProvider
 */
export function useCurrentTune(): CurrentTuneContextValue {
  const context = useContext(CurrentTuneContext);
  if (!context) {
    throw new Error("useCurrentTune must be used within CurrentTuneProvider");
  }
  return context;
}
