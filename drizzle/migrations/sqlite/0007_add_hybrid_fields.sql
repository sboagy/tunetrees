PRAGMA foreign_keys = OFF;

--> statement-breakpoint
CREATE TABLE
    `__new_tune` (
        `id` text PRIMARY KEY NOT NULL,
        `composer` text,
        `artist` text,
        `id_foreign` text,
        `release_year` integer,
        `primary_origin` text DEFAULT 'irishtune.info',
        `title` text,
        `type` text,
        `structure` text,
        `mode` text,
        `incipit` text,
        `genre` text,
        `private_for` text,
        `deleted` integer DEFAULT 0 NOT NULL,
        `sync_version` integer DEFAULT 1 NOT NULL,
        `last_modified_at` text NOT NULL,
        `device_id` text,
        FOREIGN KEY (`genre`) REFERENCES `genre` (`id`) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (`private_for`) REFERENCES `user_profile` (`supabase_user_id`) ON UPDATE no action ON DELETE no action
    );

--> statement-breakpoint
INSERT INTO
    `__new_tune` (
        "id",
        "composer",
        "artist",
        "id_foreign",
        "release_year",
        "primary_origin",
        "title",
        "type",
        "structure",
        "mode",
        "incipit",
        "genre",
        "private_for",
        "deleted",
        "sync_version",
        "last_modified_at",
        "device_id"
    )
SELECT
    "id",
    NULL AS "composer",
    NULL AS "artist",
    CAST("id_foreign" AS TEXT) AS "id_foreign",
    NULL AS "release_year",
    "primary_origin",
    "title",
    "type",
    "structure",
    "mode",
    "incipit",
    "genre",
    "private_for",
    "deleted",
    "sync_version",
    "last_modified_at",
    "device_id"
FROM
    `tune`;

--> statement-breakpoint
DROP TABLE `tune`;

--> statement-breakpoint
ALTER TABLE `__new_tune`
RENAME TO `tune`;

--> statement-breakpoint
CREATE TABLE
    `__new_tune_override` (
        `id` text PRIMARY KEY NOT NULL,
        `tune_ref` text NOT NULL,
        `user_ref` text NOT NULL,
        `title` text,
        `type` text,
        `structure` text,
        `genre` text,
        `mode` text,
        `incipit` text,
        `composer` text,
        `artist` text,
        `id_foreign` text,
        `release_year` integer,
        `deleted` integer DEFAULT 0 NOT NULL,
        `sync_version` integer DEFAULT 1 NOT NULL,
        `last_modified_at` text NOT NULL,
        `device_id` text,
        FOREIGN KEY (`tune_ref`) REFERENCES `tune` (`id`) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (`user_ref`) REFERENCES `user_profile` (`supabase_user_id`) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (`genre`) REFERENCES `genre` (`id`) ON UPDATE no action ON DELETE no action
    );

--> statement-breakpoint
INSERT INTO
    `__new_tune_override` (
        "id",
        "tune_ref",
        "user_ref",
        "title",
        "type",
        "structure",
        "genre",
        "mode",
        "incipit",
        "composer",
        "artist",
        "id_foreign",
        "release_year",
        "deleted",
        "sync_version",
        "last_modified_at",
        "device_id"
    )
SELECT
    "id",
    "tune_ref",
    "user_ref",
    "title",
    "type",
    "structure",
    "genre",
    "mode",
    "incipit",
    NULL AS "composer",
    NULL AS "artist",
    NULL AS "id_foreign",
    NULL AS "release_year",
    "deleted",
    "sync_version",
    "last_modified_at",
    "device_id"
FROM
    `tune_override`;

--> statement-breakpoint
DROP TABLE `tune_override`;

--> statement-breakpoint
ALTER TABLE `__new_tune_override`
RENAME TO `tune_override`;

--> statement-breakpoint
PRAGMA foreign_keys = ON;