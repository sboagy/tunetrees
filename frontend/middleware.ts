import { auth } from "./auth";

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

export default auth((req) => {
  const reqUrl = new URL(req.url);
  console.log("middleware: %s, auth: ", reqUrl, req.auth);
  // This is where we should guard for authentication.
  // if (!req.auth && reqUrl?.pathname !== "/") {
  //   return NextResponse.redirect(
  //     new URL(
  //       `${BASE_PATH}/signin?callbackUrl=${encodeURIComponent(
  //         reqUrl?.pathname
  //       )}`,
  //       req.url
  //     )
  //   );
  // }
});
