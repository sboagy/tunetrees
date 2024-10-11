"use client";

import { useSearchParams } from "next/navigation";
import TuneEditor from "../practice/components/TuneEditor";

const TuneEditPage = (): JSX.Element => {
  console.log("In TuneEditPage");
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");
  const playlistId = searchParams.get("playlistId");
  const tuneId = searchParams.get("tuneId");
  if (!userId || !playlistId || !tuneId) {
    return <div>Missing required parameters for tune edit</div>;
  }
  // return (
  //   <div>
  //     userId: {userId}, playlistId: {playlistId}, tuneId: {tuneId}
  //   </div>
  // );

  return <TuneEditor userId={userId} playlistId={playlistId} tuneId={tuneId} />;
};

export default TuneEditPage;
