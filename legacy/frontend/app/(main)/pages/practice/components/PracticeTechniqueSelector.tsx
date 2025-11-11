import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PracticeTechniqueEnum, practiceTechniqueLabels } from "../types";

interface IPracticeTechniqueSelectorProps {
  value?: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function PracticeTechniqueSelector({
  value,
  onValueChange,
  placeholder = "Select technique...",
  disabled = false,
}: IPracticeTechniqueSelectorProps) {
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
          <em className="text-muted-foreground">No specific technique</em>
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
