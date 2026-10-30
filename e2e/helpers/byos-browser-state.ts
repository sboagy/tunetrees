import type { Page } from "@playwright/test";

// These helpers run only on the Vite-backed E2E surface. Import the real browser
// modules rather than adding test-only production APIs or reimplementing stores.
export async function readByosDatabase(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/lib/db/client-sqlite.ts";
    const client = (await import(
      path
    )) as typeof import("../../src/lib/db/client-sqlite");
    const raw = await client.getSqliteInstance();
    if (!raw) throw new Error("Local SQLite is not ready");
    return {
      outbox: raw.exec(
        "SELECT * FROM sync_push_queue WHERE table_name IN ('reference', 'media_asset')"
      ),
      references: raw.exec(
        "SELECT * FROM reference WHERE title IN ('dropbox-private', 'Legacy R2 regression')"
      ),
      assets: raw.exec("SELECT * FROM media_asset"),
    };
  });
}

export async function replayFromTab(page: Page, userId: string) {
  await page.evaluate(async (id) => {
    const clientPath = "/src/lib/db/client-sqlite.ts";
    const queuePath = "/src/lib/byos/upload-queue.ts";
    const client = (await import(
      clientPath
    )) as typeof import("../../src/lib/db/client-sqlite");
    const queue = (await import(
      queuePath
    )) as typeof import("../../src/lib/byos/upload-queue");
    await queue.replayAudioDrafts(
      client.getDb(),
      { userId: id, getAppAccessToken: () => null },
      () => true
    );
  }, userId);
}

export async function cancelFromTab(page: Page, userId: string) {
  return page.evaluate(async (id) => {
    const storePath = "/src/lib/byos/draft-store.ts";
    const queuePath = "/src/lib/byos/upload-queue.ts";
    const store = (await import(
      storePath
    )) as typeof import("../../src/lib/byos/draft-store");
    const queue = (await import(
      queuePath
    )) as typeof import("../../src/lib/byos/upload-queue");
    const drafts = await store.listAudioDrafts(id);
    const draft = drafts.find((item) => item.id !== "oauth");
    if (!draft) throw new Error("Expected an in-flight draft");
    await queue.cancelAudioUpload(id, draft.id);
    return draft.id;
  }, userId);
}

export async function addLegacyAudio(page: Page, userId: string) {
  return page.evaluate(async (id) => {
    const clientPath = "/src/lib/db/client-sqlite.ts";
    const referencesPath = "/src/lib/db/queries/references.ts";
    const assetsPath = "/src/lib/db/queries/media-assets.ts";
    const client = (await import(
      clientPath
    )) as typeof import("../../src/lib/db/client-sqlite");
    const references = (await import(
      referencesPath
    )) as typeof import("../../src/lib/db/queries/references");
    const assets = (await import(
      assetsPath
    )) as typeof import("../../src/lib/db/queries/media-assets");
    const db = client.getDb();
    const uploaded = db
      .select()
      .from(client.schema.reference)
      .all()
      .find((r) => r.title === "dropbox-private");
    if (!uploaded)
      throw new Error(
        "Expected the BYOS reference before seeding legacy audio"
      );
    const key = `users/${id}/audio/legacy-regression.wav`;
    const url = `http://localhost:8787/api/media/view?key=${encodeURIComponent(key)}`;
    const reference = await references.createReference(
      db,
      {
        tuneRef: uploaded.tuneRef,
        url,
        refType: "audio",
        title: "Legacy R2 regression",
      },
      id
    );
    await assets.createMediaAsset(db, {
      referenceRef: reference.id,
      userRef: id,
      storagePath: key,
      originalFilename: "legacy-regression.wav",
      contentType: "audio/wav",
      fileSizeBytes: 16044,
    });
    await client.persistDb();
    globalThis.dispatchEvent(new Event("byos-upload-complete"));
    return url;
  }, userId);
}
