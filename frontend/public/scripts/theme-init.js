"use strict";
/**
 * Early theme initialization script to prevent flash of unstyled content
 */
(function () {
  let _a, _b, _c, _d;
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
        ((_b =
          (_a =
            window === null || window === void 0
              ? void 0
              : window.matchMedia) === null || _a === void 0
            ? void 0
            : _a.call(window, "(prefers-color-scheme: dark)")) === null ||
        _b === void 0
          ? void 0
          : _b.matches)
      ) {
        // No stored preference, use system preference
        document.documentElement.classList.add("dark");
      }
    }
  } catch (error) {
    // Silent fail - localStorage might be blocked
  }
  // Always mark the theme as initialized to show content
  if (typeof document !== "undefined") {
    (_d =
      (_c = document.documentElement) === null || _c === void 0
        ? void 0
        : _c.setAttribute) === null || _d === void 0
      ? void 0
      : _d.call(_c, "data-theme-initialized", "true");
  }
})();
