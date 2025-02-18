// Description: TheSession.com API schemas from a top level.
// The schemas do not seem to be published that I could locate.

interface ITheSessionMember {
  id: number;
  name: string;
  url: string;
}

interface ITheSessionSetting {
  id: number;
  url: string;
  key: string;
  abc: string;
  member: ITheSessionMember;
  date: string;
}

interface ITheSessionComment {
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
