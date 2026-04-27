export function parseAbsoluteUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
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
    typeof urlOrHostname === "string"
      ? urlOrHostname
      : urlOrHostname.hostname;

  // Some fully-qualified hostnames may legally include a trailing dot.
  const normalizedHostname = hostname.toLowerCase().replace(/\.+$/, "");
  const normalizedExpected = expectedHostname.toLowerCase();
  const exactMatch = normalizedHostname === normalizedExpected;
  const subdomainMatch = normalizedHostname.endsWith(
    `.${normalizedExpected}`
  );

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
