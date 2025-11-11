import { auth } from "@/auth";
import { Separator } from "@/components/ui/separator";
import { getSchedulingOptions } from "./queries-scheduling-options";
import SchedulingOptionsForm from "./scheduling-options-form";

export const dynamic = "force-dynamic";

export default async function SchedulingOptionsPage() {
  const session = await auth();
  const userId = session?.user?.id ? Number.parseInt(session.user.id) : -1;
  // Read prefs only when userId is valid at request time; this avoids build-time env reads.
  const initialPrefs = userId > 0 ? await getSchedulingOptions(userId) : null;
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Scheduling Options</h3>
        <p className="text-sm text-muted-foreground">
          Configure scheduling constraints and your practice calendar.
        </p>
      </div>
      <Separator />
      <SchedulingOptionsForm initialPrefs={initialPrefs} />
    </div>
  );
}
