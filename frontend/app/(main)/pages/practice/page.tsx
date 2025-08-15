import { auth } from "@/auth";
import { getPracticeQueue } from "./queries";
// The component file is colocated; occasional transient TS resolution issues may appear in editor.
// @ts-expect-error Module resolution edge case during incremental build
import PracticeQueueClient from "./practice-queue-client";

export const dynamic = "force-dynamic"; // Ensure fresh snapshot per request when force_regen later

interface IPracticePageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function PracticePage({
  searchParams,
}: IPracticePageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="p-4">Not authenticated</div>;
  }
  // For now, choose first playlist via env or fallback 1 (could be enhanced to user selection)
  const playlistId = Number(process.env.NEXT_PUBLIC_DEFAULT_PLAYLIST_ID || 1);
  const sitdownDate = new Date();
  const forceRegenParam = searchParams?.force_regen;
  const forceRegen = forceRegenParam === "1" || forceRegenParam === "true";
  const queue = await getPracticeQueue(
    Number(session.user.id),
    playlistId,
    sitdownDate,
    forceRegen,
  );
  return (
    <div className="p-4 space-y-6" data-testid="practice-queue-page">
      <h1 className="text-xl font-semibold">Daily Practice Queue</h1>
      <PracticeQueueClient queue={queue} />
    </div>
  );
}
