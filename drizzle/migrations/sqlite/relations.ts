import { relations } from "drizzle-orm/relations";
import {
  genre,
  genreTuneType,
  instrument,
  note,
  playlist,
  playlistTune,
  practiceRecord,
  prefsSchedulingOptions,
  prefsSpacedRepetition,
  reference,
  tabGroupMainState,
  tableState,
  tableTransientData,
  tag,
  tune,
  tuneOverride,
  tuneType,
  userProfile,
} from "./schema";

export const genreTuneTypeRelations = relations(genreTuneType, ({ one }) => ({
  tuneType: one(tuneType, {
    fields: [genreTuneType.tuneTypeId],
    references: [tuneType.id],
  }),
  genre: one(genre, {
    fields: [genreTuneType.genreId],
    references: [genre.id],
  }),
}));

export const tuneTypeRelations = relations(tuneType, ({ many }) => ({
  genreTuneTypes: many(genreTuneType),
}));

export const genreRelations = relations(genre, ({ many }) => ({
  genreTuneTypes: many(genreTuneType),
  playlists: many(playlist),
  tunes: many(tune),
  tuneOverrides: many(tuneOverride),
}));

export const instrumentRelations = relations(instrument, ({ one }) => ({
  userProfile: one(userProfile, {
    fields: [instrument.privateToUser],
    references: [userProfile.id],
  }),
}));

export const userProfileRelations = relations(userProfile, ({ many }) => ({
  instruments: many(instrument),
  notes: many(note),
  playlists: many(playlist),
  prefsSchedulingOptions: many(prefsSchedulingOptions),
  prefsSpacedRepetitions: many(prefsSpacedRepetition),
  references: many(reference),
  tabGroupMainStates: many(tabGroupMainState),
  tableStates: many(tableState),
  tableTransientData: many(tableTransientData),
  tags: many(tag),
  tunes: many(tune),
  tuneOverrides: many(tuneOverride),
}));

export const noteRelations = relations(note, ({ one }) => ({
  playlist: one(playlist, {
    fields: [note.playlistRef],
    references: [playlist.playlistId],
  }),
  tune: one(tune, {
    fields: [note.tuneRef],
    references: [tune.id],
  }),
  userProfile: one(userProfile, {
    fields: [note.userRef],
    references: [userProfile.id],
  }),
}));

export const playlistRelations = relations(playlist, ({ one, many }) => ({
  notes: many(note),
  genre: one(genre, {
    fields: [playlist.genreDefault],
    references: [genre.id],
  }),
  userProfile: one(userProfile, {
    fields: [playlist.userRef],
    references: [userProfile.id],
  }),
  playlistTunes: many(playlistTune),
  practiceRecords: many(practiceRecord),
  tableStates: many(tableState),
  tableTransientData: many(tableTransientData),
}));

export const tuneRelations = relations(tune, ({ one, many }) => ({
  notes: many(note),
  playlistTunes: many(playlistTune),
  practiceRecords: many(practiceRecord),
  references: many(reference),
  tableTransientData: many(tableTransientData),
  tags: many(tag),
  userProfile: one(userProfile, {
    fields: [tune.privateFor],
    references: [userProfile.id],
  }),
  genre: one(genre, {
    fields: [tune.genre],
    references: [genre.id],
  }),
  tuneOverrides: many(tuneOverride),
}));

export const playlistTuneRelations = relations(playlistTune, ({ one }) => ({
  tune: one(tune, {
    fields: [playlistTune.tuneRef],
    references: [tune.id],
  }),
  playlist: one(playlist, {
    fields: [playlistTune.playlistRef],
    references: [playlist.playlistId],
  }),
}));

export const practiceRecordRelations = relations(practiceRecord, ({ one }) => ({
  tune: one(tune, {
    fields: [practiceRecord.tuneRef],
    references: [tune.id],
  }),
  playlist: one(playlist, {
    fields: [practiceRecord.playlistRef],
    references: [playlist.playlistId],
  }),
}));

export const prefsSchedulingOptionsRelations = relations(
  prefsSchedulingOptions,
  ({ one }) => ({
    userProfile: one(userProfile, {
      fields: [prefsSchedulingOptions.userId],
      references: [userProfile.id],
    }),
  }),
);

export const prefsSpacedRepetitionRelations = relations(
  prefsSpacedRepetition,
  ({ one }) => ({
    userProfile: one(userProfile, {
      fields: [prefsSpacedRepetition.userId],
      references: [userProfile.id],
    }),
  }),
);

export const referenceRelations = relations(reference, ({ one }) => ({
  userProfile: one(userProfile, {
    fields: [reference.userRef],
    references: [userProfile.id],
  }),
  tune: one(tune, {
    fields: [reference.tuneRef],
    references: [tune.id],
  }),
}));

export const tabGroupMainStateRelations = relations(
  tabGroupMainState,
  ({ one }) => ({
    userProfile: one(userProfile, {
      fields: [tabGroupMainState.userId],
      references: [userProfile.id],
    }),
  }),
);

export const tableStateRelations = relations(tableState, ({ one }) => ({
  playlist: one(playlist, {
    fields: [tableState.playlistId],
    references: [playlist.playlistId],
  }),
  userProfile: one(userProfile, {
    fields: [tableState.userId],
    references: [userProfile.id],
  }),
}));

export const tableTransientDataRelations = relations(
  tableTransientData,
  ({ one }) => ({
    playlist: one(playlist, {
      fields: [tableTransientData.playlistId],
      references: [playlist.playlistId],
    }),
    tune: one(tune, {
      fields: [tableTransientData.tuneId],
      references: [tune.id],
    }),
    userProfile: one(userProfile, {
      fields: [tableTransientData.userId],
      references: [userProfile.id],
    }),
  }),
);

export const tagRelations = relations(tag, ({ one }) => ({
  tune: one(tune, {
    fields: [tag.tuneRef],
    references: [tune.id],
  }),
  userProfile: one(userProfile, {
    fields: [tag.userRef],
    references: [userProfile.id],
  }),
}));

export const tuneOverrideRelations = relations(tuneOverride, ({ one }) => ({
  genre: one(genre, {
    fields: [tuneOverride.genre],
    references: [genre.id],
  }),
  userProfile: one(userProfile, {
    fields: [tuneOverride.userRef],
    references: [userProfile.id],
  }),
  tune: one(tune, {
    fields: [tuneOverride.tuneRef],
    references: [tune.id],
  }),
}));
