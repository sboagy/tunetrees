/**
 * Current Repertoire Context
 *
 * Global state management for the currently selected repertoire.
 * All components that need to know which repertoire is active should use this context.
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

/**
 * CurrentRepertoireProvider - Tracks which repertoire is currently selected
 *
 * This context allows all components to reactively respond to repertoire changes
 * without prop drilling through the entire component tree.
 *
 * Usage:
 * ```tsx
 * // In TopNav or Practice tab:
 * const { setCurrentRepertoireId } = useCurrentRepertoire();
 * setCurrentRepertoireId(repertoireId);
 *
 * // In any component that needs to know current repertoire:
 * const { currentRepertoireId } = useCurrentRepertoire();
 * const [tunes] = createResource(currentRepertoireId, loadTunesForRepertoire);
 * ```
 */
export const CurrentRepertoireProvider: ParentComponent = (props) => {
  const [currentRepertoireId, setCurrentRepertoireId] = createSignal<string | null>(
    null
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

/**
 * useCurrentRepertoire - Access current repertoire context
 *
 * @throws Error if used outside CurrentRepertoireProvider
 */
export function useCurrentRepertoire(): CurrentRepertoireContextValue {
  const context = useContext(CurrentRepertoireContext);
  if (!context) {
    throw new Error(
      "useCurrentRepertoire must be used within CurrentRepertoireProvider"
    );
  }
  return context;
}
