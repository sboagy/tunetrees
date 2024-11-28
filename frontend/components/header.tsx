"use client";
import TabsMenu from "@/app/(main)/pages/practice/components/TabsMenu"; // Add this import
import { MainNav } from "./MainNav";
import PlaylistChooser from "./PlaylistChooser";
import UserButton from "./UserButton";

export default function Header() {
  return (
    <header className="sticky flex justify-center border-b">
      <div className="flex items-center justify-between w-full h-16 max-w-8xl px-4 mx-auto sm:px-6">
        <MainNav />
        <div className="flex">
          <TabsMenu /> {/* Move this component */}
          <div className="w-6" /> {/* Add this spacer */}
          <PlaylistChooser />
          <div className="w-6" />
          <UserButton />
        </div>
      </div>
    </header>
  );
}
