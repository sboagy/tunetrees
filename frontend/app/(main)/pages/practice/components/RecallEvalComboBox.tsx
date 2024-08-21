import { Check, ChevronsUpDown } from "lucide-react";
// RecallEvalRadioGroup.tsx
import React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import type { CellContext } from "@tanstack/react-table";

import type { Tune } from "../types";

const qualityList = [
  {
    value: "",
    label: "(Not Set)",
  },
  {
    value: "failed",
    label: "Failed (no recall)",
  },
  {
    value: "barely",
    label: "Barely Remembered Some (perhaps A part but not B part)",
  },
  {
    value: "struggled",
    label: "Remembered with Some Mistakes (and needed verification)",
  },
  {
    value: "trivial",
    label: "Not Bad (but maybe not session ready)",
  },
  {
    value: "perfect",
    label: "Good (could perform solo or lead in session)",
  },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function RecallEvalComboBox(info: CellContext<Tune, unknown>) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[18em] justify-between"
          style={{ textAlign: "left" }}
        >
          {value
            ? qualityList.find((qualityList) => qualityList.value === value)
                ?.label
            : "Recall Quality..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end">
        <Command>
          {/* <CommandInput placeholder="Recall Eval..." /> */}
          <CommandList>
            <CommandEmpty>Recall Eval...</CommandEmpty>
            <CommandGroup>
              {qualityList.map((qualityList) => (
                <CommandItem
                  key={qualityList.value}
                  value={qualityList.value}
                  onSelect={(currentValue) => {
                    setValue(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === qualityList.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {qualityList.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
export default RecallEvalComboBox;
