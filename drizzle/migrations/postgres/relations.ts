import { relations } from "drizzle-orm/relations";
import { repertoire, tabGroupMainState, userProfile, tune, tag, practiceRecord, genre, tuneOverride, instrument, dailyPracticeQueue, note, prefsSchedulingOptions, reference, genreTuneType, tuneType, tableState, repertoireTune, prefsSpacedRepetition, tableTransientData } from "./schema";

export const tabGroupMainStateRelations = relations(tabGroupMainState, ({one}) => ({
	repertoire: one(repertoire, {
		fields: [tabGroupMainState.repertoireId],
		references: [repertoire.repertoireId]
	}),
	userProfile: one(userProfile, {
		fields: [tabGroupMainState.userId],
		references: [userProfile.id]
	}),
}));

export const repertoireRelations = relations(repertoire, ({one, many}) => ({
	tabGroupMainStates: many(tabGroupMainState),
	practiceRecords: many(practiceRecord),
	dailyPracticeQueues: many(dailyPracticeQueue),
	notes: many(note),
	instrument: one(instrument, {
		fields: [repertoire.instrumentRef],
		references: [instrument.id]
	}),
	userProfile: one(userProfile, {
		fields: [repertoire.userRef],
		references: [userProfile.id]
	}),
	tableStates: many(tableState),
	repertoireTunes: many(repertoireTune),
	tableTransientData: many(tableTransientData),
}));

export const userProfileRelations = relations(userProfile, ({many}) => ({
	tabGroupMainStates: many(tabGroupMainState),
	tags: many(tag),
	tunes: many(tune),
	tuneOverrides: many(tuneOverride),
	instruments: many(instrument),
	dailyPracticeQueues: many(dailyPracticeQueue),
	notes: many(note),
	repertoires: many(repertoire),
	prefsSchedulingOptions: many(prefsSchedulingOptions),
	references: many(reference),
	tableStates: many(tableState),
	prefsSpacedRepetitions: many(prefsSpacedRepetition),
	tableTransientData: many(tableTransientData),
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

export const tuneRelations = relations(tune, ({one, many}) => ({
	tags: many(tag),
	practiceRecords: many(practiceRecord),
	genre: one(genre, {
		fields: [tune.genre],
		references: [genre.id]
	}),
	userProfile: one(userProfile, {
		fields: [tune.privateFor],
		references: [userProfile.id]
	}),
	tuneOverrides: many(tuneOverride),
	dailyPracticeQueues: many(dailyPracticeQueue),
	notes: many(note),
	references: many(reference),
	repertoireTunes: many(repertoireTune),
	tableTransientData: many(tableTransientData),
}));

export const practiceRecordRelations = relations(practiceRecord, ({one}) => ({
	repertoire: one(repertoire, {
		fields: [practiceRecord.repertoireRef],
		references: [repertoire.repertoireId]
	}),
	tune: one(tune, {
		fields: [practiceRecord.tuneRef],
		references: [tune.id]
	}),
}));

export const genreRelations = relations(genre, ({many}) => ({
	tunes: many(tune),
	tuneOverrides: many(tuneOverride),
	instruments: many(instrument),
	genreTuneTypes: many(genreTuneType),
}));

export const tuneOverrideRelations = relations(tuneOverride, ({one}) => ({
	genre: one(genre, {
		fields: [tuneOverride.genre],
		references: [genre.id]
	}),
	tune: one(tune, {
		fields: [tuneOverride.tuneRef],
		references: [tune.id]
	}),
	userProfile: one(userProfile, {
		fields: [tuneOverride.userRef],
		references: [userProfile.id]
	}),
}));

export const instrumentRelations = relations(instrument, ({one, many}) => ({
	genre: one(genre, {
		fields: [instrument.genreDefault],
		references: [genre.id]
	}),
	userProfile: one(userProfile, {
		fields: [instrument.privateToUser],
		references: [userProfile.id]
	}),
	repertoires: many(repertoire),
}));

export const dailyPracticeQueueRelations = relations(dailyPracticeQueue, ({one}) => ({
	repertoire: one(repertoire, {
		fields: [dailyPracticeQueue.repertoireRef],
		references: [repertoire.repertoireId]
	}),
	tune: one(tune, {
		fields: [dailyPracticeQueue.tuneRef],
		references: [tune.id]
	}),
	userProfile: one(userProfile, {
		fields: [dailyPracticeQueue.userRef],
		references: [userProfile.id]
	}),
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

export const prefsSchedulingOptionsRelations = relations(prefsSchedulingOptions, ({one}) => ({
	userProfile: one(userProfile, {
		fields: [prefsSchedulingOptions.userId],
		references: [userProfile.id]
	}),
}));

export const referenceRelations = relations(reference, ({one}) => ({
	tune: one(tune, {
		fields: [reference.tuneRef],
		references: [tune.id]
	}),
	userProfile: one(userProfile, {
		fields: [reference.userRef],
		references: [userProfile.id]
	}),
}));

export const genreTuneTypeRelations = relations(genreTuneType, ({one}) => ({
	genre: one(genre, {
		fields: [genreTuneType.genreId],
		references: [genre.id]
	}),
	tuneType: one(tuneType, {
		fields: [genreTuneType.tuneTypeId],
		references: [tuneType.id]
	}),
}));

export const tuneTypeRelations = relations(tuneType, ({many}) => ({
	genreTuneTypes: many(genreTuneType),
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

export const repertoireTuneRelations = relations(repertoireTune, ({one}) => ({
	repertoire: one(repertoire, {
		fields: [repertoireTune.repertoireRef],
		references: [repertoire.repertoireId]
	}),
	tune: one(tune, {
		fields: [repertoireTune.tuneRef],
		references: [tune.id]
	}),
}));

export const prefsSpacedRepetitionRelations = relations(prefsSpacedRepetition, ({one}) => ({
	userProfile: one(userProfile, {
		fields: [prefsSpacedRepetition.userId],
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