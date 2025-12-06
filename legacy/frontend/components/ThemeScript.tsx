"use client";

import Script from "next/script";
import { useEffect } from "react";

export function ThemeScript() {
  useEffect(() => {
    // This runs on the client after hydration
    // It should match the logic in theme-init.js
    try {
      const storedTheme = localStorage.getItem("theme");

      if (storedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else if (storedTheme === "light") {
        document.documentElement.classList.remove("dark");
      } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.classList.add("dark");
      }

      // Make sure the attribute is set for visibility
      document.documentElement.setAttribute("data-theme-initialized", "true");
    } catch {
      // Silent fail
    }
  }, []);

  return null;
}

export function ThemeScriptNoFlash() {
  return (
    <Script
      id="theme-init"
      strategy="beforeInteractive"
      src="/scripts/theme-init.js"
    />
  );
}
