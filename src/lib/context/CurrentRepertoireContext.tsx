/**
 * Current Repertoire Context
 *
 * Global state management for the currently selected repertoire.
 *
 * @module lib/context/CurrentRepertoireContext
 */

import {
  createContext,
  createEffect,
  createSignal,
  on,
  type ParentComponent,
  useContext,
} from "solid-js";

import { useAuth } from "../auth/AuthContext";

interface CurrentRepertoireContextValue {
  currentRepertoireId: () => string | null;
  setCurrentRepertoireId: (id: string | null) => void;
}

const CurrentRepertoireContext = createContext<CurrentRepertoireContextValue>();

export const CurrentRepertoireProvider: ParentComponent = (props) => {
  const [currentRepertoireId, setCurrentRepertoireId] = createSignal<
    string | null
  >(null);

  const { user } = useAuth();
  // This provider survives route changes. Never carry an account's selection
  // into another session; the dropdown restores that user's saved selection.
  createEffect(
    on(
      () => user()?.id,
      (userId, previousUserId) => {
        if (userId !== previousUserId) setCurrentRepertoireId(null);
      }
    )
  );

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
