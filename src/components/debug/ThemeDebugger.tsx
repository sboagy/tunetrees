/**
 * Theme Debugger Component
 *
 * Shows current theme state for debugging
 */

import type { Component } from "solid-js";
import { createEffect, createSignal } from "solid-js";

export const ThemeDebugger: Component = () => {
  const [htmlClass, setHtmlClass] = createSignal("");
  const [themeMode, setThemeMode] = createSignal("");
  const [themeAttr, setThemeAttr] = createSignal("");

  createEffect(() => {
    const updateDebugInfo = () => {
      setHtmlClass(document.documentElement.className);
      setThemeMode(localStorage.getItem("themeMode") || "not set");
      setThemeAttr(
        document.documentElement.getAttribute("data-kb-theme") || "not set"
      );
    };

    updateDebugInfo();
    const interval = setInterval(updateDebugInfo, 500);

    return () => clearInterval(interval);
  });

  return (
    <div class="fixed bottom-4 right-4 bg-black/90 text-white p-4 rounded-lg text-xs font-mono z-50">
      <div class="font-bold mb-2">🔍 Theme Debug</div>
      <div>
        HTML class: <span class="text-yellow-300">{htmlClass()}</span>
      </div>
      <div>
        localStorage: <span class="text-yellow-300">{themeMode()}</span>
      </div>
      <div>
        data-kb-theme: <span class="text-yellow-300">{themeAttr()}</span>
      </div>
    </div>
  );
};
