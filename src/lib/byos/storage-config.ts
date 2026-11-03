import type { ByosProviderId } from "./types";

export const DEFAULT_STORAGE_FOLDER = "tunetrees_storage";
export function validateFolderName(value: string): string {
  const name = value.trim();
  if (
    !name ||
    name.length > 100 ||
    /[\\/]/.test(name) ||
    [...value].some((c) => c.charCodeAt(0) < 32) ||
    name === "." ||
    name === ".."
  )
    throw new Error("Use a folder name of 1–100 characters, without slashes.");
  return name;
}
export interface StorageConfig {
  version: 1;
  providerId: ByosProviderId;
  folderId: string;
  folderName: string;
}

export function parseStorageConfig(
  raw: string | null | undefined
): StorageConfig | null {
  try {
    const value: unknown = JSON.parse(raw || "null");
    if (!value || typeof value !== "object") return null;
    const c = value as Record<string, unknown>;
    if (
      c.version !== 1 ||
      (c.providerId !== "google-drive" && c.providerId !== "dropbox") ||
      typeof c.folderId !== "string" ||
      !c.folderId ||
      typeof c.folderName !== "string"
    )
      return null;
    return {
      version: 1,
      providerId: c.providerId,
      folderId: c.folderId,
      folderName: validateFolderName(c.folderName),
    };
  } catch {
    return null;
  }
}
