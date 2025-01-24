/**
 * TuneTrees - Tune Repertoire Practice Assistant
 *
 * Copyright (c) 2024 TuneTrees Software
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import type { NextAuthConfig, NextAuthResult, Session, User } from "next-auth";
import NextAuth, { AuthError } from "next-auth";
import "next-auth/jwt";

import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import SendgridProvider from "next-auth/providers/sendgrid";

import type { AdapterUser } from "next-auth/adapters";
import type { Provider } from "next-auth/providers";
import {
  sendVerificationRequest,
  verification_mail_html,
  verification_mail_text,
} from "./auth-send-request";
import { getUserExtendedByEmail, ttHttpAdapter } from "./auth-tt-adapter";
import { sendGrid } from "./helpers";
import { matchPasswordWithHash } from "./password-match";

export function assertIsDefined<T>(value: T): asserts value is NonNullable<T> {
  if (value === undefined || value === null) {
    throw new Error("Assertion error: value is not NonNullable");
  }
}

function logObject(obj: unknown, expand: boolean) {
  if (expand) {
    return JSON.stringify(obj, null, 4);
  }
  return String(obj);
}

export const BASE_PATH = "/auth";

export const providers: Provider[] = [
  CredentialsProvider({
    id: "credentials",
    // The name to display on the sign in form (e.g. "Sign in with...")
    name: "Email and Password",
    // `credentials` is used to generate a form on the sign in page.
    // You can specify which fields should be submitted, by adding keys to the `credentials` object.
    // e.g. domain, username, password, 2FA token, etc.
    // You can pass any HTML attribute to the <input> tag through the object.
    credentials: {
      email: {
        label: "Email",
        type: "text",
        placeholder: "jsmith@example.com",
        autofocus: true,
      },
      password: {
        label: "Password",
        type: "password",
      },
    },
    async authorize(
      credentials: Partial<Record<"email" | "password", unknown>>,
      request: Request,
    ) {
      console.log(
        "===> auth/index.ts:99 ~ authorize: ",
        logObject(request, false),
      );
      // Use credentials object directly instead of URL search params
      const email: string | undefined | unknown = credentials?.email;

      if (!email) {
        throw new Error("Empty Email.");
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
          throw new Error("Empty Password.");
        }
        const password = credentials.password as string;
        if (user.hash === undefined || user.hash === null) {
          throw new Error("No password hash found for user.");
        }

        if (user.emailVerified === null) {
          throw new Error("User's email has not been verified.");
        }

        const match = await matchPasswordWithHash(password, user.hash);
        if (match) {
          // Any object returned will be saved in `user` property of the JWT
          console.log("===> auth/index.ts:192 ~ authorize -- password matches");
          return user;
        }
        // redirect("/auth/password-no-match");
        // throw new Error("Password does not match");
        console.log(
          "===> auth/index.ts:197 ~ authorize -- password does not match.",
        );
        throw new AuthError("Password does not match.");
      }
      // No user found, so this is their first attempt to login
      // meaning this is also the place you could do registration
      // ...If you return null then an error will be displayed advising the user to check their details.
      console.log(
        "===> auth/index.ts:205 ~ authorize -- User not found, exiting function.",
      );
      throw new Error("User not found.");
    },
  }),

  SendgridProvider({
    id: "sendgrid",
    // If your environment variable is named differently than default
    apiKey: process.env.TT_AUTH_SENDGRID_API_KEY,
    from: "admin@tunetrees.com",
    name: "Email",
    sendVerificationRequest,
    maxAge: 24 * 60 * 60, // How long the email verification link is valid for (default 24h)
  }),

  GitHubProvider({
    clientId: process.env.GITHUB_CLIENT_ID ?? "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",

    // See comment in the google provider config below.
    allowDangerousEmailAccountLinking: true,

    authorization: {
      params: {
        prompt: "consent",
        access_type: "offline",
        response_type: "code",
      },
    },
  }),

  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",

    // This is enabled right now, not so I can link the email address
    // to multiple providers, but so that logout/login works with social
    // logins.  This is due to some strange behavior in nextauth's
    // handleLoginOrRegister function, where the user is not logged in
    // and it throws an error if the user is found via the getUserByEmail
    // function in the adapter, with seemingly no way to catch and recover
    // from the error.  This may be a bug in nextauth, or it may be a
    // misunderstanding on my part of how to use it.  And it may become a
    // non-issue if I can get the db to be used instead of the jwt.
    allowDangerousEmailAccountLinking: true,

    authorization: {
      params: {
        prompt: "consent",
        access_type: "offline",
        response_type: "code",
      },
    },
  }),
];

export type ProviderDict = {
  id: string;
  name: string;
  type: string;
  signinUrl: string;
};

export type ProviderMap = Array<ProviderDict>;

export const providerMap: ProviderMap = providers.map((provider) => {
  const providerData = typeof provider === "function" ? provider() : provider;

  const signinUrl = "";
  return {
    id: providerData.id,
    name: providerData.name,
    type: providerData.type,
    signinUrl: signinUrl,
  };
});

const config = {
  // theme: { logo: "https://authjs.dev/img/logo-sm.png" },
  adapter: ttHttpAdapter,
  session: {
    strategy: "database",
  },
  providers: providers,
  pages: {
    verifyRequest: "/auth/verify-request",
    signIn: "/auth/login",
    // signOut: "/auth/signout",
    // error: "/auth/error", // Error code passed in query string as ?error=
    // newUser: "/auth/newuser", // New users will be directed here on first sign in (leave the property out if not of interest)
  },
  theme: {
    colorScheme: "auto", // "auto" | "dark" | "light"
    // brandColor: "", // Hex color code
    logo: "/logo4.png", // Absolute URL to image
    // buttonText: "", // Hex color code
  },
  // By default, NextAuth expects the authentication routes to be under /api/auth.
  // Removing the basePath option ensures that NextAuth uses the default paths,
  // aligning your client and server routes.  Otherwise a ClientFetchError may occur
  // on the client side, and
  //    [auth][error] UnknownAction: Cannot parse action at /api/auth/session
  // on the server side.  The error occured when switching to a new browser tab,
  // and switching back.
  // basePath: BASE_PATH,
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    session(params: {
      session: Session & { userId?: string; view_settings?: string };
      user: User | AdapterUser;
    }) {
      console.log(
        "===> auth/index.ts:433 ~ callback: session -- ",
        logObject(params, false),
      );
      // Ensure the session is correctly handled
      if (params.user) {
        params.session.userId = params.user.id;
        params.session.user = params.user;
      }
      return params.session;
    },
  },
  experimental: {
    enableWebAuthn: true,
  },
  debug: process.env.NODE_ENV !== "production",
  // debug: true,
} satisfies NextAuthConfig;

export default config;

const nextAuth = NextAuth(config);

export const {
  handlers: { GET, POST },
  signIn,
  signOut,
}: NextAuthResult = nextAuth;

// export const handlers: NextAuthResult["handlers"] = nextAuth.handlers;
export const auth: NextAuthResult["auth"] = nextAuth.auth;
