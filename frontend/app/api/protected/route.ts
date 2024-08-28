import { auth } from "auth";
import type { AppRouteHandlerFn } from "@/node_modules/next-auth/lib/types";

export const GET: AppRouteHandlerFn = auth((req) => {
  if (req.auth) {
    return Response.json({ data: "Protected data" });
  }

  return Response.json({ message: "Not authenticated" }, { status: 401 });
});
