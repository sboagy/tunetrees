import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PracticeGoalEnum, practiceGoalLabels } from "../types";

interface IPracticeGoalSelectorProps {
  value?: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function PracticeGoalSelector({
  value,
  onValueChange,
  placeholder = "Select goal...",
  disabled = false,
}: IPracticeGoalSelectorProps) {
  const handleValueChange = (newValue: string) => {
    // Handle the "none" case for clearing selection
    if (newValue === "none") {
      onValueChange(null);
    } else {
      onValueChange(newValue);
    }
  };

  return (
    <Select
      value={value || "none"}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">
          <em className="text-muted-foreground">No specific goal</em>
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
