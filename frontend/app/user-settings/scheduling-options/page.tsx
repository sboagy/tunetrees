import { Separator } from "@/components/ui/separator";
import SchedulingOptionsForm from "./scheduling-options-form";

export default function SettingsAccountPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Scheduling Options</h3>
        <p className="text-sm text-muted-foreground">
          Configure your spaced repetition algorithm preferences.
        </p>
      </div>
      <Separator />
      <SchedulingOptionsForm />
    </div>
  );
}
