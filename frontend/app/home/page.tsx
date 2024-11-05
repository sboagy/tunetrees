"use server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import MainPanel from "../(main)/pages/practice/components/MainPanel";

const HomePage = async () => {
  // console.log("In the HomePage function");
  const session = await auth();

  if (!session) {
    console.log("No session found (HomePage)");
    redirect("/");
  }

  if (!session?.user) {
    console.log("No user found (HomePage)");
    redirect("/");
  }

  console.log("Session found! (HomePage)");

  const userId = (session?.user?.id as string) ?? "1";
  const playlistId = "1";

  return <MainPanel userId={userId} playlistId={playlistId} />;
};

export default HomePage;
