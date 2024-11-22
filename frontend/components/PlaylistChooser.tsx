"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const playlists = ["Flute", "Banjo", "Fiddle"];

export default function PlaylistChooser() {
  const [selectedPlaylist, setSelectedPlaylist] = useState(playlists[0]);

  const handleSelect = (playlist: string) => {
    setSelectedPlaylist(playlist);
  };

  return (
    <div className="flex items-center space-x-2">
      <span>Playlist:</span>
      <DropdownMenu>
        <DropdownMenuTrigger className="px-4 py-2 border rounded">
          {selectedPlaylist}
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {playlists.map((playlist) => (
            <DropdownMenuItem
              key={playlist}
              onSelect={() => handleSelect(playlist)}
            >
              {playlist}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={() => alert("Manage Playlists...")}>
            Manage Playlists...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
