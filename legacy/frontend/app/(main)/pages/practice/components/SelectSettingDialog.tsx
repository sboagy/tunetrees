import abcjs from "abcjs";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface ISelectSettingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: { abc: string; id: number }[];
  onSettingSelect: (settingIndex: number) => void;
}

export function SelectSettingDialog({
  open,
  onOpenChange,
  settings,
  onSettingSelect,
}: ISelectSettingDialogProps): JSX.Element {
  const [selectedValue, setSelectedValue] = useState<number | null>(null);
  const [renderedAbc, setRenderedAbc] = useState<string[]>([]);

  useEffect(() => {
    if (settings && settings.length > 0) {
      const abcSnippets = settings.map((setting) => {
        try {
          const tuneParsed = abcjs.parseOnly(setting.abc);
          if (tuneParsed.length > 0) {
            const firstTune = tuneParsed[0];
            const lines = firstTune.lines;
            let abcSnippet = "";
            let barCount = 0;
            for (const line of lines) {
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
                    abcSnippet += setting.abc.slice(
                      subElement.startChar,
                      subElement.endChar,
                    );
                  }
                }
                if (barCount > 2) break;
              }
              if (barCount > 2) break;
            }
            return `${abcSnippet}|`;
          }
          return "Failed to parse ABC notation.";
        } catch (error) {
          console.error("Error parsing ABC notation:", error);
          return "Error parsing ABC notation.";
        }
      });
      setRenderedAbc(abcSnippets);
    }
  }, [settings]);

  const handleSettingSelect = () => {
    if (selectedValue !== null) {
      onSettingSelect(selectedValue);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[60ch]">
        <DialogHeader>
          <DialogTitle>Select a Setting</DialogTitle>
          <DialogDescription>
            Please select the setting incipit that you would like to use. You
            may edit the incipit later.
          </DialogDescription>
          <hr />
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto">
          <RadioGroup
            defaultValue={
              selectedValue !== null ? selectedValue.toString() : undefined
            }
            onValueChange={(value) => setSelectedValue(Number.parseInt(value))}
          >
            {settings.map((setting, index) => (
              <div
                key={setting.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={index.toString()}
                    id={`setting-${index}`}
                  />
                  <Label htmlFor={`setting-${index}`} className="mr-2">
                    Setting {index + 1}
                  </Label>
                </div>
                <div
                  id={`abc-${index}`}
                  ref={(el) => {
                    if (el && renderedAbc[index]) {
                      abcjs.renderAbc(el, renderedAbc[index], {
                        scale: 0.75,
                        paddingleft: 0,
                        paddingright: 0,
                        paddingtop: 0,
                        paddingbottom: 0,
                      });
                    }
                  }}
                />
              </div>
            ))}
          </RadioGroup>
        </div>
        <hr />
        <DialogFooter className="max-w-[60ch] flex justify-end pr-8">
          <Button
            variant="ghost"
            onClick={handleSettingSelect}
            disabled={selectedValue === null}
            data-testid="tt-select-setting"
          >
            Select Setting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
