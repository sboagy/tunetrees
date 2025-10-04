import { NextResponse } from "next/server";
import { auth } from "./auth";

export const config = {
  matcher: ["/protected-routes/:path*"], // Adjust the matcher to match your protected routes
};

export default auth((req) => {
  // Check if the user is authenticated
  if (!req.auth || !req.auth.user) {
    // Redirect to the login page
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // If the user is authenticated, allow access to the protected route
  return NextResponse.next();
});
