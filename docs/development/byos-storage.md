# BYOS storage setup and audio drafts

Open **User Settings → Storage provider**, or **Configure storage** in Add Reference. Choose Google Drive or Dropbox with the radio controls. The default folder name is `tunetrees_storage`; a custom name selects a different destination for future uploads. Connect the provider once per device. After authorization, setup verifies or creates the folder and saves its stable ID. Save storage settings also works with an existing device authorization.

Google uses `drive.file` access to app-accessible files, not full-Drive permissions. The folder is an organizational destination; the OAuth scope is per-file. Dropbox must be registered as an App Folder app; the configurable destination is a subfolder within that sandbox. See the provider documentation for [Google folders](https://developers.google.com/workspace/drive/api/guides/folder), [Google retry-safe file IDs](https://developers.google.com/workspace/drive/api/guides/create-file), and [Dropbox file access and folder-relative IDs](https://developers.dropbox.com/dbx-file-access-guide).

Existing connections created before folder setup require completing setup in Settings once. Existing root-uploaded audio and R2 audio remain playable. A folder renamed in the provider retains its stable ID. Missing/inaccessible destinations cause a recoverable error; uploads never silently fall back to root. Reconnect the original account or configure a new destination. Changing the destination does not migrate existing files or already queued uploads.

## Draft behavior

- With no completed setup, new audio-file Save is disabled. URL references and edits of existing references are unaffected.
- Once setup exists, Save stores the audio draft locally before attempting upload. Offline/reconnect failures retain it with Retry/Cancel controls. The app retries when online, after setup changes, and periodically while open.
- Drafts are pinned to the original provider/folder. Tokens and draft binaries are excluded from SQLite, outbox, Supabase, and packet export.
- Settings is an overlay and does not navigate the app. OAuth can navigate away: the browser saves the unsaved reference fields, file, owning user/tune and local return context first. A failed local save prevents redirect. Success or cancelled consent restores the panel. An unsaved snapshot is never auto-uploaded.
- Provider upload retries use a pre-generated Google file ID or a unique, stable Dropbox filename prefix. Local reference/asset IDs are stable and inserted together in one SQLite transaction. Cancellation stops pending work; a file already accepted by a provider may remain there and can be removed through the provider UI.
- Clearing browser site data removes local tokens and pending drafts. Export/import does not include them.

## Manual acceptance

1. Run the app and Worker using the normal local scripts. Google credentials are injected from 1Password; the secret remains Worker-only. Register `<app-origin>/byos/callback?provider=google-drive` exactly in Google. Dropbox uses `provider=dropbox` and still needs its environment client IDs configured.
2. Start Add Reference and choose an MP3/WAV/M4A under 50 MB. With no completed setup, verify the warning and disabled Save; URL mode must remain usable.
3. Type a title/comment and choose a file. Open Configure storage: confirm the Storage provider tab opens as a dialog without changing the route or underlying reference. Close/reopen it and verify the draft is unchanged.
4. Connect Google with the default or a custom folder name. Complete consent; confirm the same tune, file, title, and comment return. Repeat with cancelled consent. Close the settings dialog and save the audio.
5. Confirm the file is inside the chosen provider folder and no binary request went through the Worker. Play it and verify waveform/region persistence. Rename the folder in the provider; another upload should still use that folder ID. Configure another destination and verify old files still play.
6. With completed setup, go offline and Save a new audio file. Verify queued status, reconnect, and verify one reference appears. Retry a provider failure and verify no duplicate file/reference. Cancel a queued draft. Reload while upload is pending and check replay.
7. On a second device, configuration syncs but authorization must be granted separately. Cached playback remains available offline; uncached unavailable files must not cause repeated consent prompts.
8. Repeat provider checks with Dropbox after configuring its App Folder app, client IDs, and callback URI. Verify existing R2 audio as a regression check.

## Schema rollout and rollback

`20261001120000_add_byos_storage_config.sql` adds one nullable text column. Browser migration 0027 and regenerated artifacts include it. Old clients/Workers can omit it; existing schema fields, RLS, routes, and assets remain unchanged. The user-profile RPC returns the table row type, so its result gains the new field without a signature change; generic adapters handle casing. Deploy migration, Worker, then Pages using the standard schema-promotion runbook. Old PWA bundles continue using their existing locators. To roll back, restore the prior app/Worker while retaining the nullable column, browser drafts, and provider files; do not delete storage as part of rollback.
