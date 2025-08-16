import { auth } from "@/auth";
// Server page delegates to client loader to obtain browser sitdown date.
import PracticeQueueLoader from "./practice-queue-loader";

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
  const playlistId = Number(process.env.NEXT_PUBLIC_DEFAULT_PLAYLIST_ID || 1);
  const forceRegenParam = searchParams?.force_regen;
  const forceRegen = forceRegenParam === "1" || forceRegenParam === "true";
  return (
    <div className="p-4 space-y-6" data-testid="practice-queue-page">
      <h1 className="text-xl font-semibold">Daily Practice Queue</h1>
      <PracticeQueueLoader
        userId={Number(session.user.id)}
        playlistId={playlistId}
        forceRegen={forceRegen}
      />
    </div>
  );
}
