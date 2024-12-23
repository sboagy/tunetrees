"use server";

import { AuthError } from "next-auth";
import { signIn } from "../auth";

export async function googleAuthenticate(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  prevState: string | undefined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  formData: FormData,
) {
  try {
    await signIn("google");
    return "google log in successful";
  } catch (error) {
    if (error instanceof AuthError) {
      return "google log in failed";
    }
    throw error;
  }
}
