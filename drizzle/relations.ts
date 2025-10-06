/**
 * TuneTrees Drizzle Relations
 *
 * Defines relationships between tables for type-safe relational queries.
 * This allows queries like:
 *   db.query.userProfile.findMany({ with: { playlists: true } })
 *   db.query.playlist.findFirst({ with: { tunes: { with: { tune: true } } } })
 */

import { relations } from "drizzle-orm";
import * as pgSchema from "./schema-postgres";

const {
  userProfile,
  playlist,
  tune,
  tuneOverride,
  instrument,
  playlistTune,
  practiceRecord,
  dailyPracticeQueue,
  note,
  reference,
  tag,
  prefsSpacedRepetition,
  prefsSchedulingOptions,
  tabGroupMainState,
  tableState,
  tableTransientData,
  genre,
} = pgSchema;

// ============================================================================
// User Profile Relations
// ============================================================================

export const userProfileRelations = relations(userProfile, ({ many }) => ({
  // One user has many playlists
  playlists: many(playlist),

  // One user has many custom instruments
  customInstruments: many(instrument),

  // One user has many tune overrides
  tuneOverrides: many(tuneOverride),

  // One user has many practice records (via playlists)
  practiceRecords: many(practiceRecord),

  // One user has many daily practice queue items
  dailyPracticeQueueItems: many(dailyPracticeQueue),

  // One user has many notes
  notes: many(note),

  // One user has many references
  references: many(reference),

  // One user has many tags
  tags: many(tag),

  // One user has many spaced repetition preferences (one per algorithm)
  spacedRepetitionPrefs: many(prefsSpacedRepetition),

  // One user has one scheduling preferences
  schedulingPrefs: many(prefsSchedulingOptions),

  // One user has many tab group states
  tabGroupStates: many(tabGroupMainState),

  // One user has many table states
  tableStates: many(tableState),

  // One user has many transient data entries
  transientData: many(tableTransientData),
}));

// ============================================================================
// Genre Relations
// ============================================================================

export const genreRelations = relations(genre, ({ many }) => ({
  // One genre has many tunes
  tunes: many(tune),
}));

// ============================================================================
// Instrument Relations
// ============================================================================

export const instrumentRelations = relations(instrument, ({ one, many }) => ({
  // One instrument may belong to one user (if custom)
  owner: one(userProfile, {
    fields: [instrument.privateToUser],
    references: [userProfile.id],
  }),

  // One instrument has many playlists
  playlists: many(playlist),
}));

// ============================================================================
// Tune Relations
// ============================================================================

export const tuneRelations = relations(tune, ({ one, many }) => ({
  // One tune may belong to one user (if private)
  privateOwner: one(userProfile, {
    fields: [tune.privateFor],
    references: [userProfile.id],
  }),

  // One tune may have one genre
  genreDetail: one(genre, {
    fields: [tune.genre],
    references: [genre.id],
  }),

  // One tune has many playlist associations
  playlists: many(playlistTune),

  // One tune has many overrides (one per user)
  overrides: many(tuneOverride),

  // One tune has many practice records
  practiceRecords: many(practiceRecord),

  // One tune has many notes
  notes: many(note),

  // One tune has many references
  references: many(reference),

  // One tune has many tags
  tags: many(tag),

  // One tune has many transient data entries
  transientData: many(tableTransientData),
}));

// ============================================================================
// Tune Override Relations
// ============================================================================

export const tuneOverrideRelations = relations(tuneOverride, ({ one }) => ({
  // One override belongs to one tune
  tune: one(tune, {
    fields: [tuneOverride.tuneRef],
    references: [tune.id],
  }),

  // One override belongs to one user
  user: one(userProfile, {
    fields: [tuneOverride.userRef],
    references: [userProfile.id],
  }),

  // One override may reference one genre
  genreDetail: one(genre, {
    fields: [tuneOverride.genre],
    references: [genre.id],
  }),
}));

// ============================================================================
// Playlist Relations
// ============================================================================

export const playlistRelations = relations(playlist, ({ one, many }) => ({
  // One playlist belongs to one user
  user: one(userProfile, {
    fields: [playlist.userRef],
    references: [userProfile.id],
  }),

  // One playlist may have one instrument
  instrument: one(instrument, {
    fields: [playlist.instrumentRef],
    references: [instrument.id],
  }),

  // One playlist has many tunes (via playlistTune)
  tunes: many(playlistTune),

  // One playlist has many practice records
  practiceRecords: many(practiceRecord),

  // One playlist has many daily practice queue items
  dailyPracticeQueueItems: many(dailyPracticeQueue),

  // One playlist has many notes
  notes: many(note),

  // One playlist has many table states
  tableStates: many(tableState),

  // One playlist has many transient data entries
  transientData: many(tableTransientData),
}));

// ============================================================================
// Playlist-Tune Association Relations
// ============================================================================

