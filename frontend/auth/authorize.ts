import { AuthError, CredentialsSignin } from "next-auth";
import {
  verification_mail_html,
  verification_mail_text,
} from "./auth-send-request";
import { getUserExtendedByEmail, ttHttpAdapter } from "./auth-tt-adapter";
import { sendGrid } from "./helpers";
import { matchPasswordWithHash } from "./password-match";

function logObject(obj: unknown, expand: boolean) {
  if (expand) {
    return JSON.stringify(obj, null, 4);
  }
  return String(obj);
}

// This is really kind of a placeholder until next-auth/auth.js fixes their error handling.
// See https://github.com/nextauthjs/next-auth/pull/11469
// But reading the next-auth code, there seems to be no way to get the error message to the client.  None.
export class InvalidLoginError extends CredentialsSignin {
  code = "custom";
  constructor(message: string) {
    super(message);
    this.code = "custom";
  }
}

// export class MissingAdapterMethods extends AuthError {
//   code = "custom";
//   constructor(message: string) {
//     super(message);
//     this.type = "AdapterError";
//   }
// }
class MissingAdapterMethods extends AuthError {
  code = "custom";
  static type = "MissingAdapterMethods";
}

export const BASE_PATH = "/auth";
export async function authorize(
  credentials: Partial<Record<"email" | "password", unknown>>,
  request: Request,
) {
  console.log("===> auth/index.ts:99 ~ authorize: ", logObject(request, false));
  // Use credentials object directly instead of URL search params
  const email: string | undefined | unknown = credentials?.email;

  if (!email) {
    throw new InvalidLoginError("Empty Email");
  }

  const user = await getUserExtendedByEmail(email as string);

  const host = request.headers.get("host");

  if (!user) {
    console.log(
      "===> auth/index.ts:140 ~ authorize -- No user found, so this is their first attempt to login",
    );

    // No user found, so this is their first attempt to login
    // meaning this is also the place we can do registration
    // ...If you return null then an error will be displayed advising the user to check their details.
    // Do a magic check to see if this is a test email address, and if so, send the email to me.
    const toEmail = (email as string).includes("test658.com")
      ? "sboagy@gmail.com"
      : (email as string);

    await sendGrid({
      to: toEmail,
      from: "admin@tunetrees.com",
      subject: "Email Verification",
      html: verification_mail_html({
        url: `https://${host}/verify?email=${email as string}`,
        host: `https://${host}`,
        // theme: { colorScheme: "auto", logo: "/logo4.png" },
        theme: { brandColor: "auto", buttonText: "Verify Email" },
      }),
      text: verification_mail_text({
        url: `https://${host}/verify?email=${email as string}`,
        host: `https://${host}:3000`,
      }),
      dynamicTemplateData: {
        verificationLink: `https://${host}/verify?email=${credentials.email as string}`,
      },
    });
  }

  // const user = { id: "1", name: "J Smith", email: "jsmith@example.com" };
  // debugger;
  if (user) {
    console.log("===> auth/index.ts:176 ~ authorize -- user found");
    if (!credentials.password) {
      throw new InvalidLoginError("Empty Password");
    }
    const password = credentials.password as string;
    if (user.hash === undefined || user.hash === null) {
      throw new InvalidLoginError("No password hash found for user");
    }

    if (user.emailVerified === null) {
      throw new InvalidLoginError("User's email has not been verified");
    }

    const match = await matchPasswordWithHash(password, user.hash);
    if (match) {
      // Any object returned will be saved in `user` property of the JWT
      console.log("===> auth/index.ts:192 ~ authorize -- password matches");
      return user;
    }
    // redirect("/auth/password-no-match");
    // throw new InvalidLoginError("Password does not match");
    console.log(
      "===> auth/index.ts:197 ~ authorize -- password does not match.",
    );
    throw new InvalidLoginError("Password does not match");
  }
  // No user found, so this is their first attempt to login
  // meaning this is also the place you could do registration
  // ...If you return null then an error will be displayed advising the user to check their details.
  console.log(
    "===> auth/index.ts:205 ~ authorize -- User not found, exiting function",
  );
  throw new InvalidLoginError("User not found");
}
export async function authorizeWithToken(
  credentials: Partial<Record<"email" | "token", unknown>>,
) {
  // Implement your own logic to find the user
  if (!ttHttpAdapter.getUserByEmail) {
    throw new MissingAdapterMethods(
      "getUserByEmail is not defined in ttHttpAdapter",
    );
  }
  const user = await ttHttpAdapter.getUserByEmail(credentials.email as string);
  if (user) {
    if (!ttHttpAdapter.useVerificationToken) {
      console.log(
        "===> index.ts:331 ~ signIn callback -- useVerificationToken is not defined",
      );
      throw new MissingAdapterMethods(
        "useVerificationToken is not defined in ttHttpAdapter",
      );
    }
    const verificationToken = await ttHttpAdapter.useVerificationToken({
      identifier: credentials.email as string,
      token: credentials.token as string,
    });

    if (!verificationToken) {
      console.log(
        "===> index.ts:331 ~ signIn callback -- verificationToken is not defined",
      );
      throw new InvalidLoginError("verificationToken is not defined");
    }

    if (verificationToken.expires < new Date()) {
      console.log(
        "===> index.ts:331 ~ signIn callback -- verificationToken is expired",
      );
      throw new InvalidLoginError("verificationToken is expired");
    }

    if (!ttHttpAdapter.updateUser) {
      throw new MissingAdapterMethods(
        "updateUser is not defined in ttHttpAdapter",
      );
    }
    user.emailVerified = new Date();
    const updatedUser = await ttHttpAdapter.updateUser({
      id: user.id,
      emailVerified: user.emailVerified,
    });
    if (!updatedUser) {
      throw new InvalidLoginError(
        "Failed to update user with email verification date.",
      );
    }

    return user;
  }
  return null;
}
