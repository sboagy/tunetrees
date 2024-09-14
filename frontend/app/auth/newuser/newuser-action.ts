"use server";

import type { AccountFormValues } from "@/app/auth/newuser/account-form";
import { assertIsDefined } from "@/auth";
import {
  type ExtendedAdapterUser,
  getUserExtendedByEmail,
  ttHttpAdapter,
} from "@/auth/auth_tt_adapter";
import {
  verification_mail_html,
  verification_mail_text,
} from "@/auth/authSendRequest";
import { sendGrid } from "@/auth/helpers";
import axios from "axios";
// import { redirect } from "next/navigation";

const _baseURL = process.env.NEXT_BASE_URL;

export const newUser = async (data: AccountFormValues, host: string) => {
  const email = data.email;
  console.log("newUser data: ", data);

  if (!email) {
    throw new Error("Empty Email.");
  }

  // const secret = process.env.NEXTAUTH_SECRET;

  // Unfortunately, this will strip off the hash
  // let user = await ttHttpAdapter.getUserByEmail(email);

  // So instead we use a customized variant
  const existing_user = await getUserExtendedByEmail(email);

  if (existing_user) {
    // TODO:  This should be an dialog box, to the user, giving them the
    // option to reset their password, or to have the email resent.
    throw new Error(`User already exists for ${email}.`);
  }

  assertIsDefined(ttHttpAdapter.createUser);

  // Since we are creating a new user, we need to hash the password.
  const bcrypt = require("bcryptjs");

  // We'll go ahead and create the user in the database, with the hashed password,
  //  but we'll leave the emailVerified field null, until the user verifies their email.
  // And we won't allow logging in until the email is verified.
  const user: ExtendedAdapterUser = {
    id: "",
    name: data.name,
    email: email,
    emailVerified: null,
    hash: bcrypt.hashSync(data.password, bcrypt.genSaltSync()),
  };

  const stringify_user = JSON.stringify(user);

  try {
    // Calling fetch or the ttHttpAdapter.createUser method will
    // fail here with an 'write EPIPE' error.  Are we really running
    // on the server here?
    //
    // const create_user_response = await fetch("/auth/signup/", {
    //   method: "POST",
    //   headers: {
    //     accept: "application/json",
    //     "Content-Type": "application/json",
    //   },
    //   body: stringify_user,
    // });
    // const data = await create_user_response.json();
    // console.log(data);
    // const create_user_response = await ttHttpAdapter.createUser(user);

    const create_user_response = await axios.post(
      `${_baseURL}/auth/signup/`,
      stringify_user,
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    console.log("create_user_response: ", create_user_response);
  } catch (e) {
    console.error(e);
    throw e;
  }

  // const email_to = email;
  const email_to = "sboagy@gmail.com";

  const send_grid_response = await sendGrid({
    to: email_to,
    from: "admin@tunetrees.com",
    subject: "Email Verification",
    html: verification_mail_html({
      url: `https://${host}/api/verify-user?email=${email}&password=${data.password}`,
      host: `https://${host}`,
      theme: { colorScheme: "auto", logo: "/logo4.png" },
    }),
    text: verification_mail_text({
      url: `https://${host}/api/verify-user?email=${email}&password=${data.password}`,
      host: `https://${host}:3000`,
    }),
    dynamicTemplateData: {
      verificationLink: `https://${host}/api/verify-user?email=${email}&password=${data.password}`,
    },
  });
  console.log("Email sent:", send_grid_response);

  return {
    status: `User created successfully.  Verification email sent to ${email}.`,
  };

  // Redirect to verify-request page
  // redirect("/verify-request");
};
