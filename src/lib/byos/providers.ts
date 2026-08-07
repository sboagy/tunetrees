import {
  deleteLocalRefreshToken,
  getLocalRefreshToken,
  putLocalRefreshToken,
} from "./local-secret-store";
import { consumePkceTransaction, createPkceTransaction } from "./pkce";
import type {
  ByosAccessToken,
  ByosConnectionStatus,
  ByosProviderId,
  ByosStorageProvider,
  ByosUploadedFile,
} from "./types";

const WORKER_URL = import.meta.env.VITE_WORKER_URL || "http://localhost:8787";
const GOOGLE_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_API_URL = "https://www.googleapis.com";
const DROPBOX_AUTHORIZATION_URL = "https://www.dropbox.com/oauth2/authorize";
const DROPBOX_TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const DROPBOX_API_URL = "https://api.dropboxapi.com/2";
const DROPBOX_CONTENT_URL = "https://content.dropboxapi.com/2";

type TokenResponse = {
  accessToken: string;
  expiresIn?: number;
  refreshToken?: string;
};

export type ByosProviderOptions = {
  userId: string;
  getAppAccessToken: () => string | null | undefined;
};

function assertSuccess(response: Response, action: string) {
  if (!response.ok) {
    throw new Error(
      `${action} failed. Please try again or reconnect your provider.`
    );
  }
}

async function parseJson<T>(response: Response, action: string): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`${action} returned an invalid response.`);
  }
}

abstract class BrowserStorageProvider implements ByosStorageProvider {
  abstract readonly id: ByosProviderId;
  abstract readonly label: string;
  private accessToken: ByosAccessToken | null = null;

  protected readonly options: ByosProviderOptions;

  constructor(options: ByosProviderOptions) {
    this.options = options;
  }

  abstract isConfigured(): boolean;
  protected abstract buildAuthorizationUrl(
    redirectUri: string,
    state: string,
    codeChallenge: string
  ): URL;
  protected abstract exchangeAuthorizationCode(
    code: string,
    codeVerifier: string,
    redirectUri: string
  ): Promise<TokenResponse>;
  protected abstract refreshAccessToken(
    refreshToken: string
  ): Promise<TokenResponse>;
  abstract upload(file: File): Promise<ByosUploadedFile>;
  abstract resolveBlob(fileId: string): Promise<Blob>;
  abstract createPublicLink(fileId: string): Promise<string>;

  async beginAuthorization(redirectUri: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error(`${this.label} is not configured for this environment.`);
    }
    const transaction = await createPkceTransaction(this.id);
    globalThis.location.assign(
      this.buildAuthorizationUrl(
        redirectUri,
        transaction.state,
        transaction.codeChallenge
      ).toString()
    );
  }

  async completeAuthorization(
    callbackUrl: URL,
    redirectUri: string
  ): Promise<ByosConnectionStatus> {
    const providerError = callbackUrl.searchParams.get("error");
    if (providerError) {
      consumePkceTransaction(this.id, callbackUrl.searchParams.get("state"));
      throw new Error("Provider authorization was not completed.");
    }
    const code = callbackUrl.searchParams.get("code");
    if (!code) {
      throw new Error("Provider authorization did not return a code.");
    }
    const transaction = consumePkceTransaction(
      this.id,
      callbackUrl.searchParams.get("state")
    );
    const token = await this.exchangeAuthorizationCode(
      code,
      transaction.codeVerifier,
      redirectUri
    );
    this.saveAccessToken(token);
    if (token.refreshToken) {
      await putLocalRefreshToken(
        this.options.userId,
        this.id,
        token.refreshToken
      );
    }
    return "connected";
  }

  async getConnectionStatus(): Promise<ByosConnectionStatus> {
    if (!this.isConfigured()) {
      return "unconfigured";
    }
    if (this.hasCurrentAccessToken()) {
      return "connected";
    }
    return (await getLocalRefreshToken(this.options.userId, this.id))
      ? "expired"
      : "unconnected";
  }

  async disconnect(): Promise<void> {
    this.accessToken = null;
    await deleteLocalRefreshToken(this.options.userId, this.id);
  }

  protected async getAccessToken(): Promise<string> {
    if (this.hasCurrentAccessToken()) {
      return this.accessToken!.accessToken;
    }
    const refreshToken = await getLocalRefreshToken(
      this.options.userId,
      this.id
    );
    if (!refreshToken) {
      throw new Error(
        "Connect this storage provider before using audio files."
      );
    }
    try {
      const token = await this.refreshAccessToken(refreshToken);
      this.saveAccessToken(token);
      if (token.refreshToken) {
        await putLocalRefreshToken(
          this.options.userId,
          this.id,
          token.refreshToken
        );
      }
      return token.accessToken;
    } catch (error) {
      this.accessToken = null;
      throw error;
    }
  }

  private hasCurrentAccessToken() {
    return (
      !!this.accessToken && this.accessToken.expiresAt > Date.now() + 30_000
    );
  }

  private saveAccessToken(token: TokenResponse) {
    this.accessToken = {
      accessToken: token.accessToken,
      expiresAt: Date.now() + Math.max(60, token.expiresIn ?? 3600) * 1000,
    };
  }
}

