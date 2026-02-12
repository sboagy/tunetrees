import type { SqliteDatabase } from "./client-sqlite";

export type ViewColumnDescription = {
  viewName: string;
  columnName: string;
  description: string;
};

const VIEW_COLUMN_DESCRIPTIONS: ViewColumnDescription[] = [
  {
    viewName: "practice_list_staged",
    columnName: "id",
    description: "Unique tune ID for this row.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "title",
    description: "Tune title (uses any user override).",
  },
  {
    viewName: "practice_list_staged",
    columnName: "type",
    description: "Tune type classification (reel, jig, hornpipe, etc.).",
  },
  {
    viewName: "practice_list_staged",
    columnName: "structure",
    description: "Tune structure shorthand (e.g. AABB).",
  },
  {
    viewName: "practice_list_staged",
    columnName: "mode",
    description: "Musical mode of the tune.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "incipit",
    description: "Opening notes or incipit text for the tune.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "genre",
    description: "Genre classification for the tune.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "private_for",
    description: "User profile ID if this tune is private.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "deleted",
    description: "Whether the tune has been soft-deleted.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "learned",
    description: "Timestamp when the tune was marked learned.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "goal",
    description: "Practice goal for this tune in the repertoire.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "scheduled",
    description: "Manual schedule override for the next review.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "user_ref",
    description: "User profile ID that owns the repertoire.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "repertoire_id",
    description: "Repertoire ID for this tune row.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "instrument",
    description: "Instrument name for the repertoire.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "playlist_deleted",
    description: "Whether the repertoire entry has been soft-deleted.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "latest_state",
    description: "Latest scheduler state (new/learning/review/relearning).",
  },
  {
    viewName: "practice_list_staged",
    columnName: "latest_practiced",
    description: "Most recent practice timestamp.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "latest_quality",
    description: "Most recent quality rating.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "latest_easiness",
    description: "Most recent easiness value.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "latest_difficulty",
    description: "Most recent difficulty value.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "latest_stability",
    description: "Most recent stability value.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "latest_interval",
    description: "Most recent interval (days).",
  },
  {
    viewName: "practice_list_staged",
    columnName: "latest_step",
    description: "Most recent learning step.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "latest_repetitions",
    description: "Most recent repetitions count.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "latest_due",
    description: "Next due date after latest review.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "latest_backup_practiced",
    description: "Backup practiced timestamp (pre-migration).",
  },
  {
    viewName: "practice_list_staged",
    columnName: "latest_goal",
    description: "Most recent goal stored with practice record.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "latest_technique",
    description: "Most recent scheduling technique.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "tags",
    description: "Tags applied to the tune.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "purpose",
    description: "Practice purpose for staged entries.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "note_private",
    description: "Private practice note for this tune.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "note_public",
    description: "Public practice note for this tune.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "recall_eval",
    description: "Latest recall evaluation selection.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "notes",
    description: "Notes associated with the tune.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "favorite_url",
    description: "Favorite reference URL for the tune.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "has_override",
    description: "Whether the tune has user-specific overrides.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "has_staged",
    description: "Whether staged changes are present for this tune.",
  },
  {
    viewName: "practice_list_staged",
    columnName: "composer",
    description: "Composer name (classical/choral).",
  },
  {
    viewName: "practice_list_staged",
    columnName: "artist",
    description: "Artist name (pop/rock/jazz).",
  },
  {
    viewName: "practice_list_staged",
    columnName: "id_foreign",
    description: "External tune identifier (e.g. irishtune.info, Spotify).",
  },
  {
    viewName: "practice_list_staged",
    columnName: "release_year",
    description: "Release year for the recording or tune.",
  },
];

export async function initializeViewColumnMeta(
  db: SqliteDatabase
): Promise<void> {
  try {
    await db.run("DELETE FROM view_column_meta");
  } catch (error) {
    console.warn("⚠️ Failed to reset view_column_meta table:", error);
    return;
  }

  for (const meta of VIEW_COLUMN_DESCRIPTIONS) {
    try {
      const sanitizedDescription = meta.description.replaceAll("'", "''");
      const sanitizedViewName = meta.viewName.replaceAll("'", "''");
      const sanitizedColumnName = meta.columnName.replaceAll("'", "''");
      await db.run(
        `INSERT OR REPLACE INTO view_column_meta (view_name, column_name, description)
         VALUES ('${sanitizedViewName}', '${sanitizedColumnName}', '${sanitizedDescription}')`
      );
    } catch (error) {
      console.warn(
        "⚠️ Failed to insert view_column_meta row:",
        meta.viewName,
        meta.columnName,
        error
      );
    }
  }
}
