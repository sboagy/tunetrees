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

// Note there is a lot of commented code in here right now.  This is because I'm still very much in the
// process of figuring out how to do things.  I'm keeping the commented out code in here for now, because
// it's easier for me to see at at a glance what I've tried and what I haven't tried yet, and what my
// options are.  I'm not sure if I want to keep the commented out code in here or not for very long.

import type {
  Account,
  NextAuthConfig,
  NextAuthResult,
  Profile,
  Session,
  User,
} from "next-auth";
import NextAuth from "next-auth";
import "next-auth/jwt";

import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import SendgridProvider from "next-auth/providers/sendgrid";

import { viewSettingsDefault } from "@/app/user-settings/view-settings-default";
import { sendVerificationRequest } from "@/lib/authSendRequest";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import type { JWT, JWTOptions } from "next-auth/jwt";
import type { CredentialInput, Provider } from "next-auth/providers";
import type { NextRequest } from "next/server";
import { getUserExtendedByEmail, ttHttpAdapter } from "./auth_tt_adapter";

export function assertIsDefined<T>(value: T): asserts value is NonNullable<T> {
  if (value === undefined || value === null) {
    throw new Error(`Assertion error: ${value} is not defined`);
  }
}

function logObject(obj: unknown, expand: boolean) {
  if (expand) {
    return JSON.stringify(obj, null, 4);
  }
  return String(obj);
}

export const BASE_PATH = "/auth";

const providers: Provider[] = [
  // ===========================================================================================================
  // Please do not delete this commented out code, at least for now.  It implements password-based authentication,
  // which I'm not yet sure I want or not.  I'm keeping it here for possible future implementation.
  // On way to do this would be to allow them to click on the email field, then give them a choice
  // of logging in with a password if they set it, or logging in with email magic link if they did or didn't.
  // Then a profile page could allow them to set a password if they want to, along with other profile settings.
  // ===========================================================================================================
  // CredentialsProvider({
  //   // The name to display on the sign in form (e.g. "Sign in with...")
  //   name: "Credentials",
  //   // `credentials` is used to generate a form on the sign in page.
  //   // You can specify which fields should be submitted, by adding keys to the `credentials` object.
  //   // e.g. domain, username, password, 2FA token, etc.
  //   // You can pass any HTML attribute to the <input> tag through the object.
  //   credentials: {
  //     email: {
  //       label: "Email",
  //       type: "text",
  //       placeholder: "jsmith@example.com",
  //     },
  //     password: { label: "Password", type: "password" },
  //   },
  //   async authorize(credentials, req) {
  //     //   assertIsDefined(ttHttpAdapter.getUserByEmail);

  //     let email = credentials.email as string;

  //     let secret = process.env.NEXTAUTH_SECRET;

  //     // Unfortunately, this will strip off the hash
  //     // let user = await ttHttpAdapter.getUserByEmail(email);

  //     // So instead we use a customized variant
  //     let user = await getUserExtendedByEmail(email);

  //     // const user = { id: "1", name: "J Smith", email: "jsmith@example.com" };
  //     // debugger;
  //     if (user) {
  //       if (!credentials.password) {
  //         throw new Error("Empty Password!");
  //       }
  //       let password = credentials.password as string;
  //       let match = await matchPasswordWithHash(password, user.hash);
  //       if (match) {
  //         // Any object returned will be saved in `user` property of the JWT
  //         return user;
  //       } else {
  //         // redirect("/auth/password-no-match");
  //         // throw new Error("Password does not match");
  //         throw new AuthError("Password does not match");
  //         //   return null;
  //       }
  //     } else {
  //       // No user found, so this is their first attempt to login
  //       // meaning this is also the place you could do registration
  //       // ...If you return null then an error will be displayed advising the user to check their details.
  //       throw new Error("User not found.");

  //       // You can also Reject this callback with an Error thus the user will be sent to the error page with the error message as a query parameter
  //     }
  //   },
  // }),

  SendgridProvider({
    // If your environment variable is named differently than default
    apiKey: process.env.TT_AUTH_SENDGRID_API_KEY,
    from: "admin@tunetrees.com",
    name: "Email",
    sendVerificationRequest,
  }),

  GitHubProvider({
    clientId: process.env.GITHUB_CLIENT_ID ?? "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",

    // allowDangerousEmailAccountLinking: true,

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

    // allowDangerousEmailAccountLinking: true,

    authorization: {
      params: {
        prompt: "consent",
        access_type: "offline",
        response_type: "code",
      },
    },
  }),
];