export const playlistTuneRelations = relations(playlistTune, ({ one }) => ({
  // One playlist-tune association belongs to one playlist
  playlist: one(playlist, {
    fields: [playlistTune.playlistRef],
    references: [playlist.playlistId],
  }),

  // One playlist-tune association belongs to one tune
  tune: one(tune, {
    fields: [playlistTune.tuneRef],
    references: [tune.id],
  }),
}));

// ============================================================================
// Practice Record Relations
// ============================================================================

export const practiceRecordRelations = relations(practiceRecord, ({ one }) => ({
  // One practice record belongs to one playlist
  playlist: one(playlist, {
    fields: [practiceRecord.playlistRef],
    references: [playlist.playlistId],
  }),

  // One practice record belongs to one tune
  tune: one(tune, {
    fields: [practiceRecord.tuneRef],
    references: [tune.id],
  }),

  // Note: userRef is derived through playlist.userRef
}));

// ============================================================================
// Daily Practice Queue Relations
// ============================================================================

export const dailyPracticeQueueRelations = relations(
  dailyPracticeQueue,
  ({ one }) => ({
    // One queue item belongs to one user
    user: one(userProfile, {
      fields: [dailyPracticeQueue.userRef],
      references: [userProfile.id],
    }),

    // One queue item belongs to one playlist
    playlist: one(playlist, {
      fields: [dailyPracticeQueue.playlistRef],
      references: [playlist.playlistId],
    }),

    // One queue item references one tune
    tune: one(tune, {
      fields: [dailyPracticeQueue.tuneRef],
      references: [tune.id],
    }),
  }),
);

// ============================================================================
// Note Relations
// ============================================================================

export const noteRelations = relations(note, ({ one }) => ({
  // One note may belong to one user
  user: one(userProfile, {
    fields: [note.userRef],
    references: [userProfile.id],
  }),

  // One note belongs to one tune
  tune: one(tune, {
    fields: [note.tuneRef],
    references: [tune.id],
  }),

  // One note may belong to one playlist
  playlist: one(playlist, {
    fields: [note.playlistRef],
    references: [playlist.playlistId],
  }),
}));

// ============================================================================
// Reference Relations
// ============================================================================

export const referenceRelations = relations(reference, ({ one }) => ({
  // One reference belongs to one tune
  tune: one(tune, {
    fields: [reference.tuneRef],
    references: [tune.id],
  }),

  // One reference may belong to one user
  user: one(userProfile, {
    fields: [reference.userRef],
    references: [userProfile.id],
  }),
}));

// ============================================================================
// Tag Relations
// ============================================================================

export const tagRelations = relations(tag, ({ one }) => ({
  // One tag belongs to one user
  user: one(userProfile, {
    fields: [tag.userRef],
    references: [userProfile.id],
  }),

  // One tag belongs to one tune
  tune: one(tune, {
    fields: [tag.tuneRef],
    references: [tune.id],
  }),
}));

// ============================================================================
// Preferences Relations
// ============================================================================

export const prefsSpacedRepetitionRelations = relations(
  prefsSpacedRepetition,
  ({ one }) => ({
    // One preference belongs to one user
    user: one(userProfile, {
      fields: [prefsSpacedRepetition.userId],
      references: [userProfile.id],
    }),
  }),
);

export const prefsSchedulingOptionsRelations = relations(
  prefsSchedulingOptions,
  ({ one }) => ({
    // One preference belongs to one user
    user: one(userProfile, {
      fields: [prefsSchedulingOptions.userId],
      references: [userProfile.id],
    }),
  }),
);

// ============================================================================
// UI State Relations
// ============================================================================

export const tabGroupMainStateRelations = relations(
  tabGroupMainState,
  ({ one }) => ({
    // One tab state belongs to one user
    user: one(userProfile, {
      fields: [tabGroupMainState.userId],
      references: [userProfile.id],
    }),

    // One tab state may reference one playlist
    playlist: one(playlist, {
      fields: [tabGroupMainState.playlistId],
      references: [playlist.playlistId],
    }),
  }),
);

export const tableStateRelations = relations(tableState, ({ one }) => ({
  // One table state belongs to one user
  user: one(userProfile, {
    fields: [tableState.userId],
    references: [userProfile.id],
  }),

  // One table state belongs to one playlist
  playlist: one(playlist, {
    fields: [tableState.playlistId],
    references: [playlist.playlistId],
  }),
}));

export const tableTransientDataRelations = relations(
  tableTransientData,
  ({ one }) => ({
    // One transient data entry belongs to one user
    user: one(userProfile, {
      fields: [tableTransientData.userId],
      references: [userProfile.id],
    }),

    // One transient data entry belongs to one tune
    tune: one(tune, {
      fields: [tableTransientData.tuneId],
      references: [tune.id],
    }),

    // One transient data entry belongs to one playlist
    playlist: one(playlist, {
      fields: [tableTransientData.playlistId],
      references: [playlist.playlistId],
    }),
  }),
);

/**
 * All relation definitions are exported individually.
 * Import them in your Drizzle client configuration.
 */
