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
  note_private?: string | null;
  note_public?: string | null;
  tags?: string | null;
  recall_eval?: string | null;
};

export type PlaylistTune = {
  id?: number;
  title?: string;
  type?: string;
  structure?: string;
  mode?: string;
  incipit?: string;
  learned?: string;
  practiced?: string;
  quality?: number;
  easiness?: number;
  interval?: number;
  repetitions?: number;
  review_date?: string;
  backup_practiced?: string;
  note_private?: string;
  note_public?: string;
  tags?: string;
  user_ref?: number;
  playlist_ref?: number;
};

export type ScreenSize = "small" | "full";

export type TablePurpose = "practice" | "repertoire" | "suggestions";

export type TableTransientData = {
  user_id: number;
  tune_id: number;
  playlist_id: number;
  purpose: string;
  note_private: string | null;
  note_public: string | null;
  recall_eval: string | null;
};

export type TableTransientDataFields = {
  note_private: string | null;
  note_public: string | null;
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
