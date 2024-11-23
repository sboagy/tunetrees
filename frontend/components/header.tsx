"use client";
import { MainNav } from "./MainNav";
import PlaylistChooser from "./PlaylistChooser";
import UserButton from "./UserButton";

export default function Header() {
  return (
    <header className="sticky flex justify-center border-b">
      <div className="flex items-center justify-between w-full h-16 max-w-8xl px-4 mx-auto sm:px-6">
        <MainNav />
        <PlaylistChooser />
        <UserButton />
      </div>
    </header>
  );
}
