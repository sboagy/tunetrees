import { AuthError, CredentialsSignin } from "next-auth";
import { getUserExtendedByEmail, ttHttpAdapter } from "./auth-tt-adapter";
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

/**
 * Authorizes a user based on provided credentials and request information.
 *
 * @param credentials - A partial record containing the user's email and password.
 *   - `email`: The email address of the user attempting to log in.
 *   - `password`: The password of the user attempting to log in.
 * @param request - The HTTP request object associated with the authorization attempt.
 *
 * @returns The user object if authorization is successful.
 *
 * @throws {InvalidLoginError} If:
 *   - The email is empty or undefined.
 *   - The password is empty or undefined.
 *   - No password hash is found for the user.
 *   - The user's email has not been verified.
 *   - The provided password does not match the stored hash.
 *   - The user is not found in the system.
 *
 * @remarks
 * This function performs the following steps:
 * 1. Validates the presence of the email in the credentials.
 * 2. Retrieves the user by their email.
 * 3. Validates the presence of the password and checks it against the stored hash.
 * 4. Ensures the user's email is verified.
 * 5. Returns the user object if all checks pass.
 *
 * If any of the above checks fail, an `InvalidLoginError` is thrown with an appropriate message.
 */
export async function authorize(
  credentials: Partial<Record<"email" | "password" | "smsVerified", unknown>>,
  request: Request,
) {
  console.log("===> auth/index.ts:99 ~ authorize: ", logObject(request, false));
  // Use credentials object directly instead of URL search params
  const email: string | undefined | unknown = credentials?.email;

  if (!email) {
    throw new InvalidLoginError("Empty Email");
  }

  const user = await getUserExtendedByEmail(email as string);

  // const user = { id: "1", name: "J Smith", email: "jsmith@example.com" };
  // debugger;
  if (user) {
    console.log("===> auth/index.ts:176 ~ authorize -- user found");

    // Check if this is an SMS-verified login (skip password check)
    if (credentials.smsVerified === "true") {
      console.log(
        "===> auth/index.ts ~ SMS verified login, skipping password check",
      );
      // Verify the user is actually SMS verified in the database
      if (user.phoneVerified) {
        console.log(
          "===> auth/index.ts ~ User has verified phone, allowing login",
        );
        return user;
      }
      throw new InvalidLoginError("SMS verification required");
    }

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

/**
 * Authorizes a user using their email and token credentials.
 *
 * This function verifies the user's email and token, checks the validity of the
 * verification token, and updates the user's email verification status if successful.
 *
 * @param credentials - An object containing the user's email and token. Both fields are optional.
 *   - `email`: The email address of the user.
 *   - `token`: The verification token associated with the user.
 *
 * @returns The user object if authorization is successful, or `null` if the user is not found.
 *
 * @throws {MissingAdapterMethods} If required adapter methods (`getUserByEmail`, `useVerificationToken`, or `updateUser`) are not defined.
 * @throws {InvalidLoginError} If the verification token is invalid, expired, or if updating the user fails.
 */
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
