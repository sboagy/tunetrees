import type { CellContext } from "@tanstack/react-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ITuneOverview,
  TablePurpose,
  TunesGridColumnGeneralType,
} from "../types";
import { PracticeGoalEnum, practiceGoalLabels } from "../types";

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

  // Default to RECALL when goal is null
  const displayGoal = currentGoal || PracticeGoalEnum.RECALL;

  const handleValueChange = (newValue: string) => {
    if (!onGoalChange || !tuneId) return;
    onGoalChange(tuneId, newValue);
  };

  return (
    <Select value={displayGoal} onValueChange={handleValueChange}>
      <SelectTrigger className="w-full h-8 text-xs">
        <SelectValue placeholder="Goal..." />
      </SelectTrigger>
      <SelectContent>
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
