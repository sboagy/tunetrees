import { NextResponse } from "next/server";

// Server redirect for /user-settings -> /user-settings/scheduling-options
// Chosen over page.tsx redirect to avoid React render pass and potential hook ordering issues in tests.
export function GET(request: Request) {
  const target = new URL("/user-settings/scheduling-options", request.url);
  return NextResponse.redirect(target, { status: 307 });
}

export function HEAD(request: Request) {
  return GET(request);
}
