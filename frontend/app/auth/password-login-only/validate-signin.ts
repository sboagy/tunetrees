"use server";

import { getUserExtendedByEmail } from "@/auth/auth_tt_adapter";
import { matchPasswordWithHash } from "@/auth/password-match";

export async function authorizeWithPassword(email: string, password: string) {
  //   assertIsDefined(ttHttpAdapter.getUserByEmail);

  if (!email) {
    throw new Error("Empty Email.");
  }

  // const secret = process.env.NEXTAUTH_SECRET;

  // Unfortunately, this will strip off the hash
  // let user = await ttHttpAdapter.getUserByEmail(email);

  // So instead we use a customized variant
  const user = await getUserExtendedByEmail(email);

  if (!user) {
    // No user found, so this is their first attempt to login.
    // Redirect to the registration (sign up) page.
    throw new Error("User not found.");
  }

  // const user = { id: "1", name: "J Smith", email: "jsmith@example.com" };
  // debugger;
  if (user) {
    if (!password) {
      throw new Error("Empty Password.");
    }
    if (user.hash === undefined || user.hash === null) {
      throw new Error("No password hash found for user.");
    }

    const match = await matchPasswordWithHash(password, user.hash);
    if (match) {
      // Any object returned will be saved in `user` property of the JWT
      return user;
    }
    // redirect("/auth/password-no-match");
    // throw new Error("Password does not match");
    throw new Error("Password does not match.");
  }
  // No user found, so this is their first attempt to login
  // meaning this is also the place you could do registration
  // ...If you return null then an error will be displayed advising the user to check their details.
  throw new Error("User not found.");
}
