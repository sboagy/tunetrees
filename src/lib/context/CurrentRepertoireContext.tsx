/**
 * Current Repertoire Context
 *
 * Global state management for the currently selected repertoire.
 *
 * @module lib/context/CurrentRepertoireContext
 */

import {
  createContext,
  createSignal,
  type ParentComponent,
  useContext,
} from "solid-js";

interface CurrentRepertoireContextValue {
  currentRepertoireId: () => string | null;
  setCurrentRepertoireId: (id: string | null) => void;
}

const CurrentRepertoireContext = createContext<CurrentRepertoireContextValue>();

export const CurrentRepertoireProvider: ParentComponent = (props) => {
  const [currentRepertoireId, setCurrentRepertoireId] = createSignal<
    string | null
  >(null);

  const value: CurrentRepertoireContextValue = {
    currentRepertoireId,
    setCurrentRepertoireId,
  };

  return (
    <CurrentRepertoireContext.Provider value={value}>
      {props.children}
    </CurrentRepertoireContext.Provider>
  );
};

export function useCurrentRepertoire(): CurrentRepertoireContextValue {
  const context = useContext(CurrentRepertoireContext);
  if (!context) {
    throw new Error(
      "useCurrentRepertoire must be used within CurrentRepertoireProvider"
    );
  }
  return context;
}
