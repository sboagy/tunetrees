/**
 * Early theme initialization script to prevent flash of unstyled content
 */
(() => {
  var _a, _b, _c, _d, mq, storedTheme, docEl;
  try {
    // Simple check if we can access localStorage safely
    if (typeof localStorage !== "undefined") {
      // Get theme preference
      storedTheme = localStorage.getItem("theme");
      // Apply stored theme or check system preference
      if (storedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else if (storedTheme === "light") {
        document.documentElement.classList.remove("dark");
      } else if (typeof window !== "undefined") {
        // No stored preference, use system preference
        try {
          mq = window.matchMedia
            ? window.matchMedia("(prefers-color-scheme: dark)")
            : null;
          if (mq?.matches) {
            document.documentElement.classList.add("dark");
          }
        } catch {
          // ignore matchMedia errors in some environments
        }
      }
    }
  } catch (_e) {
    // Silent fail - localStorage might be blocked
  }
  // Always mark the theme as initialized to show content
  if (typeof document !== "undefined") {
    docEl = document.documentElement;
    if (docEl && typeof docEl.setAttribute === "function") {
      docEl.setAttribute("data-theme-initialized", "true");
    }
  }
})();
