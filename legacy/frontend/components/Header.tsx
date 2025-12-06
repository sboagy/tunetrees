"use client";
import { useSession } from "next-auth/react";
import { MainNav } from "./MainNav";
import PlaylistChooser from "./PlaylistChooser";
import UserButton from "./UserButton";

export default function Header() {
  const { status } = useSession();
  // Removed debug logging: console.log("===> auth ===> Header.tsx:9 ~ status", status);

  return (
    <header className="sticky flex justify-center border-b">
      <div className="flex items-center justify-between w-full h-16 max-w-8xl px-4 mx-auto sm:px-6">
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
