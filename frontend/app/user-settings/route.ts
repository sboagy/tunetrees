import { type NextRequest, NextResponse } from "next/server";

// Server redirect for /user-settings -> /user-settings/scheduling-options
// Chosen over page.tsx redirect to avoid React render pass and potential hook ordering issues in tests.
export function GET(request: NextRequest) {
  // Prefer configured public base URL when present
  const configuredBase =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || undefined;

  if (configuredBase) {
    const absolute = new URL(
      "/user-settings/scheduling-options",
      configuredBase,
    ).toString();
    return NextResponse.redirect(absolute, 307);
  }

  // Otherwise, build from forwarded headers to respect proxy origin
  const xfProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const xfHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = xfHost || request.headers.get("host") || request.nextUrl.host;
  const proto = xfProto || request.nextUrl.protocol.replace(":", "") || "https";
  const absolute = `${proto}://${host}/user-settings/scheduling-options`;
  return NextResponse.redirect(absolute, 307);
}

export function HEAD(request: NextRequest) {
  return GET(request);
}
