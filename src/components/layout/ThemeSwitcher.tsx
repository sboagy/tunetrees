/**
 * Theme Switcher Component
 *
 * Button to cycle between light, dark, and system themes
 * Matches legacy: Shows current theme with ability to cycle through modes
 *
 * @module components/layout/ThemeSwitcher
 */

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
      return (
        <svg
          class="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <title>Light mode</title>
          <path
            fill-rule="evenodd"
            d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
            clip-rule="evenodd"
          />
        </svg>
      );
    } else if (currentMode === "dark") {
      return (
        <svg
          class="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <title>Dark mode</title>
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      );
    } else {
      // System mode - show computer/monitor icon
      return (
        <svg
          class="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <title>System mode</title>
          <path
            fill-rule="evenodd"
            d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z"
            clip-rule="evenodd"
          />
        </svg>
      );
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
