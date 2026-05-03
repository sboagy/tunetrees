import {
  createContext,
  createSignal,
  type ParentComponent,
  useContext,
} from "solid-js";

interface CurrentTuneSetContextValue {
  tuneSetListChanged: () => number;
  incrementTuneSetListChanged: () => void;
}

const CurrentTuneSetContext = createContext<CurrentTuneSetContextValue>();

export const CurrentTuneSetProvider: ParentComponent = (props) => {
  const [tuneSetListChanged, setTuneSetListChanged] = createSignal(0);

  const value: CurrentTuneSetContextValue = {
    tuneSetListChanged,
    incrementTuneSetListChanged: () =>
      setTuneSetListChanged((value) => value + 1),
  };

  return (
    <CurrentTuneSetContext.Provider value={value}>
      {props.children}
    </CurrentTuneSetContext.Provider>
  );
};

export function useCurrentTuneSet(): CurrentTuneSetContextValue {
  const context = useContext(CurrentTuneSetContext);
  if (!context) {
    throw new Error(
      "useCurrentTuneSet must be used within CurrentTuneSetProvider"
    );
  }
  return context;
}
