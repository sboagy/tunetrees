/**
 * TheSession.org API Type Definitions
 * 
 * TypeScript interfaces for TheSession.org API responses.
 * The schemas are not officially published but inferred from API responses.
 * 
 * @module lib/import/the-session-schemas
 */

export interface ITheSessionMember {
  id: number;
  name: string;
  url: string;
}

export interface ITheSessionSetting {
  id: number;
  url: string;
  key: string;
  abc: string;
  member: ITheSessionMember;
  date: string;
}

export interface ITheSessionComment {
  id: number;
  url: string;
  subject: string;
  content: string;
  member: ITheSessionMember;
  date: string;
}

export interface ITheSessionTune {
  format: string;
  id: number;
  name: string;
  url: string;
  member: ITheSessionMember;
  date: string;
  type: string;
  tunebooks: number;
  recordings: number;
  collections: number;
  aliases: string[];
  settings: ITheSessionSetting[];
  comments: ITheSessionComment[];
}

export interface ITheSessionQueryResults {
  format: string;
  type: string;
  mode: string;
  q: string;
  pages: number;
  page: number;
  total: number;
  tunes: {
    id: number;
    name: string;
    alias?: string;
    url: string;
    member: ITheSessionMember;
    date: string;
    type: string;
  }[];
}

/**
 * Summary info for displaying tune search results
 */
export interface ITheSessionTuneSummary {
  name: string;
  url: string;
  type: string;
}
