/**
 * Early theme initialization script to prevent flash of unstyled content
 */

(() => {
  try {
    // Simple check if we can access localStorage safely
    if (typeof localStorage !== "undefined") {
      // Get theme preference
      const storedTheme = localStorage.getItem("theme");

      // Apply stored theme or check system preference
      if (storedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else if (storedTheme === "light") {
        document.documentElement.classList.remove("dark");
      } else if (
        typeof window !== "undefined" &&
        window?.matchMedia?.("(prefers-color-scheme: dark)")?.matches
      ) {
        // No stored preference, use system preference
        document.documentElement.classList.add("dark");
      }
    }
  } catch {
    // Silent fail - localStorage might be blocked
  }

  // Always mark the theme as initialized to show content
  if (typeof document !== "undefined") {
    document.documentElement?.setAttribute?.("data-theme-initialized", "true");
  }
})();
