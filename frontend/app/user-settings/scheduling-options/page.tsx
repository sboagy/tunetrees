import { Separator } from "@/components/ui/separator";
import SchedulingOptionsForm2 from "./scheduling-options-form2";

export default function SchedulingOptionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Scheduling Options</h3>
        <p className="text-sm text-muted-foreground">
          Configure scheduling constraints and your practice calendar.
        </p>
      </div>
      <Separator />
      <SchedulingOptionsForm2 />
    </div>
  );
}
