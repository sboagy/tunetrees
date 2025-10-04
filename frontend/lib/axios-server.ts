// Note: Do NOT mark this file with a server/client directive.
// It must stay server-only by virtue of Node imports (http/https),
// but exporting functions here should not be treated as Server Actions.

// Server-only axios factory with small, CI-safe retry/backoff for transient network errors
import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import http from "node:http";
import https from "node:https";

interface IRetryMeta {
  __retryCount?: number;
}

const transientCodes = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT"]);

function isTransientNetworkError(error: unknown): boolean {
  // Narrow common axios error shape
  const err = error as { code?: string; message?: string; cause?: unknown };
  if (err?.code && transientCodes.has(err.code)) return true;
  const msg = (err?.message || "").toUpperCase();
  // Guard for undici/socket wording seen in logs
  if (msg.includes("SOCKET HANG UP")) return true;
  if (msg.includes("UND_ERR_SOCKET")) return true;
  return false;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createServerAxios(baseURL: string): AxiosInstance {
  const keepAliveHttp = new http.Agent({ keepAlive: true, maxSockets: 50 });
  const keepAliveHttps = new https.Agent({ keepAlive: true, maxSockets: 50 });

  const instance = axios.create({
    baseURL,
    timeout: 6000,
    httpAgent: keepAliveHttp,
    httpsAgent: keepAliveHttps,
    // Prevent axios from converting payload unexpectedly; rely on explicit headers
    transitional: { clarifyTimeoutError: true },
    // No proxy in CI by default
    proxy: false,
  });

  // Lightweight retry on connection-level failures only. Defaults:
  // - CI: up to 3 attempts with 100/200/400ms backoff
  // - Local: 1 attempt (no retry) to surface issues quickly
  const maxRetries = process.env.CI ? 3 : 0;

  instance.interceptors.response.use(
    (resp) => resp,
    async (error) => {
      if (!isTransientNetworkError(error)) {
        throw error;
      }
      const config = (error.config || {}) as AxiosRequestConfig & IRetryMeta;
      const attempt = (config.__retryCount || 0) + 1;
      if (attempt > maxRetries) {
        throw error;
      }
      config.__retryCount = attempt;
      const delay = 100 * 2 ** (attempt - 1); // 100, 200, 400
      if (process.env.CI) {
        console.warn(
          `[axios-server] transient ${String(error.code)} on ${config.url}; retry ${attempt}/${maxRetries} in ${delay}ms`,
        );
      }
      await sleep(delay);
      return instance.request(config);
    },
  );

  return instance;
}
