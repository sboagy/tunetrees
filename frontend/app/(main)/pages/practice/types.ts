export type Tune = {
  id: number;
  title: string;
  type: string | null;
  structure: string | null;
  mode: string | null;
  incipit: string | null;
  learned: string | null;
  practiced: string | null;
  quality: number | null;
  easiness: number | null;
  interval: number | null;
  repetitions: number | null;
  review_date: string | null;
  backup_practiced: string | null;
  external_ref?: string | null;
  notes_private?: string | null;
  notes_public?: string | null;
  tags?: string | null;
  recall_eval?: string | null;
};

export type PlaylistTune = {
  ID?: number;
  Title?: string;
  Type?: string;
  Structure?: string;
  Mode?: string;
  Incipit?: string;
  Learned?: string;
  Practiced?: string;
  Quality?: number;
  Easiness?: number;
  Interval?: number;
  Repetitions?: number;
  ReviewDate?: string;
  BackupPracticed?: string;
  NotePrivate?: string;
  NotePublic?: string;
  Tags?: string;
  USER_REF?: number;
  PLAYLIST_REF?: number;
};

export type ScreenSize = "small" | "full";

export type TablePurpose = "practice" | "repertoire" | "suggestions";

export type TableTransientData = {
  user_id: number;
  tune_id: number;
  playlist_id: number;
  purpose: string;
  notes_private: string | null;
  notes_public: string | null;
  recall_eval: string | null;
};

export type TableTransientDataFields = {
  notes_private: string | null;
  notes_public: string | null;
  recall_eval: string | null;
};

// Define the type for the function parameters
export type FilteredDataParams = {
  data: Tune[];
  criteria: (item: Tune) => boolean;
};

// Define the return type of the function
export type FilteredDataReturnType = Tune[];

// Create the type definition for the filteredData function
export type FilteredDataType = (
  params: FilteredDataParams,
) => FilteredDataReturnType;
