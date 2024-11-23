"use server";
import { auth } from "@/auth";
import type { Session } from "next-auth";
import { redirect } from "next/navigation";
import MainPanel from "../(main)/pages/practice/components/MainPanel";

const HomePage = async () => {
  // console.log("In the HomePage function");
  const session: Session | null = await auth();

  if (!session) {
    console.log("No session found (HomePage)");
    redirect("/");
  }

  if (!session?.user) {
    console.log("No user found (HomePage)");
    redirect("/");
  }

  console.log("Session found! (HomePage)");

  const userId = session?.user?.id ? Number.parseInt(session?.user?.id) : 1;

  return <MainPanel userId={userId} />;
};

export default HomePage;
