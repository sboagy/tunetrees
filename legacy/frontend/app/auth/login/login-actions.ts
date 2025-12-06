"use server";

import { signIn } from "auth";
// import { redirect } from "next/navigation";

// const _baseURL = process.env.NEXT_BASE_URL;

export async function loginWithCredentials(
  email: string,
  password: string,
  host: string,
) {
  // This is a placeholder for the social login code.
  // It will be implemented in a future release.
  console.log("loginWithCredentials: ", email);
  await signIn("credentials", {
    email,
    password,
    callbackUrl: `http://${host}`,
  });
}
