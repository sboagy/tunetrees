import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CellContext } from "@tanstack/react-table";
import { PracticeTechniqueEnum, practiceTechniqueLabels } from "../types";
import type {
  ITuneOverview,
  TablePurpose,
  TunesGridColumnGeneralType,
} from "../types";

type RowTechniqueComboBoxProps = {
  info: CellContext<ITuneOverview, TunesGridColumnGeneralType>;
  userId: number;
  playlistId: number;
  purpose: TablePurpose;
  onTechniqueChange?: (tuneId: number, newValue: string | null) => void;
};

export function RowTechniqueComboBox(props: RowTechniqueComboBoxProps) {
  const { info, onTechniqueChange } = props;
  const currentTechnique = info.row.original.technique;
  const tuneId = info.row.original.id;

  const handleValueChange = (newValue: string) => {
    if (!onTechniqueChange || !tuneId) return;

    // Handle the "none" case for clearing selection
    if (newValue === "none") {
      onTechniqueChange(tuneId, null);
    } else {
      onTechniqueChange(tuneId, newValue);
    }
  };

  return (
    <Select
      value={currentTechnique || "none"}
      onValueChange={handleValueChange}
    >
      <SelectTrigger className="w-full h-8 text-xs">
        <SelectValue placeholder="Technique..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">
          <em className="text-muted-foreground">Default</em>
        </SelectItem>
        {Object.values(PracticeTechniqueEnum).map((technique) => (
          <SelectItem key={technique} value={technique}>
            {practiceTechniqueLabels[technique]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default RowTechniqueComboBox;
