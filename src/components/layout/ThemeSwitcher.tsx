/**
 * Theme Switcher Component
 *
 * Button to cycle between light, dark, and system themes
 * Matches legacy: Shows current theme with ability to cycle through modes
 *
 * @module components/layout/ThemeSwitcher
 */

import { Monitor, Moon, Sun } from "lucide-solid";
import { type Component, createEffect, createSignal, onMount } from "solid-js";

type ThemeMode = "light" | "dark" | "system";

interface ThemeSwitcherProps {
  showLabel?: boolean; // Show text label next to icon (default: false)
}

/**
 * Theme Switcher Component
 *
 * Features:
 * - Shows current theme mode (Light/Dark/System) with icon
 * - Click to cycle through: Light → Dark → System → Light
 * - Persists theme mode to localStorage
 * - System mode follows OS preference automatically
 */
export const ThemeSwitcher: Component<ThemeSwitcherProps> = (props) => {
  const [mode, setMode] = createSignal<ThemeMode>("system");

  // Get effective theme based on mode
  const getEffectiveTheme = (themeMode: ThemeMode): "light" | "dark" => {
    if (themeMode === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return themeMode;
  };

  // Load theme mode on mount
  onMount(() => {
    const stored = localStorage.getItem("themeMode") as ThemeMode | null;
    if (stored) {
      setMode(stored);
    } else {
      setMode("system");
    }
  });

  // Apply theme when mode changes
  createEffect(() => {
    const html = document.documentElement;
    const currentMode = mode();
    const effectiveTheme = getEffectiveTheme(currentMode);

    if (effectiveTheme === "dark") {
      html.classList.add("dark");
      html.setAttribute("data-kb-theme", "dark");
    } else {
      html.classList.remove("dark");
      html.setAttribute("data-kb-theme", "light");
    }

    localStorage.setItem("themeMode", currentMode);
  });

  // Listen to system theme changes when in system mode
  onMount(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (mode() === "system") {
        // Trigger effect by setting mode again
        setMode("system");
      }
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  });

  const cycleTheme = () => {
    setMode((prev) => {
      if (prev === "light") return "dark";
      if (prev === "dark") return "system";
      return "light";
    });
  };

  const getIcon = () => {
    const currentMode = mode();
    if (currentMode === "light") {
      return <Sun class="w-5 h-5" aria-hidden="true" />;
    } else if (currentMode === "dark") {
      return <Moon class="w-5 h-5" aria-hidden="true" />;
    } else {
      return <Monitor class="w-5 h-5" aria-hidden="true" />;
    }
  };

  const getLabel = () => {
    const currentMode = mode();
    if (currentMode === "light") return "Light";
    if (currentMode === "dark") return "Dark";
    return "System";
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      class="flex items-center gap-2 w-full px-4 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 group"
      classList={{
        "justify-center w-9 h-9 p-0": !props.showLabel,
        "justify-start text-left text-sm": props.showLabel,
      }}
      aria-label={`Theme: ${getLabel()} - Click to cycle`}
    >
      <span class="flex-shrink-0">{getIcon()}</span>
      {props.showLabel && <span class="flex-1">Theme: {getLabel()}</span>}
      {/* Tooltip - only show when label is hidden */}
      {!props.showLabel && (
        <span class="absolute bottom-full mb-2 px-2 py-1 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {getLabel()}
        </span>
      )}
    </button>
  );
};
