import { auth } from "@/auth";
// Server page delegates to client loader to obtain browser sitdown date.
import PracticeQueueLoader from "./practice-queue-loader";
import type React from "react";
import { buildSitdownBootstrap } from "./sitdown-bootstrap";

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

  // Option D: purely SSR parse of tt_sitdown param (no server-side Date.now usage for timezone safety).
  // If present, we just echo the raw value to a bootstrap script that seeds localStorage + global.
  // Supported forms (mirrors prior client parsing without the reset branch on the server):
  //   ?tt_sitdown=reset              -> clear stored date & manual flag
  //   ?tt_sitdown=ISO_STRING[,auto]  -> set date (manual unless ,auto)
  const rawSitdownParam = resolvedSearchParams?.tt_sitdown;
  let sitdownBootstrapScript: React.ReactNode = null;
  if (typeof rawSitdownParam === "string" && rawSitdownParam.length > 0) {
    // Build minimal inline script. We avoid any dynamic date generation here.
    // NOTE: Script runs before hydration; guards for idempotency.
    let js = buildSitdownBootstrap(rawSitdownParam);
    // Avoid ending the script early if serialized function ever contained </script>
    js = js.replace(/<\/script>/gi, "<\\/script>");
    sitdownBootstrapScript = <script data-tt="sitdown-bootstrap">{js}</script>;
  }
  return (
    <div className="p-4 space-y-6" data-testid="practice-queue-page">
      {sitdownBootstrapScript}
      <h1 className="text-xl font-semibold">Daily Practice Queue</h1>
      <PracticeQueueLoader
        userId={Number(session.user.id)}
        playlistId={playlistId}
        forceRegen={forceRegen}
      />
    </div>
  );
}
