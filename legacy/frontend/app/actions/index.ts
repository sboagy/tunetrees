"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function doSocialLogin(formData: FormData) {
  const action = formData.get("action");
  try {
    return await signIn(action as string, { redirectTo: "/home" });
  } catch (error) {
    if (error instanceof AuthError) {
      return `log in failed with error: ${error.message}`;
    }
    console.error(error);
    throw error;
  }
}
