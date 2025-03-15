"use server";

import type { AccountFormValues } from "@/app/auth/newuser/account-form";
import {
  verification_mail_html,
  verification_mail_text,
} from "@/auth/auth-send-request";
import {
  type IExtendedAdapterUser,
  getUserExtendedByEmail,
  ttHttpAdapter,
} from "@/auth/auth-tt-adapter";

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
  const existingUser = await getUserExtendedByEmail(email);

  if (existingUser) {
    // TODO:  This should be an dialog box, to the user, giving them the
    // option to reset their password, or to have the email resent.
    throw new Error(`User already exists for ${email}.`);
  }

  if (!ttHttpAdapter.createUser) {
    throw new Error("ttHttpAdapter.createUser is not defined.");
  }

  // Since we are creating a new user, we need to hash the password.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bcrypt = require("bcryptjs");

  // We'll go ahead and create the user in the database, with the hashed password,
  //  but we'll leave the emailVerified field null, until the user verifies their email.
  // And we won't allow logging in until the email is verified.
  const user: IExtendedAdapterUser = {
    id: "",
    name: data.name,
    email: email,
    emailVerified: null,

    hash: bcrypt.hashSync(data.password, bcrypt.genSaltSync()),
  };

  const stringifiedUser = JSON.stringify(user);

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
    //   body: stringifiedUser,
    // });
    // const data = await create_user_response.json();
    // console.log(data);
    // const create_user_response = await ttHttpAdapter.createUser(user);

    const createUserResponse = await axios.post(
      `${_baseURL}/auth/signup/`,
      stringifiedUser,
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    console.log("createUserResponse: ", createUserResponse);
  } catch (error) {
    console.error(error);
    throw error;
  }

  const emailTo = email;

  const linkBackURL = `https://${host}/api/verify-user?email=${email}&password=${data.password}`;
  // const linkBackURL = `https://${host}/auth/login?email=${email}`;

  const sendGridResponse = await sendGrid({
    to: emailTo,
    from: "admin@tunetrees.com",
    subject: "Email Verification",
    html: verification_mail_html({
      url: linkBackURL,
      host: `https://${host}`,
      theme: { brandColor: "#000000", buttonText: "Verify Email" },
      // theme: { colorScheme: "auto", logo: "/logo4.png" },
    }),
    text: verification_mail_text({
      url: linkBackURL,
      host: `https://${host}:3000`,
    }),
    // dynamicTemplateData: {
    //   verificationLink: linkBackURL,
    // },
  });
  console.log("Email sent:", sendGridResponse);

  return {
    status: `User created successfully.  Verification email sent to ${email}.`,
  };

  // Redirect to verify-request page
  // redirect("/verify-request");
};
