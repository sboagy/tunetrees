"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { MainNav } from "./MainNav";
import PlaylistChooser from "./PlaylistChooser";
import UserButton from "./UserButton";

export default function Header() {
  const { data: session, status } = useSession();
  console.log("===> auth ===> Header.tsx:9 ~ status", status);

  const [key, setKey] = useState(0);

  useEffect(() => {
    console.log("===> auth ===> Header.tsx:14 ~ user", session?.user);
    setKey((prevKey) => prevKey + 1);
  }, [session?.user]);

  return (
    <header className="sticky flex justify-center border-b">
      <div
        key={key}
        className="flex items-center justify-between w-full h-16 max-w-8xl px-4 mx-auto sm:px-6"
      >
        <MainNav />
        <div className="flex">
          {status === "authenticated" && <PlaylistChooser />}
          <div className="w-6" />
          <UserButton />
        </div>
      </div>
    </header>
  );
}
