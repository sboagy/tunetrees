/**
 * UI Preferences Context
 *
 * Manages user interface preferences like sidebar font size.
 * Persists to localStorage for immediate availability on page load.
 *
 * @module lib/context/UIPreferencesContext
 */

import {
  createContext,
  createSignal,
  onMount,
  useContext,
  type ParentComponent,
} from "solid-js";

export type SidebarFontSize = "small" | "medium" | "large";

interface UIPreferences {
  sidebarFontSize: SidebarFontSize;
}

interface UIPreferencesContextType {
  sidebarFontSize: () => SidebarFontSize;
  setSidebarFontSize: (size: SidebarFontSize) => void;
}

const UIPreferencesContext = createContext<UIPreferencesContextType>();

const STORAGE_KEY = "ui-preferences";
const DEFAULT_PREFERENCES: UIPreferences = {
  sidebarFontSize: "small",
};

/**
 * UI Preferences Provider
 *
 * Provides UI preferences to the app and persists to localStorage
 */
export const UIPreferencesProvider: ParentComponent = (props) => {
  const [sidebarFontSize, setSidebarFontSizeSignal] =
    createSignal<SidebarFontSize>(DEFAULT_PREFERENCES.sidebarFontSize);

  // Load preferences from localStorage on mount
  onMount(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const prefs = JSON.parse(stored) as UIPreferences;
        // Validate the font size value
        if (
          prefs.sidebarFontSize === "small" ||
          prefs.sidebarFontSize === "medium" ||
          prefs.sidebarFontSize === "large"
        ) {
          setSidebarFontSizeSignal(prefs.sidebarFontSize);
        }
      }
    } catch (error) {
      console.error("Failed to load UI preferences from localStorage:", error);
      // Fall back to default preferences
      setSidebarFontSizeSignal(DEFAULT_PREFERENCES.sidebarFontSize);
    }
  });

  const setSidebarFontSize = (size: SidebarFontSize) => {
    setSidebarFontSizeSignal(size);

    // Save to localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const prefs = stored ? (JSON.parse(stored) as UIPreferences) : { ...DEFAULT_PREFERENCES };
      prefs.sidebarFontSize = size;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (error) {
      console.error("Failed to save UI preferences to localStorage:", error);
    }
  };

  const value: UIPreferencesContextType = {
    sidebarFontSize,
    setSidebarFontSize,
  };

  return (
    <UIPreferencesContext.Provider value={value}>
      {props.children}
    </UIPreferencesContext.Provider>
  );
};

/**
 * Hook to access UI preferences
 */
export function useUIPreferences(): UIPreferencesContextType {
  const context = useContext(UIPreferencesContext);
  if (!context) {
    throw new Error("useUIPreferences must be used within UIPreferencesProvider");
  }
  return context;
}

/**
 * Get font size classes for sidebar based on preference
 */
export function getSidebarFontClasses(size: SidebarFontSize): {
  text: string;
  textSmall: string;
  icon: string;
  iconSmall: string;
} {
  switch (size) {
    case "small":
      return {
        text: "text-xs",
        textSmall: "text-[10px]",
        icon: "w-3.5 h-3.5",
        iconSmall: "w-2.5 h-2.5",
      };
    case "medium":
      return {
        text: "text-sm",
        textSmall: "text-xs",
        icon: "w-4 h-4",
        iconSmall: "w-3 h-3",
      };
    case "large":
      return {
        text: "text-base",
        textSmall: "text-sm",
        icon: "w-5 h-5",
        iconSmall: "w-4 h-4",
      };
    default:
      // Fallback to small if invalid value
      return {
        text: "text-xs",
        textSmall: "text-[10px]",
        icon: "w-3.5 h-3.5",
        iconSmall: "w-2.5 h-2.5",
      };
  }
}
