import { auth } from "@/auth";
// Server page delegates to client loader to obtain browser sitdown date.
import PracticeQueueLoader from "./practice-queue-loader";

export const dynamic = "force-dynamic"; // Ensure fresh snapshot per request when force_regen later

type TRawSearchParams = Record<string, string | string[] | undefined>;

export default async function PracticePage({
  searchParams,
}: {
  // Align with Next.js 15 PageProps constraint (Promise | undefined)
  searchParams?: Promise<TRawSearchParams>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="p-4">Not authenticated</div>;
  }
  const playlistId = Number(process.env.NEXT_PUBLIC_DEFAULT_PLAYLIST_ID || 1);
  // Await promise-based searchParams per Next.js 15
  let resolvedSearchParams: TRawSearchParams | undefined;
  if (searchParams) {
    try {
      resolvedSearchParams = await searchParams;
    } catch {
      resolvedSearchParams = undefined;
    }
  }
  const forceRegenParam = resolvedSearchParams?.force_regen;
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
