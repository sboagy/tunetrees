/**
 * UI Appearance Settings Page
 *
 * Settings for customizing the user interface appearance.
 *
 * @module routes/user-settings/appearance
 */

import type { Component } from "solid-js";
import {
  getSidebarFontClasses,
  type SidebarFontSize,
  useUIPreferences,
} from "@/lib/context/UIPreferencesContext";

const AppearancePage: Component = () => {
  const { sidebarFontSize, setSidebarFontSize } = useUIPreferences();

  const handleFontSizeChange = (size: SidebarFontSize) => {
    setSidebarFontSize(size);
  };

  const fontSizeOptions: Array<{
    value: SidebarFontSize;
    label: string;
    description: string;
  }> = [
    {
      value: "small",
      label: "Small",
      description: "Compact view (default)",
    },
    {
      value: "medium",
      label: "Medium",
      description: "Balanced readability",
    },
    {
      value: "large",
      label: "Large",
      description: "Maximum readability",
    },
  ];

  return (
    <div class="space-y-6">
      <div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
          Appearance
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Customize the visual appearance of the application.
        </p>
      </div>

      <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
        <div class="space-y-4">
          {/* Sidebar Font Size */}
          <div>
            <h4
              class="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2"
              id="sidebar-font-size-label"
            >
              Sidebar Font Size
            </h4>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Adjust the font size in the sidebar (References and Notes panels).
            </p>

            <div
              class="space-y-2"
              role="radiogroup"
              aria-labelledby="sidebar-font-size-label"
            >
              {fontSizeOptions.map((option) => {
                const isSelected = () => sidebarFontSize() === option.value;
                const fontClasses = getSidebarFontClasses(option.value);
                const radioId = `font-size-${option.value}`;

                return (
                  <div
                    class={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                      isSelected()
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
                    }`}
                    data-testid={`font-size-option-${option.value}`}
                  >
                    <label
                      for={radioId}
                      class="w-full cursor-pointer flex items-start justify-between"
                    >
                      <input
                        type="radio"
                        id={radioId}
                        name="sidebar-font-size"
                        value={option.value}
                        checked={isSelected()}
                        onChange={() => handleFontSizeChange(option.value)}
                        class="sr-only"
                      />
                      <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                          <span class="font-semibold text-gray-900 dark:text-gray-100">
                            {option.label}
                          </span>
                          {isSelected() && (
                            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                              Current
                            </span>
                          )}
                        </div>
                        <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {option.description}
                        </p>
                        {/* Preview */}
                        <div class="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                          <p
                            class={`${fontClasses.text} text-gray-700 dark:text-gray-300`}
                          >
                            Sample sidebar text
                          </p>
                          <p
                            class={`${fontClasses.textSmall} text-gray-500 dark:text-gray-400 mt-1`}
                          >
                            Sample smaller text (dates, labels)
                          </p>
                        </div>
                      </div>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppearancePage;