export const providerMap = providers.map((provider) => {
  if (typeof provider === "function") {
    const providerData = provider();
    return { id: providerData.id, name: providerData.name };
  }
  return { id: provider.id, name: provider.name };
});

const config = {
  // theme: { logo: "https://authjs.dev/img/logo-sm.png" },
  adapter: ttHttpAdapter,
  session: {
    strategy: "jwt",
    // strategy: "database",
  },
  providers: providers,
  // skipCSRFCheck: skipCSRFCheck, // nope
  pages: {
    // Right now I can't get custom pages to work because of the csrf token issue.
    // signIn: "/auth/login",
    // signOut: "/auth/signout",
    // error: "/auth/error", // Error code passed in query string as ?error=
    //   verifyRequest: "/auth/verify-request", // (used for check email message)
    // newUser: "/auth/newuser", // New users will be directed here on first sign in (leave the property out if not of interest)
  },
  theme: {
    colorScheme: "auto", // "auto" | "dark" | "light"
    // brandColor: "", // Hex color code
    logo: "/logo4.png", // Absolute URL to image
    // buttonText: "", // Hex color code
  },
  basePath: BASE_PATH,
  secret: process.env.NEXTAUTH_SECRET,
  events: {
    signIn(message: {
      user: User;
      account: Account | null;
      profile?: Profile;
      isNewUser?: boolean;
    }) {
      console.log("event: signIn -- ", logObject(message, false));
    },
    signOut(
      message:
        | { session: Awaited<ReturnType<Required<Adapter>["deleteSession"]>> }
        | { token: Awaited<ReturnType<JWTOptions["decode"]>> },
    ) {
      console.log("event: signOut -- ", logObject(message, false));
    },
    createUser(message: { user: User }) {
      console.log("event: createUser -- ", logObject(message, false));
    },
    updateUser(message: { user: User }) {
      console.log("event: updateUser -- ", logObject(message, false));
    },
    linkAccount(message: {
      user: User | AdapterUser;
      account: Account;
      profile: User | AdapterUser;
    }) {
      console.log("event: linkAccount -- ", logObject(message, false));
    },
    session(message: { session: Session; token: JWT }) {
      console.log("event: session -- ", logObject(message, false));
    },
  },
  callbacks: {
    async signIn(params: {
      user: User | AdapterUser;
      account: Account | null;
      /**
       * If OAuth provider is used, it contains the full
       * OAuth profile returned by your provider.
       */
      profile?: Profile;
      /**
       * If Email provider is used, on the first call, it contains a
       * `verificationRequest: true` property to indicate it is being triggered in the verification request flow.
       * When the callback is invoked after a user has clicked on a sign in link,
       * this property will not be present. You can check for the `verificationRequest` property
       * to avoid sending emails to addresses or domains on a blocklist or to only explicitly generate them
       * for email address in an allow list.
       */
      email?: {
        verificationRequest?: boolean;
      };
      /** If Credentials provider is used, it contains the user credentials */
      credentials?: Record<string, CredentialInput>;
    }) {
      // See https://next-auth.js.org/configuration/callbacks#sign-in-callback
      console.log("callback: signIn -- ", logObject(params, false));

      // if (
      //   req.url?.includes("callback") &&
      //   req.url.includes("credentials") &&
      //   req.method === "POST"
      // ) {
      //   const sessionToken = generateSessionToken();
      //   const sessionExpiry = fromDate(
      //     authOptions.session?.maxAge ?? 30 * 24 * 60 * 60
      //   );

      //   const createdSession = await dbAdapter?.createSession?.({
      //     sessionToken: sessionToken,
      //     userId: user.id,
      //     expires: sessionExpiry,
      //   });

      //   if (!createdSession) return false;

      //   const cks = cookies();
      //   cks.set({
      //     name: "next-auth.session-token",
      //     value: sessionToken,
      //     expires: sessionExpiry,
      //   });
      // }
      return true;
      // return "/home";
    },
    authorized(params: {
      /** The request to be authorized. */
      request: NextRequest;
      /** The authenticated user or token, if any. */
      auth: Session | null;
    }) {
      // Is this a thing?  Who calls this?
      console.log("callback: authorized -- ", logObject(params, false));

      // const { pathname } = params.request.nextUrl;
      // if (pathname === "/middleware-example") return !!auth;
      return true;
    },

    async jwt(params: {
      token: JWT;
      user: User | AdapterUser;
      account: Account | null;
      profile?: Profile;
      trigger?: "signIn" | "signUp" | "update";
      isNewUser?: boolean;
      session?: Session | null;
    }) {
      console.log("callback: jwt -- ", logObject(params, false));
      if (params.trigger === "update" && params.session?.user) {
        params.token.name = params.session.user.name;
      } else if (params.trigger === "update" && params.session) {
        params.token = { ...params.token, user: params.session };
        return params.token;
      }
      if (params.account?.provider === "keycloak") {
        return { ...params.token, accessToken: params.account.access_token };
      }

      // If it's a new jwt, add the user id and view settings to the token,
      // so that they can be later transferred to the session, in the
      // session callback.
      const email = params.token?.email as string;
      if (email && !params.token.user_id) {
        const user_record = await getUserExtendedByEmail(email);
        if (user_record?.id) {
          params.token.user_id = user_record?.id;
        }
      }

      // This is a bit hokey right now, but it's a start.
      // Still not sure if I want to store the user settings in the cookie,
      // in keep them in the database. or both.
      // If in the database, then it needs to be in its own table, not
      // in the user table.
      const view_settings_string = params.token.view_settings;
      if (!view_settings_string) {
        params.token.view_settings = viewSettingsDefault;
      }

      return params.token;
    },
    // async redirect(params: {
    //   /** URL provided as callback URL by the client */
    //   url: string;
    //   /** Default base URL of site (can be used as fallback) */
    //   baseUrl: string;
    // }) {
    //   // See https://next-auth.js.org/configuration/callbacks#redirect-callback
    //   console.log("redirect: jwt -- ", logObject(params, false));
    //   return params.baseUrl;
    // },
    async session(params: {
      session: Session & { userId?: string; view_settings?: string };
      token: JWT & { user_id?: string; view_settings?: string };
      user: User | AdapterUser;
    }) {
      // console.log(
      //   "callback: session -- ",
      //   logObject(params.session, false),
      //   params.token,
      //   params.user,
      // );

      params.session.userId = params.token.user_id as string;
      if (params.session.user) {
        params.session.user.id = params.token.user_id as string;
      }
      if (params.token.view_settings) {
        params.session.view_settings = params.token.view_settings;
      }

      return params.session;
    },
    // async session(
    //   params: ({
    //     session: { user: AdapterUser } & AdapterSession;
    //     /** Available when {@link AuthConfig.session} is set to `strategy: "database"`. */
    //     user: AdapterUser;
    //   } & {
    //     session: Session;
    //     /** Available when {@link AuthConfig.session} is set to `strategy: "jwt"` */
    //     token: JWT;
    //   }) & {
    //     /**
    //      * Available when using {@link AuthConfig.session} `strategy: "database"` and an update is triggered for the session.
    //      *
    //      * :::note
    //      * You should validate this data before using it.
    //      * :::
    //      */
    //     newSession: any;
    //     trigger?: "update";
    //   }
    // ) {
    //   console.log("callback: session -- ", logObject(params, false));
    //   if (params.token?.accessToken) {
    //     // params.session.sessionToken = params.token.accessToken;
    //     // session.user.id = token.id;
    //   }
    //   return params.session;
    // },
  },
  // experimental: {
  //   enableWebAuthn: true,
  // },
  // debug: process.env.NODE_ENV !== "production",
  debug: true,
} satisfies NextAuthConfig;

const nextAuth = NextAuth(config);

export const {
  handlers: { GET, POST },
  signIn,
  signOut,
}: NextAuthResult = nextAuth;

// export const handlers: NextAuthResult["handlers"] = nextAuth.handlers;
export const auth: NextAuthResult["auth"] = nextAuth.auth;
// export const signIn: NextAuthResult["signIn"] = nextAuth.signIn;
// export const signOut: NextAuthResult["signOut"] = nextAuth.signOut;

// declare module "next-auth" {
//   interface Session {
//     accessToken?: string;
//   }
// }
//
// declare module "next-auth/jwt" {
//   interface JWT {
//     accessToken?: string;
//   }
// }
