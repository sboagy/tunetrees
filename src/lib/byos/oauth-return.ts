import { safeReturnPath } from "./draft-store";
import { validateFolderName } from "./storage-config";
import type { ByosProviderId } from "./types";

export interface OAuthReturn {
  userId: string;
  providerId: ByosProviderId;
  folderName: string;
  existingId?: string;
  returnPath: string;
  createdAt: number;
}

export function readOAuthReturn(
  raw: string | null,
  userId: string,
  providerId: string | null
): OAuthReturn | null {
  try {
    const value: unknown = JSON.parse(raw || "null");
    if (!value || typeof value !== "object") return null;
    const c = value as Record<string, unknown>;
    if (
      c.userId !== userId ||
      c.providerId !== providerId ||
      (providerId !== "google-drive" && providerId !== "dropbox") ||
      typeof c.folderName !== "string" ||
      typeof c.returnPath !== "string" ||
      typeof c.createdAt !== "number" ||
      c.createdAt > Date.now() ||
      Date.now() - c.createdAt > 30 * 60_000 ||
      (c.existingId !== undefined && typeof c.existingId !== "string")
    )
      return null;
    return {
      userId,
      providerId,
      folderName: validateFolderName(c.folderName),
      existingId: c.existingId as string | undefined,
      returnPath: safeReturnPath(c.returnPath),
      createdAt: c.createdAt,
    };
  } catch {
    return null;
  }
}
