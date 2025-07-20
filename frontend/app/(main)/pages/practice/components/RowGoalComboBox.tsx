import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CellContext } from "@tanstack/react-table";
import { PracticeGoalEnum, practiceGoalLabels } from "../types";
import type {
  ITuneOverview,
  TablePurpose,
  TunesGridColumnGeneralType,
} from "../types";

type RowGoalComboBoxProps = {
  info: CellContext<ITuneOverview, TunesGridColumnGeneralType>;
  userId: number;
  playlistId: number;
  purpose: TablePurpose;
  onGoalChange?: (tuneId: number, newValue: string | null) => void;
};

export function RowGoalComboBox(props: RowGoalComboBoxProps) {
  const { info, onGoalChange } = props;
  const currentGoal = info.row.original.goal;
  const tuneId = info.row.original.id;

  const handleValueChange = (newValue: string) => {
    if (!onGoalChange || !tuneId) return;

    // Handle the "none" case for clearing selection
    if (newValue === "none") {
      onGoalChange(tuneId, null);
    } else {
      onGoalChange(tuneId, newValue);
    }
  };

  return (
    <Select value={currentGoal || "none"} onValueChange={handleValueChange}>
      <SelectTrigger className="w-full h-8 text-xs">
        <SelectValue placeholder="Goal..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">
          <em className="text-muted-foreground">Default</em>
        </SelectItem>
        {Object.values(PracticeGoalEnum).map((goal) => (
          <SelectItem key={goal} value={goal}>
            {practiceGoalLabels[goal]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default RowGoalComboBox;
