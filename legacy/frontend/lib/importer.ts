// This was an attempt to port some old python code I had.  Keeping it around
// for reference, but it's not really useful in this form.

import { writeFileSync } from "node:fs";
import path from "node:path";

interface IIrishTuneInfoPlaylistRow {
  id: string;
  type: string;
  structure: string;
  title: string;
  mode: string;
  incipit: string;
  current: string;
  learned: string;
  practiced: string;
  note_private: string;
  note_public: string;
  tags: string;
}

interface IIrishTuneInfoPlaylistDict {
  status: string;
  data: IIrishTuneInfoPlaylistRow[];
}

function getHeaders(): Record<string, string> {
  return {
    "User-Agent": "Mozilla/5.0",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    Connection: "keep-alive",
    Cookie: "MyIrishTuneInfo=b2dcbda34d41f29b2967f917e89fd77b",
  };
}

async function loginIrishTuneInfo(
  dataDir: string,
  pageUrl: string,
  username: string,
  password: string,
): Promise<string> {
  const formData = new URLSearchParams({
    username,
    password,
    B1: "Submit",
    jtest: "t",
    IE8: "false",
    from: "/my/",
  });
  let webByte: Buffer | null = null;
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(pageUrl, {
        method: "POST",
        headers: getHeaders(),
        body: formData,
      });
      console.log(res.status);
      webByte = Buffer.from(await res.arrayBuffer());
      break;
    } catch (error) {
      if (error instanceof Error) {
        console.log(`Error: ${error.message}`);
      } else {
        console.log(`Unexpected error: ${String(error)}`);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  if (!webByte) throw new Error("Failed to fetch data");
  const page = webByte.toString("utf8");
  writeFileSync(path.join(dataDir, "output_login.html"), page);
  return page;
}

async function fetchIrishTuneInfoPlaylist(dataDir: string): Promise<string> {
  const params = new URLSearchParams({
    action: "listall",
    _: "1686614383963",
  });
  const pageUrl = `https://www.irishtune.info/my/ctrlPlaylist.php?${params}`;
  let webByte: Buffer | null = null;
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(pageUrl, { headers: getHeaders() });
      console.log(res.status);
      webByte = Buffer.from(await res.arrayBuffer());
      break;
    } catch (error) {
      console.log(`Error: ${(error as Error).message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  if (!webByte) throw new Error("Failed to fetch data");
  const page = webByte.toString("utf8");
  writeFileSync(path.join(dataDir, "output_playlist.json"), page);
  return page;
}

async function main() {
  const pageUrl = "https://www.irishtune.info/my/login2.php";
  const dataDir = path.join(__dirname, "..", "data");
  console.log(pageUrl);

  const page = await loginIrishTuneInfo(dataDir, pageUrl, "sboag", "dummy");
  if (!page) return;

  const playlistPage = await fetchIrishTuneInfoPlaylist(dataDir);
  const dumpObj: IIrishTuneInfoPlaylistDict = JSON.parse(playlistPage);
  const tunesDict = dumpObj.data;
  const tunesColumns = ["id", "type", "structure", "title", "mode", "incipit"];
  const tunesUserNotesColumns = ["id", "note_private", "note_public", "tags"];
  const practiceRecordColumns = ["playlist_ref", "id", "practiced", "feedback"];
  const playlistTunesColumns = ["playlist_ref", "id", "current", "learned"];
  const tables: Record<string, string[]> = {
    [path.join(dataDir, "dump_tunes.cvs")]: tunesColumns,
    [path.join(dataDir, "dump_tune_user_notes.cvs")]: tunesUserNotesColumns,
    [path.join(dataDir, "dump_practice_records.cvs")]: practiceRecordColumns,
    [path.join(dataDir, "dump_playlist_tunes.cvs")]: playlistTunesColumns,
  };
  for (const [path, cols] of Object.entries(tables)) {
    writeFileSync(path, `${cols.join(", ")}\n`);
  }
  const trans = (str: string) => str.replaceAll(/[,\r\n]/g, ";  ");
  for (const tune of tunesDict) {
    for (const [path, cols] of Object.entries(tables)) {
      const rowData = cols.map((c) =>
        trans((tune as unknown as Record<string, string>)[c] || ""),
      );
      writeFileSync(path, `${rowData.join(", ")}\n`, { flag: "a" });
    }
  }
}

if (require.main === module) {
  try {
    await main();
  } catch (error) {
    console.error(error);
  }
}
