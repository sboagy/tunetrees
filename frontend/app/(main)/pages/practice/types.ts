// In the following, id may be ommited in the case of a new tune.
// I might be better to use a base class for a new tune, and then

import type { TableState } from "@tanstack/react-table";
import type { JSX } from "react";

export type ScreenSize = "small" | "full";

export type TablePurpose = "practice" | "repertoire" | "catalog";

export interface ITableTransientData {
  user_id: number;
  tune_id: number;
  playlist_id: number;
  purpose: string;
  note_private: string | null;
  note_public: string | null;
  recall_eval: string | null;
}

export interface ITableTransientDataFields {
  note_private: string | null;
  note_public: string | null;
  recall_eval: string | null;
}

// Define the type for the function parameters
export interface IFilteredDataParams {
  data: ITuneOverview[];
  criteria: (item: ITuneOverview) => boolean;
}

// Define the return type of the function
export type FilteredDataReturnType = ITuneOverview[];

// Create the type definition for the filteredData function
export type FilteredDataType = (
  params: IFilteredDataParams,
) => FilteredDataReturnType;

export type TunesGridColumnGeneralType =
  | string
  | number
  | null
  | JSX.Element
  | undefined;

export enum UpdateActionType {
  CREATE = "create",
  DELETE = "delete",
  UPDATE = "update",
}

export interface IReferenceData {
  tune_ref?: number;
  user_ref?: number;
  public: number | null;
  id?: number;
  url: string;
  ref_type: string;
  favorite: number | null;
  comment: string | null;
  title?: string;
  deleted?: boolean | false;
  isNew?: boolean;
}

export interface INote {
  id?: number;
  user_ref: number;
  tune_ref: number;
  playlist_ref?: number | null;
  created_date?: string | null;
  note_text: string | null;
  public: boolean | false;
  favorite: boolean | false;
  deleted?: boolean | false;
  isNew?: boolean;
}

export interface ITableStateTable {
  user_id: number;
  screen_size: ScreenSize;
  purpose: TablePurpose;
  playlist_id: number;
  settings: string | TableState;
  current_tune?: number | null;
}

export interface ITune {
  id?: number;
  title?: string | null;
  type?: string | null;
  structure?: string | null;
  private_for: number | null;
  mode?: string | null;
  incipit?: string | null;
  genre?: string | null;
  deleted?: boolean | false;
  private_for_user?: number | null;
}

export interface ITuneOverride {
  id: number;
  tune_ref: number;
  user_ref: number;
  title?: string | null;
  type?: string | null;
  structure?: string | null;
  genre?: string | null;
  mode?: string | null;
  incipit?: string | null;
  deleted?: boolean | false;
}

export interface ITuneOverview extends ITune {
  user_ref?: number | null;
  playlist_ref?: number | null;
  learned: string | null;
  practiced: string | null;
  quality: number | null;
  easiness: number | null;
  interval: number | null;
  repetitions: number | null;
  review_date: string | null;
  backup_practiced?: string | null;
  external_ref?: string | null;
  tags?: string | null;
  recall_eval?: string | null;
  notes?: string | null;
  favorite_url?: string | null;
  playlist_deleted?: boolean | null;
}

export interface ITuneOverviewImported extends ITuneOverview {
  import_url: string | null;
}

export interface IPracticeRecord {
  id: number;
  playlist_ref?: number;
  tune_ref?: number;
  practiced?: string;
  quality?: number;
  easiness?: number;
  interval?: number;
  repetitions?: number;
  review_date?: string;
  backup_practiced?: string;
  stability?: number;
  elapsed_days?: number;
  lapses?: number;
  state?: number;
}

export interface ITuneOverviewScheduled extends ITuneOverview {
  recall_eval?: string | null;
}

export interface IPlaylistTune {
  playlist_ref: number;
  tune_ref: number;
  current: string;
  learned: string;
  deleted?: boolean | null;
}

export interface IPlaylist {
  playlist_id: number;
  user_ref: number;
  instrument_ref: number;
  deleted?: boolean | null;
}

export interface IInstrument {
  id: number;
  private_to_user: number;
  instrument: string;
  description?: string;
  genre_default?: string;
  deleted?: boolean | null;
}

export interface ITTResponseInfo {
  success?: string;
  detail?: string;
}

export interface IGenre {
  id: string;
  name: string;
  description?: string;
  region?: string;
}

export interface IViewPlaylistJoined {
  playlist_id: number;
  user_ref: number;
  playlist_deleted: boolean;
  instrument_ref: number;
  private_to_user?: number;
  instrument: string;
  description?: string;
  genre_default?: string;
  instrument_deleted?: boolean;
}

export interface IAccount {
  user_id: string;
  provider_account_id: string;
  provider: string;
  type: string; // Assuming AccountType is a string, adjust if necessary
  access_token?: string | null;
  token_type?: string | null;
  id_token?: string | null;
  scope?: string | null;
  expires_at?: number | null;
  session_state?: string | null;
  refresh_token?: string | null;
}

export interface ISession {
  expires?: string;
  session_token: string;
  user_id?: number;
}

export interface IUser {
  id?: string;
  name?: string;
  email?: string;
  email_verified?: string | null; // Assuming datetime is converted to string
  image?: string;
  hash?: string;
}

export interface IVerificationTokenParams {
  identifier: string;
  token: string;
}

export interface IVerificationToken {
  identifier: string;
  token: string;
  expires: string;
}

export interface IGenreTuneType {
  id: number;
  genre_id: number;
  tune_type_id: number;
}

export interface ITuneType {
  id: string;
  name: string;
  rhythm: string;
  description: string;
}