type GoogleTokenPayload = {
  token?: {
    accessToken?: unknown;
    expiresIn?: unknown;
    refreshToken?: unknown;
  };
};

class GoogleDriveProvider extends BrowserStorageProvider {
  readonly id = "google-drive" as const;
  readonly label = "Google Drive";
  private readonly clientId =
    import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? "";

  isConfigured() {
    return this.clientId.length > 0;
  }

  protected buildAuthorizationUrl(
    redirectUri: string,
    state: string,
    codeChallenge: string
  ) {
    const url = new URL(GOOGLE_AUTHORIZATION_URL);
    url.search = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/drive.file",
      access_type: "offline",
      prompt: "consent",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
    }).toString();
    return url;
  }

  protected exchangeAuthorizationCode(
    code: string,
    codeVerifier: string,
    redirectUri: string
  ) {
    return this.exchangeWithWorker({
      grantType: "authorization_code",
      clientId: this.clientId,
      code,
      codeVerifier,
      redirectUri,
    });
  }

  protected refreshAccessToken(refreshToken: string) {
    return this.exchangeWithWorker({
      grantType: "refresh_token",
      clientId: this.clientId,
      refreshToken,
    });
  }

  private async exchangeWithWorker(payload: Record<string, string>) {
    const appAccessToken = this.options.getAppAccessToken();
    if (!appAccessToken) {
      throw new Error("Sign in to TuneTrees before connecting Google Drive.");
    }
    const response = await fetch(
      new URL("/api/byos/google/token", WORKER_URL),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${appAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );
    assertSuccess(response, "Google authorization");
    const result = await parseJson<GoogleTokenPayload>(
      response,
      "Google authorization"
    );
    const accessToken = result.token?.accessToken;
    if (typeof accessToken !== "string" || !accessToken) {
      throw new Error("Google authorization returned no access token.");
    }
    return {
      accessToken,
      expiresIn:
        typeof result.token?.expiresIn === "number"
          ? result.token.expiresIn
          : undefined,
      refreshToken:
        typeof result.token?.refreshToken === "string"
          ? result.token.refreshToken
          : undefined,
    };
  }

  async upload(file: File): Promise<ByosUploadedFile> {
    const token = await this.getAccessToken();
    const metadata = { name: file.name, mimeType: file.type || "audio/mpeg" };
    const start = await fetch(
      `${GOOGLE_API_URL}/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": metadata.mimeType,
          "X-Upload-Content-Length": String(file.size),
        },
        body: JSON.stringify(metadata),
      }
    );
    assertSuccess(start, "Google Drive upload initialization");
    const uploadUrl = start.headers.get("Location");
    if (!uploadUrl) {
      throw new Error("Google Drive did not return an upload session.");
    }
    const upload = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": metadata.mimeType,
        "Content-Range": `bytes 0-${Math.max(0, file.size - 1)}/${file.size}`,
      },
      body: file,
    });
    assertSuccess(upload, "Google Drive upload");
    const result = await parseJson<{
      id?: string;
      name?: string;
      mimeType?: string;
      size?: string;
    }>(upload, "Google Drive upload");
    if (!result.id) {
      throw new Error("Google Drive upload returned no file identifier.");
    }
    return {
      fileId: result.id,
      fileName: result.name || file.name,
      contentType: result.mimeType || metadata.mimeType,
      size: Number(result.size) || file.size,
    };
  }

  async resolveBlob(fileId: string) {
    const token = await this.getAccessToken();
    const response = await fetch(
      `${GOOGLE_API_URL}/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    assertSuccess(response, "Google Drive audio download");
    return response.blob();
  }

  async createPublicLink(fileId: string) {
    const token = await this.getAccessToken();
    const permission = await fetch(
      `${GOOGLE_API_URL}/drive/v3/files/${encodeURIComponent(fileId)}/permissions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "anyone", role: "reader" }),
      }
    );
    assertSuccess(permission, "Google Drive public-link creation");
    const file = await fetch(
      `${GOOGLE_API_URL}/drive/v3/files/${encodeURIComponent(fileId)}?fields=webViewLink`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    assertSuccess(file, "Google Drive public-link lookup");
    const result = await parseJson<{ webViewLink?: string }>(
      file,
      "Google Drive public-link lookup"
    );
    if (!result.webViewLink) {
      throw new Error("Google Drive did not return a public link.");
    }
    return result.webViewLink;
  }
}

type DropboxTokenPayload = {
  access_token?: unknown;
  expires_in?: unknown;
  refresh_token?: unknown;
};

class DropboxProvider extends BrowserStorageProvider {
  readonly id = "dropbox" as const;
  readonly label = "Dropbox";
  private readonly clientId =
    import.meta.env.VITE_DROPBOX_CLIENT_ID?.trim() ?? "";

  isConfigured() {
    return this.clientId.length > 0;
  }

  protected buildAuthorizationUrl(
    redirectUri: string,
    state: string,
    codeChallenge: string
  ) {
    const url = new URL(DROPBOX_AUTHORIZATION_URL);
    url.search = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      token_access_type: "offline",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
    }).toString();
    return url;
  }

  protected exchangeAuthorizationCode(
    code: string,
    codeVerifier: string,
    redirectUri: string
  ) {
    return this.exchangeToken({
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    });
  }

  protected refreshAccessToken(refreshToken: string) {
    return this.exchangeToken({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  }

  private async exchangeToken(values: Record<string, string>) {
    const response = await fetch(DROPBOX_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: this.clientId, ...values }),
    });
    assertSuccess(response, "Dropbox authorization");
    const result = await parseJson<DropboxTokenPayload>(
      response,
      "Dropbox authorization"
    );
    if (typeof result.access_token !== "string" || !result.access_token) {
      throw new Error("Dropbox authorization returned no access token.");
    }
    return {
      accessToken: result.access_token,
      expiresIn:
        typeof result.expires_in === "number" ? result.expires_in : undefined,
      refreshToken:
        typeof result.refresh_token === "string"
          ? result.refresh_token
          : undefined,
    };
  }

  async upload(file: File): Promise<ByosUploadedFile> {
    const token = await this.getAccessToken();
    const response = await fetch(`${DROPBOX_CONTENT_URL}/files/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: `/${file.name}`,
          mode: "add",
          autorename: true,
          mute: false,
        }),
      },
      body: file,
    });
    assertSuccess(response, "Dropbox upload");
    const result = await parseJson<{
      id?: string;
      name?: string;
      size?: number;
    }>(response, "Dropbox upload");
    if (!result.id) {
      throw new Error("Dropbox upload returned no file identifier.");
    }
    return {
      fileId: result.id,
      fileName: result.name || file.name,
      contentType: file.type || "audio/mpeg",
      size: result.size ?? file.size,
    };
  }

  async resolveBlob(fileId: string) {
    const token = await this.getAccessToken();
    const response = await fetch(`${DROPBOX_CONTENT_URL}/files/download`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Dropbox-API-Arg": JSON.stringify({ path: fileId }),
      },
    });
    assertSuccess(response, "Dropbox audio download");
    return response.blob();
  }

  async createPublicLink(fileId: string) {
    const token = await this.getAccessToken();
    const response = await fetch(
      `${DROPBOX_API_URL}/sharing/create_shared_link_with_settings`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: fileId }),
      }
    );
    if (response.status === 409) {
      throw new Error(
        "A Dropbox public link already exists; reconnect and retry."
      );
    }
    assertSuccess(response, "Dropbox public-link creation");
    const result = await parseJson<{ url?: string }>(
      response,
      "Dropbox public-link creation"
    );
    if (!result.url) {
      throw new Error("Dropbox did not return a public link.");
    }
    return result.url;
  }
}

export function createByosProviders(options: ByosProviderOptions) {
  return {
    "google-drive": new GoogleDriveProvider(options),
    dropbox: new DropboxProvider(options),
  } satisfies Record<ByosProviderId, ByosStorageProvider>;
}
