import { getAllGenres } from "@/app/(main)/pages/practice/queries";
import type { IGenre } from "@/app/(main)/pages/practice/types";
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

interface IGenreContextType {
  genres: IGenre[];
  isGenresLoading: boolean;
}

const GenreContext = createContext<IGenreContextType | undefined>(undefined);

export const GenreProvider = ({ children }: { children: ReactNode }) => {
  const [genres, setGenres] = useState<IGenre[]>([]);
  const [isGenresLoading, setIsGenresLoading] = useState(true);

  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const genresData = await getAllGenres();
        if (Array.isArray(genresData)) {
          setGenres(genresData);
        } else {
          console.error("Error fetching genres:", genresData);
        }
      } catch (error) {
        console.error("Error fetching genres:", error);
      } finally {
        setIsGenresLoading(false);
      }
    };

    void fetchGenres();
  }, []);

  return (
    <GenreContext.Provider value={{ genres, isGenresLoading }}>
      {children}
    </GenreContext.Provider>
  );
};

export const useGenresList = () => {
  const context = useContext(GenreContext);
  if (!context) {
    throw new Error("useGenre must be used within a GenreProvider");
  }
  return context;
};
