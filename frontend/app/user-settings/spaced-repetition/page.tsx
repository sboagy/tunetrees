import { Separator } from "@/components/ui/separator";
import SpacedRepetitionForm from "@/app/user-settings/spaced-repetition/spaced-repetition-form";

export default function SpacedRepetitionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Spaced Repetition</h3>
        <p className="text-sm text-muted-foreground">
          Configure your spaced repetition algorithm preferences (FSRS/SM2).
        </p>
      </div>
      <Separator />
      <SpacedRepetitionForm />
    </div>
  );
}
