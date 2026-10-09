/**
 * Media asset queries for uploaded reference audio.
 *
 * @module lib/db/queries/media-assets
 */

import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { ByosProviderId } from "@/lib/byos/types";
import { generateId } from "@/lib/utils/uuid";
import type { SqliteDatabase } from "../client-sqlite";
import * as schema from "../schema";
import type { MediaAsset } from "../types";

export type { MediaAsset };

export interface CreateMediaAssetData {
  id?: string;
  referenceRef: string;
  userRef: string;
  storagePath: string;
  originalFilename: string;
  contentType: string;
  fileSizeBytes: number;
  durationSeconds?: number;
  regionsJson?: string;
  storageKind?: "r2" | "byos";
  byosProvider?: ByosProviderId;
  providerFileId?: string;
  publicUrl?: string;
  locatorVersion?: number;
}

export interface UpdateMediaAssetData {
  durationSeconds?: number | null;
  regionsJson?: string | null;
  deleted?: boolean;
  publicUrl?: string | null;
}

export function buildByosStoragePath(
  providerId: ByosProviderId,
  providerFileId: string
) {
  return `byos:${providerId}:${providerFileId}`;
}

function validateCreateMediaAsset(data: CreateMediaAssetData) {
  const storageKind = data.storageKind ?? "r2";
  if (
    storageKind === "byos" &&
    (!data.byosProvider ||
      !data.providerFileId ||
      !data.storagePath.startsWith("byos:"))
  ) {
    throw new Error(
      "BYOS media requires a provider, provider file ID, and synthetic locator."
    );
  }
  if (storageKind === "r2" && (data.byosProvider || data.providerFileId)) {
    throw new Error("Legacy R2 media cannot include a BYOS provider locator.");
  }
}

export async function getMediaAssetsByTune(
  db: SqliteDatabase,
  tuneId: string,
  userId: string
): Promise<MediaAsset[]> {
  const rows = db
    .select({ mediaAsset: schema.mediaAsset })
    .from(schema.mediaAsset)
    .innerJoin(
      schema.reference,
      eq(schema.mediaAsset.referenceRef, schema.reference.id)
    )
    .where(
      and(
        eq(schema.reference.tuneRef, tuneId),
        eq(schema.reference.userRef, userId),
        eq(schema.reference.deleted, 0),
        eq(schema.mediaAsset.userRef, userId),
        eq(schema.mediaAsset.deleted, 0)
      )
    )
    .orderBy(
      asc(schema.reference.displayOrder),
      desc(schema.mediaAsset.lastModifiedAt)
    )
    .all();

  return rows.map((row) => row.mediaAsset);
}

export async function getMediaAssetByReferenceId(
  db: SqliteDatabase,
  referenceId: string,
  userId?: string
): Promise<MediaAsset | undefined> {
  const conditions = [
    eq(schema.mediaAsset.referenceRef, referenceId),
    eq(schema.mediaAsset.deleted, 0),
  ];

  if (userId) {
    conditions.push(eq(schema.mediaAsset.userRef, userId));
  }

  const rows = db
    .select()
    .from(schema.mediaAsset)
    .where(and(...conditions))
    .all();

  return rows[0];
}

export async function createMediaAsset(
  db: SqliteDatabase,
  data: CreateMediaAssetData
): Promise<MediaAsset> {
  validateCreateMediaAsset(data);
  const now = new Date().toISOString();

  const result = db
    .insert(schema.mediaAsset)
    .values({
      id: data.id || generateId(),
      referenceRef: data.referenceRef,
      userRef: data.userRef,
      storagePath: data.storagePath,
      originalFilename: data.originalFilename,
      contentType: data.contentType,
      fileSizeBytes: data.fileSizeBytes,
      durationSeconds: data.durationSeconds ?? null,
      regionsJson: data.regionsJson ?? null,
      storageKind: data.storageKind ?? "r2",
      byosProvider: data.byosProvider ?? null,
      providerFileId: data.providerFileId ?? null,
      publicUrl: data.publicUrl ?? null,
      locatorVersion: data.locatorVersion ?? 1,
      deleted: 0,
      syncVersion: 1,
      lastModifiedAt: now,
    })
    .returning()
    .get();

  const { persistDb } = await import("../client-sqlite");
  await persistDb();

  return result;
}

export async function updateMediaAssetByReferenceId(
  db: SqliteDatabase,
  referenceId: string,
  data: UpdateMediaAssetData
): Promise<MediaAsset | undefined> {
  const now = new Date().toISOString();
  const updateData: Record<string, unknown> = {
    syncVersion: sql.raw(`${schema.mediaAsset.syncVersion.name} + 1`),
    lastModifiedAt: now,
  };

  if (data.durationSeconds !== undefined) {
    updateData.durationSeconds = data.durationSeconds;
  }

  if (data.regionsJson !== undefined) {
    updateData.regionsJson = data.regionsJson;
  }

  if (data.deleted !== undefined) {
    updateData.deleted = data.deleted ? 1 : 0;
  }

  if (data.publicUrl !== undefined) {
    updateData.publicUrl = data.publicUrl;
  }

  const result = db
    .update(schema.mediaAsset)
    .set(updateData)
    .where(eq(schema.mediaAsset.referenceRef, referenceId))
    .returning()
    .get();

  const { persistDb } = await import("../client-sqlite");
  await persistDb();

  return result;
}
