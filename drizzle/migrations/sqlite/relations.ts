import { relations } from "drizzle-orm/relations";
import { tuneType, genreTuneType, genre, userProfile, instrument, repertoire, note, tune, repertoireTune, practiceRecord, prefsSchedulingOptions, prefsSpacedRepetition, reference, tabGroupMainState, tableState, tableTransientData, tag, tuneOverride } from "./schema";

export const genreTuneTypeRelations = relations(genreTuneType, ({one}) => ({
	tuneType: one(tuneType, {
		fields: [genreTuneType.tuneTypeId],
		references: [tuneType.id]
	}),
	genre: one(genre, {
		fields: [genreTuneType.genreId],
		references: [genre.id]
	}),
}));

export const tuneTypeRelations = relations(tuneType, ({many}) => ({
	genreTuneTypes: many(genreTuneType),
}));

export const genreRelations = relations(genre, ({many}) => ({
	genreTuneTypes: many(genreTuneType),
	repertoires: many(repertoire),
	tunes: many(tune),
	tuneOverrides: many(tuneOverride),
}));

export const instrumentRelations = relations(instrument, ({one}) => ({
	userProfile: one(userProfile, {
		fields: [instrument.privateToUser],
		references: [userProfile.id]
	}),
}));

export const userProfileRelations = relations(userProfile, ({many}) => ({
	instruments: many(instrument),
	notes: many(note),
	repertoires: many(repertoire),
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

export const noteRelations = relations(note, ({one}) => ({
	repertoire: one(repertoire, {
		fields: [note.repertoireRef],
		references: [repertoire.repertoireId]
	}),
	tune: one(tune, {
		fields: [note.tuneRef],
		references: [tune.id]
	}),
	userProfile: one(userProfile, {
		fields: [note.userRef],
		references: [userProfile.id]
	}),
}));

export const repertoireRelations = relations(repertoire, ({one, many}) => ({
	notes: many(note),
	genre: one(genre, {
		fields: [repertoire.genreDefault],
		references: [genre.id]
	}),
	userProfile: one(userProfile, {
		fields: [repertoire.userRef],
		references: [userProfile.id]
	}),
	repertoireTunes: many(repertoireTune),
	practiceRecords: many(practiceRecord),
	tableStates: many(tableState),
	tableTransientData: many(tableTransientData),
}));

export const tuneRelations = relations(tune, ({one, many}) => ({
	notes: many(note),
	repertoireTunes: many(repertoireTune),
	practiceRecords: many(practiceRecord),
	references: many(reference),
	tableTransientData: many(tableTransientData),
	tags: many(tag),
	userProfile: one(userProfile, {
		fields: [tune.privateFor],
		references: [userProfile.id]
	}),
	genre: one(genre, {
		fields: [tune.genre],
		references: [genre.id]
	}),
	tuneOverrides: many(tuneOverride),
}));

export const repertoireTuneRelations = relations(repertoireTune, ({one}) => ({
	tune: one(tune, {
		fields: [repertoireTune.tuneRef],
		references: [tune.id]
	}),
	repertoire: one(repertoire, {
		fields: [repertoireTune.repertoireRef],
		references: [repertoire.repertoireId]
	}),
}));

export const practiceRecordRelations = relations(practiceRecord, ({one}) => ({
	tune: one(tune, {
		fields: [practiceRecord.tuneRef],
		references: [tune.id]
	}),
	repertoire: one(repertoire, {
		fields: [practiceRecord.repertoireRef],
		references: [repertoire.repertoireId]
	}),
}));

export const prefsSchedulingOptionsRelations = relations(prefsSchedulingOptions, ({one}) => ({
	userProfile: one(userProfile, {
		fields: [prefsSchedulingOptions.userId],
		references: [userProfile.id]
	}),
}));

export const prefsSpacedRepetitionRelations = relations(prefsSpacedRepetition, ({one}) => ({
	userProfile: one(userProfile, {
		fields: [prefsSpacedRepetition.userId],
		references: [userProfile.id]
	}),
}));

export const referenceRelations = relations(reference, ({one}) => ({
	userProfile: one(userProfile, {
		fields: [reference.userRef],
		references: [userProfile.id]
	}),
	tune: one(tune, {
		fields: [reference.tuneRef],
		references: [tune.id]
	}),
}));

export const tabGroupMainStateRelations = relations(tabGroupMainState, ({one}) => ({
	userProfile: one(userProfile, {
		fields: [tabGroupMainState.userId],
		references: [userProfile.id]
	}),
}));

export const tableStateRelations = relations(tableState, ({one}) => ({
	repertoire: one(repertoire, {
		fields: [tableState.repertoireId],
		references: [repertoire.repertoireId]
	}),
	userProfile: one(userProfile, {
		fields: [tableState.userId],
		references: [userProfile.id]
	}),
}));

export const tableTransientDataRelations = relations(tableTransientData, ({one}) => ({
	repertoire: one(repertoire, {
		fields: [tableTransientData.repertoireId],
		references: [repertoire.repertoireId]
	}),
	tune: one(tune, {
		fields: [tableTransientData.tuneId],
		references: [tune.id]
	}),
	userProfile: one(userProfile, {
		fields: [tableTransientData.userId],
		references: [userProfile.id]
	}),
}));

export const tagRelations = relations(tag, ({one}) => ({
	tune: one(tune, {
		fields: [tag.tuneRef],
		references: [tune.id]
	}),
	userProfile: one(userProfile, {
		fields: [tag.userRef],
		references: [userProfile.id]
	}),
}));

export const tuneOverrideRelations = relations(tuneOverride, ({one}) => ({
	genre: one(genre, {
		fields: [tuneOverride.genre],
		references: [genre.id]
	}),
	userProfile: one(userProfile, {
		fields: [tuneOverride.userRef],
		references: [userProfile.id]
	}),
	tune: one(tune, {
		fields: [tuneOverride.tuneRef],
		references: [tune.id]
	}),
}));