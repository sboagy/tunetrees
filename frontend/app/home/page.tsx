"use server";
import Image from "next/image";
import Logout from "@/components/logout";
import { auth } from "@/auth";

import { redirect } from "next/navigation";
import Practice from "../(main)/pages/practice/page";

const HomePage = async () => {
  console.log("In the HomePage function");
  const session = await auth();

  if (!session) {
    console.log("No session found (HomePage)");
    redirect("/");
  }
    
  if (!session?.user) {
    console.log("No user found (HomePage)");
    redirect("/")
  };

  console.log("Session found! (HomePage)");

  return (
    <Practice />
    // <div className="flex flex-col items-center m-4">
    //   <h1 className="text-3xl my-2">Welcome, {session?.user?.name}</h1>
    //   <Image
    //     src={session?.user?.image ?? ""}
    //     alt={session?.user?.name ?? ""}
    //     width={72}
    //     height={72}
    //     className="rounded-full"
    //   />
    //   <Logout />
    // </div>
  );
};

export default HomePage;