/**
 * Browser-only BYOS storage-provider contract.
 *
 * Tokens and provider account identity deliberately do not appear in synced
 * metadata records. Implementations keep refresh tokens in the local secret
 * store and access tokens only in memory.
 */

export const BYOS_PROVIDER_IDS = ["google-drive", "dropbox"] as const;

export type ByosProviderId = (typeof BYOS_PROVIDER_IDS)[number];

export type ByosConnectionStatus =
  | "unconfigured"
  | "unconnected"
  | "connecting"
  | "connected"
  | "expired";

export interface ByosAccessToken {
  accessToken: string;
  expiresAt: number;
}

export interface ByosUploadedFile {
  fileId: string;
  fileName: string;
  contentType: string;
  size: number;
}

export interface ByosStorageProvider {
  readonly id: ByosProviderId;
  readonly label: string;
  isConfigured(): boolean;
  beginAuthorization(redirectUri: string): Promise<void>;
  completeAuthorization(
    callbackUrl: URL,
    redirectUri: string
  ): Promise<ByosConnectionStatus>;
  getConnectionStatus(): Promise<ByosConnectionStatus>;
  disconnect(): Promise<void>;
  upload(file: File): Promise<ByosUploadedFile>;
  resolveBlob(fileId: string): Promise<Blob>;
  createPublicLink(fileId: string): Promise<string>;
}
