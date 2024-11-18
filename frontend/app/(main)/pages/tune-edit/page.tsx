"use client";

import { useSearchParams } from "next/navigation";
import type { JSX } from "react";
import { Suspense } from "react";
import TuneEditor from "../practice/components/TuneEditor";

function TuneEditPageContent(): JSX.Element {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");
  const playlistId = searchParams.get("playlistId");
  const tuneId = searchParams.get("tuneId");

  if (!userId || !playlistId || !tuneId) {
    return <div>Missing required parameters for tune edit</div>;
  }

  const userIdInt = Number.parseInt(userId);
  const playlistIdInt = Number.parseInt(playlistId);
  const tuneIdInt = Number(tuneId);

  return (
    <TuneEditor
      userId={userIdInt}
      playlistId={playlistIdInt}
      tuneId={tuneIdInt}
    />
  );
}

const TuneEditPage = (): JSX.Element => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TuneEditPageContent />
    </Suspense>
  );
};

export default TuneEditPage;
