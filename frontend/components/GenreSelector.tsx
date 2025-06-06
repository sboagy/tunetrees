import type { IGenre } from "@/app/(main)/pages/practice/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDownIcon } from "lucide-react";
import styles from "./PlaylistChooser.module.css";

interface IGenreSelectorProps {
  genre_default: string | undefined;
  private_to_user: number;
  genres: IGenre[];
  onSelect: (genreId: string) => void;
}

export const GenreSelector = ({
  genre_default,
  private_to_user,
  genres,
  onSelect,
}: IGenreSelectorProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`${styles.column_genre_default} flex ml-3 items-center justify-between ${
          private_to_user === 0 ? "cursor-not-allowed opacity-50" : ""
        }`}
        disabled={private_to_user === 0}
      >
        {genre_default || "(not set)"}
        {private_to_user !== 0 && <ChevronDownIcon className="w-5 h-5" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-60 overflow-y-auto">
        {genres.map((genre) => (
          <DropdownMenuItem
            key={genre.id}
            onSelect={() => {
              onSelect(genre.id);
            }}
            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
          >
            <div className="text-xs">
              <div>{genre.id}</div>
              <div>Name: {genre.name}</div>
              <div>Region: {genre.region}</div>
              <div>Description: {genre.description}</div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
