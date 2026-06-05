export function parseAbsoluteUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.codePointAt(end - 1) === 47) {
    end -= 1;
  }
  return end === value.length ? value : value.slice(0, end);
}

export function trimLeadingSlashes(value: string): string {
  let start = 0;
  while (start < value.length && value.codePointAt(start) === 47) {
    start += 1;
  }
  return start === 0 ? value : value.slice(start);
}

function trimTrailingDots(value: string): string {
  let end = value.length;
  while (end > 0 && value.codePointAt(end - 1) === 46) {
    end -= 1;
  }
  return end === value.length ? value : value.slice(0, end);
}

export function hasHttpProtocol(value: string): boolean {
  const parsedUrl = parseAbsoluteUrl(value);
  return (
    parsedUrl !== null &&
    (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:")
  );
}

export function matchesHostname(
  urlOrHostname: URL | string,
  expectedHostname: string
): boolean {
  const hostname =
    typeof urlOrHostname === "string" ? urlOrHostname : urlOrHostname.hostname;

  // Some fully-qualified hostnames may legally include a trailing dot.
  const normalizedHostname = trimTrailingDots(hostname.toLowerCase());
  const normalizedExpected = expectedHostname.toLowerCase();
  const exactMatch = normalizedHostname === normalizedExpected;
  const subdomainMatch = normalizedHostname.endsWith(`.${normalizedExpected}`);

  return exactMatch || subdomainMatch;
}

export function getUrlPathSegments(urlOrValue: URL | string): string[] {
  const parsedUrl =
    typeof urlOrValue === "string" ? parseAbsoluteUrl(urlOrValue) : urlOrValue;

  if (!parsedUrl) {
    return [];
  }

  return parsedUrl.pathname.split("/").filter(Boolean);
}

export function pathHasExtension(
  urlOrValue: URL | string,
  extension: string
): boolean {
  const parsedUrl =
    typeof urlOrValue === "string" ? parseAbsoluteUrl(urlOrValue) : urlOrValue;

  if (!parsedUrl) {
    return false;
  }

  const normalizedExtension = extension.startsWith(".")
    ? extension.toLowerCase()
    : `.${extension.toLowerCase()}`;

  return parsedUrl.pathname.toLowerCase().endsWith(normalizedExtension);
}
