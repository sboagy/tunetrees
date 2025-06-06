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
import type { JSX } from "react";
import { useState } from "react";
import type { ITheSessionTuneSummary } from "../types";

interface ISelectTuneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tunes: ITheSessionTuneSummary[];
  onTuneSelect: (url: string) => void;
}

export function SelectTuneDialog({
  open,
  onOpenChange,
  tunes,
  onTuneSelect,
}: ISelectTuneDialogProps): JSX.Element {
  const [selectedValue, setSelectedValue] = useState<string | null>(null);

  const handleTuneSelect = () => {
    if (selectedValue) {
      onTuneSelect(selectedValue);
      onOpenChange(false); // Close the dialog after selection
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select a Tune from thesession.org</DialogTitle>
          <DialogDescription>
            Please select the tune that best matches your search.
          </DialogDescription>
          <hr />
        </DialogHeader>
        <RadioGroup
          defaultValue={selectedValue ?? undefined}
          onValueChange={setSelectedValue}
        >
          {tunes.map((tune) => (
            <div key={tune.url} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={tune.url} id={tune.url} />
                <Label htmlFor={tune.url} className="mr-2">
                  {tune.name} ({tune.type})
                </Label>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(event) => {
                  event.preventDefault(); // Prevent radio group from changing
                  window.open(tune.url, "_blank");
                }}
              >
                Open URL
              </Button>
            </div>
          ))}
        </RadioGroup>
        <hr />
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={handleTuneSelect}
            disabled={!selectedValue}
          >
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
