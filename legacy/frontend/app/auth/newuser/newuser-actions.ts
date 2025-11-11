"use server";

import type { AdapterUser } from "next-auth/adapters";
import type { AccountFormValues } from "@/app/auth/newuser/account-form";
import {
  verification_mail_html,
  verification_mail_text,
} from "@/auth/auth-send-request";
import {
  getUserExtendedByEmail,
  type IExtendedAdapterUser,
  ttHttpAdapter,
} from "@/auth/auth-tt-adapter";
import { sendGrid } from "@/auth/helpers";
// import { redirect } from "next/navigation";

export const newUser = async (
  data: AccountFormValues,
  host: string,
): Promise<{
  status: string;
  linkBackURL?: string;
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
    console.log(
      `Found existing user for ${email}:`,
      JSON.stringify({
        id: existingUser.id,
        email: existingUser.email,
        emailVerified: existingUser.emailVerified,
        emailVerifiedType: typeof existingUser.emailVerified,
      }),
    );

    // Check if the existing user has verified their email
    if (existingUser.emailVerified) {
      console.log(`User ${email} is verified, blocking signup`);
      // User exists and is verified - this is a legitimate conflict
      // TODO: This should be a dialog box, giving them options to reset password or resend email
      throw new Error(
        `User already exists for ${email}. If this is your account, please use the sign-in page or reset your password.`,
      );
    }
    console.log(`User ${email} is NOT verified, proceeding with cleanup`);
    // User exists but email is not verified - they likely abandoned signup
    // Delete the unverified user to allow them to complete registration
    console.log(
      `Removing unverified user account for ${email} to allow signup completion`,
    );

    if (!ttHttpAdapter.deleteUser) {
      throw new Error("ttHttpAdapter.deleteUser is not defined.");
    }

    try {
      await ttHttpAdapter.deleteUser(existingUser.id);
      console.log(
        `Successfully removed unverified user ${existingUser.id} for ${email}`,
      );
    } catch (error) {
      console.error(
        `Failed to delete unverified user: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw new Error(
        "Unable to complete signup. Please contact support if this issue persists.",
      );
    }
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

  // Check if SMS verification is being used
  const useSmsVerification = !!data.phone;

  let linkBackURL = "";
  let verificationToken = null;

  // Only create email verification token if NOT using SMS verification
  if (!useSmsVerification) {
    // Generate a 6-digit one-time password for verification
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
    if (!ttHttpAdapter.createVerificationToken) {
      throw new Error("ttHttpAdapter.createVerificationToken is not defined.");
    }
    verificationToken = await ttHttpAdapter.createVerificationToken({
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

    linkBackURL = `https://${host}/api/verify-user?email=${email}&token=${verificationToken.token}`;

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
  }

  // If user provided a phone number, send SMS verification (instead of email)
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
          status: `User created successfully. SMS verification sent to ${data.phone}.`,
          smsVerificationRequired: true,
          phone: data.phone,
        };
      }
      console.error(
        "Failed to send SMS verification:",
        await smsResponse.text(),
      );

      // If SMS fails and we didn't send email, we need to create email verification as fallback
      if (useSmsVerification) {
        throw new Error(
          "SMS verification failed and no email backup was prepared. Please try again.",
        );
      }
    } catch (error) {
      console.error("SMS verification error:", error);
      // If SMS fails and we didn't send email, we need to create email verification as fallback
      if (useSmsVerification) {
        throw new Error(
          "SMS verification failed and no email backup was prepared. Please try again.",
        );
      }
    }
  }

  return {
    status: `User created successfully.  Verification email sent to ${email}.`,
    linkBackURL: linkBackURL,
  };

  // Redirect to verify-request page
  // redirect("/verify-request");
};
