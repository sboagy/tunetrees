const DEFAULT_WORKER_URL =
  import.meta.env.VITE_WORKER_URL || "http://localhost:8787";

const MEDIA_VIEW_PATH = "/api/media/view";
const MEDIA_TOKEN_PARAM = "token";

const applyAuthTokenToMediaUrl = (
  rawUrl: string,
  token: string | undefined,
  workerUrl = DEFAULT_WORKER_URL
) => {
  try {
    const sourceUrl = new URL(rawUrl, workerUrl);
    const key = sourceUrl.searchParams.get("key");
    if (sourceUrl.pathname !== MEDIA_VIEW_PATH || !key) {
      return rawUrl;
    }

    // Uploaded-media rows historically persisted the absolute Worker URL.
    // Always use this build's Worker for a managed media key so copied staging
    // rows are authorized by staging and can use its read fallback.
    const url = new URL(MEDIA_VIEW_PATH, workerUrl);
    url.searchParams.set("key", key);

    if (token) {
      url.searchParams.set(MEDIA_TOKEN_PARAM, token);
    } else {
      url.searchParams.delete(MEDIA_TOKEN_PARAM);
    }

    return url.toString();
  } catch {
    return rawUrl;
  }
};

const applyAuthTokenToMediaHtml = (
  html: string,
  token: string | undefined,
  workerUrl = DEFAULT_WORKER_URL
) => {
  if (!html) {
    return html;
  }

  const template = document.createElement("template");
  template.innerHTML = html;

  for (const element of template.content.querySelectorAll<HTMLElement>(
    "img[src],a[href]"
  )) {
    const attr = element.tagName === "IMG" ? "src" : "href";
    const currentValue = element.getAttribute(attr);
    if (!currentValue) {
      continue;
    }

    element.setAttribute(
      attr,
      applyAuthTokenToMediaUrl(currentValue, token, workerUrl)
    );
  }

  return template.innerHTML;
};

export const buildMediaUploadUrl = (workerUrl = DEFAULT_WORKER_URL) =>
  new URL("/api/media/upload", workerUrl).toString();

export const buildMediaViewUrl = (
  key: string,
  workerUrl = DEFAULT_WORKER_URL
) => {
  const url = new URL(MEDIA_VIEW_PATH, workerUrl);
  url.searchParams.set("key", key);
  return url.toString();
};

export const attachMediaAuthToken = (
  html: string,
  token: string | undefined,
  workerUrl = DEFAULT_WORKER_URL
) => applyAuthTokenToMediaHtml(html, token, workerUrl);

export const stripMediaAuthToken = (
  html: string,
  workerUrl = DEFAULT_WORKER_URL
) => applyAuthTokenToMediaHtml(html, undefined, workerUrl);

export const attachMediaAuthTokenToUrl = (
  url: string,
  token: string,
  workerUrl = DEFAULT_WORKER_URL
) => applyAuthTokenToMediaUrl(url, token, workerUrl);
