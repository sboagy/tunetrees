import Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { clearStaleStagedEvaluations } from "../../../src/lib/db/queries/practice";
import { applyMigrations } from "../../../src/lib/services/test-schema-loader";

let db: BetterSQLite3Database;
let sqlite: Database.Database;

beforeEach(() => {
	sqlite = new Database(":memory:");
	db = drizzle(sqlite) as BetterSQLite3Database;
	applyMigrations(db);
});

describe("clearStaleStagedEvaluations", () => {
	it("removes stale staged evaluations outside the active queue window", async () => {
		const now = "2025-10-16T00:00:00Z";
		const userRef = "user-1";
		const playlistId = "playlist-1";
		const tune1Id = "tune-1";
		const tune2Id = "tune-2";
		const tune3Id = "tune-3";

		sqlite
			.prepare(
				"INSERT INTO user_profile (supabase_user_id, id, name, last_modified_at) VALUES (?, ?, ?, ?)",
			)
			.run(userRef, "profile-1", "Test User", now);

		sqlite
			.prepare(
				"INSERT INTO playlist (playlist_id, user_ref, last_modified_at) VALUES (?, ?, ?)",
			)
			.run(playlistId, userRef, now);

		const tuneInsert = sqlite.prepare(
			"INSERT INTO tune (id, title, last_modified_at) VALUES (?, ?, ?)",
		);
		tuneInsert.run(tune1Id, "Tune 1", now);
		tuneInsert.run(tune2Id, "Tune 2", now);
		tuneInsert.run(tune3Id, "Tune 3", now);

		const playlistTuneInsert = sqlite.prepare(
			"INSERT INTO playlist_tune (playlist_ref, tune_ref, last_modified_at) VALUES (?, ?, ?)",
		);
		playlistTuneInsert.run(playlistId, tune1Id, now);
		playlistTuneInsert.run(playlistId, tune2Id, now);
		playlistTuneInsert.run(playlistId, tune3Id, now);

		const queueInsert = sqlite.prepare(`
      INSERT INTO daily_practice_queue (
        id,
        user_ref,
        playlist_ref,
        window_start_utc,
        window_end_utc,
        tune_ref,
        bucket,
        order_index,
        snapshot_coalesced_ts,
        generated_at,
        last_modified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
		queueInsert.run(
			"queue-1",
			userRef,
			playlistId,
			"2025-10-16 00:00:00",
			"2025-10-17 00:00:00",
			tune1Id,
			1,
			1,
			"2025-10-16 00:00:00",
			"2025-10-16 00:00:00",
			now,
		);
		queueInsert.run(
			"queue-2",
			userRef,
			playlistId,
			"2025-10-16 00:00:00",
			"2025-10-17 00:00:00",
			tune3Id,
			1,
			2,
			"2025-10-16 00:00:00",
			"2025-10-16 00:00:00",
			now,
		);

		const stagedInsert = sqlite.prepare(
			"INSERT INTO table_transient_data (user_id, tune_id, playlist_id, last_modified_at) VALUES (?, ?, ?, ?)",
		);
		stagedInsert.run(
			userRef,
			tune1Id,
			playlistId,
			"2025-10-16T02:00:00Z",
		);
		stagedInsert.run(
			userRef,
			tune2Id,
			playlistId,
			"2025-10-16T02:00:00Z",
		);
		stagedInsert.run(
			userRef,
			tune3Id,
			playlistId,
			"2025-10-15T23:00:00Z",
		);

		const removed = await clearStaleStagedEvaluations(
			db,
			userRef,
			playlistId,
			"2025-10-16T00:00:00",
		);

		expect(removed).toBe(2);

		const remaining = sqlite
			.prepare("SELECT tune_id FROM table_transient_data ORDER BY tune_id")
			.all();
		expect(remaining).toHaveLength(1);
		expect(remaining[0]?.tune_id).toBe(tune1Id);
	});
});
