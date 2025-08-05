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
import type { AdapterUser } from "next-auth/adapters";
// import { redirect } from "next/navigation";

export const newUser = async (
  data: AccountFormValues,
  host: string,
): Promise<{
  status: string;
  linkBackURL: string;
  smsVerificationRequired?: boolean;
  phone?: string;
}> => {
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
  const user: Partial<IExtendedAdapterUser> = {
    name: data.name,
    email: email,
    phone: data.phone || null, // Include phone if provided
    hash: bcrypt.hashSync(data.password, bcrypt.genSaltSync()),
  };

  // const stringifiedUser = JSON.stringify(user);

  const fullUser = await ttHttpAdapter.createUser(user as AdapterUser);

  const emailTo = email;

  // const token: string = btoa(
  //   `${email}:${Math.random().toString(36).substring(2, 15)}`,
  // );

  // Generate a 6-digit one-time password for verification
  const token = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
  if (!ttHttpAdapter.createVerificationToken) {
    throw new Error("ttHttpAdapter.createVerificationToken is not defined.");
  }
  const verificationToken = await ttHttpAdapter.createVerificationToken({
    identifier: email,
    expires,
    token,
  });
  if (!verificationToken) {
    // I think delete user here, which we know was created in this function
    // if we got this far, if we can't create the verification token.
    if (!ttHttpAdapter.deleteUser) {
      throw new Error("ttHttpAdapter.deleteUser is not defined.");
    }
    try {
      await ttHttpAdapter.deleteUser(fullUser.id);
    } catch (error) {
      console.error(
        `Failed to delete user after failed verification token creation: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
    throw new Error("Failed to create verification token.");
  }

  const linkBackURL = `https://${host}/api/verify-user?email=${email}&token=${verificationToken.token}`;
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

  // If user provided a phone number, send SMS verification too
  if (data.phone) {
    try {
      const smsResponse = await fetch(
        `${process.env.TT_API_BASE_URL || "http://localhost:8000"}/sms/send-verification-signup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: data.phone,
          }),
        },
      );

      if (smsResponse.ok) {
        return {
          status: `User created successfully. Verification email sent to ${email}. SMS verification sent to ${data.phone}.`,
          linkBackURL: linkBackURL,
          smsVerificationRequired: true,
          phone: data.phone,
        };
      } else {
        console.error(
          "Failed to send SMS verification:",
          await smsResponse.text(),
        );
        // Continue with email-only verification
      }
    } catch (error) {
      console.error("SMS verification error:", error);
      // Continue with email-only verification
    }
  }

  return {
    status: `User created successfully.  Verification email sent to ${email}.`,
    linkBackURL: linkBackURL,
  };

  // Redirect to verify-request page
  // redirect("/verify-request");
};
