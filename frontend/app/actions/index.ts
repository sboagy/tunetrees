"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";

export async function doSocialLogin(formData: FormData) {
  const action = formData.get("action");
  //   if (action === null){
  //     throw Error("No action provided");
  //   }
  try {
    await signIn(action as string, { redirectTo: "/home" });
  } catch (error) {
    if (error instanceof AuthError) {
      return "log in failed with error: " + error.message;
    }
    console.error(error);
    throw error;
  }
}

export async function doLogout() {
  await signOut({ redirectTo: "/" });
}
