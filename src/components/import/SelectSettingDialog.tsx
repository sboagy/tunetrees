/**
 * Select Setting Dialog Component
 *
 * Dialog for selecting a specific setting/version of a tune from TheSession.org.
 * Displays ABC notation previews for each setting to help user choose.
 *
 * @module components/import/SelectSettingDialog
 */

import abcjs from "abcjs";
import type { Component } from "solid-js";
import { createEffect, createSignal, For, onCleanup } from "solid-js";
import {
  AlertDialog,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";

export interface SettingOption {
  abc: string;
  id: number;
}

export interface SelectSettingDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** List of setting options to choose from */
  settings: SettingOption[];
  /** Callback when user selects a setting (receives the setting index) */
  onSettingSelect: (settingIndex: number) => void;
}

/**
 * Renders a single setting option with ABC notation preview
 */
const SettingOption: Component<{
  setting: SettingOption;
  index: number;
  selected: boolean;
  onSelect: (index: number) => void;
}> = (props) => {
  let abcContainer: HTMLDivElement | undefined;

  createEffect(() => {
    if (abcContainer && props.setting.abc) {
      try {
        // Parse ABC to extract first 2 bars for preview
        const tuneParsed = abcjs.parseOnly(props.setting.abc);
        if (tuneParsed.length > 0) {
          const firstTune = tuneParsed[0];
          let abcSnippet = "";
          let barCount = 0;

          for (const line of firstTune.lines) {
            if (!line.staff) continue;
            for (const element of line.staff) {
              for (const subElement of element.voices?.flat() || []) {
                if (subElement.el_type === "bar") {
                  barCount++;
                }
                if (barCount > 2) break;

                if (
                  (subElement.el_type === "note" ||
                    subElement.el_type === "bar") &&
                  "startChar" in subElement &&
                  "endChar" in subElement
                ) {
                  abcSnippet += props.setting.abc.slice(
                    subElement.startChar,
                    subElement.endChar
                  );
                }
              }
              if (barCount > 2) break;
            }
            if (barCount > 2) break;
          }

          // Render the snippet
          abcjs.renderAbc(abcContainer, `${abcSnippet}|`, {
            scale: 0.75,
            paddingleft: 0,
            paddingright: 0,
            paddingtop: 0,
            paddingbottom: 0,
            responsive: "resize",
          });
        }
      } catch (error) {
        console.error("Error rendering ABC notation:", error);
        if (abcContainer) {
          abcContainer.textContent = "Error rendering notation";
        }
      }
    }
  });

  onCleanup(() => {
    if (abcContainer) {
      abcContainer.innerHTML = "";
    }
  });

  return (
    <div class="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <label class="flex items-center gap-3 cursor-pointer">
        <input
          type="radio"
          name="setting-selection"
          value={props.index}
          checked={props.selected}
          onChange={() => props.onSelect(props.index)}
          class="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-blue-600"
        />
        <span class="text-sm font-medium text-gray-900 dark:text-gray-100">
          Setting {props.index + 1}
        </span>
      </label>
      <div
        ref={abcContainer}
        class="flex-1 ml-4"
        style={{ "min-height": "60px" }}
      />
    </div>
  );
};

/**
 * Dialog for selecting one setting from multiple tune settings.
 * Displays ABC notation previews to help user identify the correct version.
 */
export const SelectSettingDialog: Component<SelectSettingDialogProps> = (
  props
) => {
  const [selectedIndex, setSelectedIndex] = createSignal<number | null>(null);

  const handleSelectSetting = () => {
    const index = selectedIndex();
    if (index !== null) {
      props.onSettingSelect(index);
      props.onOpenChange(false);
    }
  };

  const handleCancel = () => {
    props.onOpenChange(false);
  };

  return (
    <AlertDialog open={props.open} onOpenChange={props.onOpenChange}>
      <AlertDialogContent class="max-w-3xl">
        <AlertDialogCloseButton />
        <AlertDialogHeader>
          <AlertDialogTitle>Select a Setting</AlertDialogTitle>
          <AlertDialogDescription>
            Please select the setting incipit that you would like to use. You
            may edit the incipit later.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Settings List with ABC Previews */}
        <div class="max-h-96 overflow-y-auto space-y-2">
          <For each={props.settings}>
            {(setting, index) => (
              <SettingOption
                setting={setting}
                index={index()}
                selected={selectedIndex() === index()}
                onSelect={setSelectedIndex}
              />
            )}
          </For>
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSelectSetting}
            disabled={selectedIndex() === null}
          >
            Select Setting
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
