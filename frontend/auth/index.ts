import type {Account, NextAuthConfig, Profile, Session, User,} from "next-auth";
import NextAuth from "next-auth";
import "next-auth/jwt";
import {AuthConfig} from "@auth/core";

// import Apple from "next-auth/providers/apple";
// import Auth0 from "next-auth/providers/auth0";
// import AzureB2C from "next-auth/providers/azure-ad-b2c";
// import BankIDNorway from "next-auth/providers/bankid-no"
// import BoxyHQSAML from "next-auth/providers/boxyhq-saml";
import CredentialsProvider from "next-auth/providers/credentials";

// import Cognito from "next-auth/providers/cognito";
// import Coinbase from "next-auth/providers/coinbase";
// import Discord from "next-auth/providers/discord";
// import Dropbox from "next-auth/providers/dropbox";
// import Facebook from "next-auth/providers/facebook";
import GitHub from "next-auth/providers/github";
// import GitLab from "next-auth/providers/gitlab";
import Google from "next-auth/providers/google";
// import Hubspot from "next-auth/providers/hubspot";
// import Keycloak from "next-auth/providers/keycloak";
// import LinkedIn from "next-auth/providers/linkedin";
// import Netlify from "next-auth/providers/netlify";
// import Okta from "next-auth/providers/okta";
// import Passage from "next-auth/providers/passage";
// import Passkey from "next-auth/providers/passkey";
// import Pinterest from "next-auth/providers/pinterest";
// import Reddit from "next-auth/providers/reddit";
// import Slack from "next-auth/providers/slack";
// import Spotify from "next-auth/providers/spotify";
// import Twitch from "next-auth/providers/twitch";
// import Twitter from "next-auth/providers/twitter";
// import WorkOS from "next-auth/providers/workos";
// import Zoom from "next-auth/providers/zoom";
// import memoryDriver from "unstorage/drivers/memory"
// import vercelKVDriver from "unstorage/drivers/vercel-kv"
import {ttHttpAdapter} from "./auth_tt_adapter";
import type {CredentialInput, Provider} from "next-auth/providers";
import {JWT, JWTOptions} from "next-auth/jwt";
import {Adapter, AdapterSession, AdapterUser} from "next-auth/adapters";
import {NextRequest} from "next/server";

// const storage = createStorage({
//   driver: process.env.VERCEL
//     ? vercelKVDriver({
//       url: process.env.AUTH_KV_REST_API_URL,
//       token: process.env.AUTH_KV_REST_API_TOKEN,
//       env: false,
//     })
//     : memoryDriver(),
// })
// const storage = createStorage();

export function assertIsDefined<T>(value: T): asserts value is NonNullable<T> {
    if (value === undefined || value === null) {
        throw new Error(`Assertion error: ${value} is not defined`);
    }
}

function logObject(obj: any, expand: boolean) {
    if (expand) {
        return JSON.stringify(obj, null, 4);
    } else {
        return String(obj)
    }
}

export const BASE_PATH = "/auth";

const providers: Provider[] = [
    CredentialsProvider({
        // The name to display on the sign in form (e.g. "Sign in with...")
        name: "Credentials",
        // `credentials` is used to generate a form on the sign in page.
        // You can specify which fields should be submitted, by adding keys to the `credentials` object.
        // e.g. domain, username, password, 2FA token, etc.
        // You can pass any HTML attribute to the <input> tag through the object.
        credentials: {
            username: {label: "Username", type: "text", placeholder: "jsmith"},
            password: {label: "Password", type: "password"},
        },
        async authorize(credentials, req) {
            // csrfToken =("d64a0b6f904d301ec118722ac7d80842a9bbff5075fbfc0878baab77bde523f0");
            // password = "yadayada";
            // username = "sboagy@gmail.com";
            // debugger;
            assertIsDefined(ttHttpAdapter.getUser);

            let username = credentials.username as string;
            let user = await ttHttpAdapter.getUser(username);

            // const user = { id: "1", name: "J Smith", email: "jsmith@example.com" };
            // debugger;
            if (user) {
                // Any object returned will be saved in `user` property of the JWT
                return user;
            } else {
                // No user found, so this is their first attempt to login
                // meaning this is also the place you could do registration
                // ...If you return null then an error will be displayed advising the user to check their details.
                throw new Error("User not found.");

                // You can also Reject this callback with an Error thus the user will be sent to the error page with the error message as a query parameter
            }
        },
    }),
    // Apple,
    // Auth0,
    // AzureB2C({
    //   clientId: process.env.AUTH_AZURE_AD_B2C_ID,
    //   clientSecret: process.env.AUTH_AZURE_AD_B2C_SECRET,
    //   issuer: process.env.AUTH_AZURE_AD_B2C_ISSUER,
    // }),
    // // BankIDNorway,
    // BoxyHQSAML({
    //   clientId: "dummy",
    //   clientSecret: "dummy",
    //   issuer: process.env.AUTH_BOXYHQ_SAML_ISSUER,
    // }),
    // Cognito,
    // Coinbase,
    // Discord,
    // Dropbox,
    // Facebook,
    GitHub,
    // GitLab,
    Google,
    // Hubspot,
    // Keycloak({ name: "Keycloak (bob/bob)" }),
    // LinkedIn,
    // Netlify,
    // Okta,
    // Passkey({
    //   formFields: {
    //     email: {
    //       label: "Username",
    //       required: true,
    //       autocomplete: "username webauthn",
    //     },
    //   },
    // }),
    // Passage,
    // Pinterest,
    // Reddit,
    // Slack,
    // Spotify,
    // Twitch,
    // Twitter,
    // WorkOS({
    //   connection: process.env.AUTH_WORKOS_CONNECTION!,
    // }),
    // Zoom,
];

export const providerMap = providers.map((provider) => {
    if (typeof provider === "function") {
        const providerData = provider();
        return {id: providerData.id, name: providerData.name};
    } else {
        return {id: provider.id, name: provider.name};
    }
});

const config = {
    // theme: { logo: "https://authjs.dev/img/logo-sm.png" },
    adapter: ttHttpAdapter,
    session: {
        strategy: "jwt",
    },
    providers: providers,
    // skipCSRFCheck: skipCSRFCheck, // nope
    pages: {
        // Right now I can't get custom pages to work because of the csrf token issue.
        // signIn: "/auth/login",
        // signOut: "/auth/signout",
        //   error: "/auth/error", // Error code passed in query string as ?error=
        //   verifyRequest: "/auth/verify-request", // (used for check email message)
        newUser: "/auth/new-user", // New users will be directed here on first sign in (leave the property out if not of interest)
    },
    theme: {
        colorScheme: "auto", // "auto" | "dark" | "light"
        // brandColor: "", // Hex color code
        logo: "/logo.png", // Absolute URL to image
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
                | { token: Awaited<ReturnType<JWTOptions["decode"]>> }
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
            return true;
        },
        authorized(params: {
            /** The request to be authorized. */
            request: NextRequest;
            /** The authenticated user or token, if any. */
            auth: Session | null;
        }) {
            // Is this a thing?  Who calls this?
            console.log("callback: authorized -- ", logObject(params, false));
            const {pathname} = params.request.nextUrl;
            if (pathname === "/middleware-example") return !!auth;
            return true;
        },
        jwt(params: {
            /**
             * When `trigger` is `"signIn"` or `"signUp"`, it will be a subset of {@link JWT},
             * `name`, `email` and `image` will be included.
             *
             * Otherwise, it will be the full {@link JWT} for subsequent calls.
             */
            token: JWT;
            /**
             * Either the result of the {@link OAuthConfig.profile} or the {@link CredentialsConfig.authorize} callback.
             * @note available when `trigger` is `"signIn"` or `"signUp"`.
             *
             * Resources:
             * - [Credentials Provider](https://authjs.dev/getting-started/authentication/credentials)
             * - [User database model](https://authjs.dev/guides/creating-a-database-adapter#user-management)
             */
            user: User | AdapterUser;
            /**
             * Contains information about the provider that was used to sign in.
             * Also includes {@link TokenSet}
             * @note available when `trigger` is `"signIn"` or `"signUp"`
             */
            account: Account | null;
            /**
             * The OAuth profile returned from your provider.
             * (In case of OIDC it will be the decoded ID Token or /userinfo response)
             * @note available when `trigger` is `"signIn"`.
             */
            profile?: Profile;
            /**
             * Check why was the jwt callback invoked. Possible reasons are:
             * - user sign-in: First time the callback is invoked, `user`, `profile` and `account` will be present.
             * - user sign-up: a user is created for the first time in the database (when {@link AuthConfig.session}.strategy is set to `"database"`)
             * - update event: Triggered by the `useSession().update` method.
             * In case of the latter, `trigger` will be `undefined`.
             */
            trigger?: "signIn" | "signUp" | "update";
            /** @deprecated use `trigger === "signUp"` instead */
            isNewUser?: boolean;
            /**
             * When using {@link AuthConfig.session} `strategy: "jwt"`, this is the data
             * sent from the client via the `useSession().update` method.
             *
             * ⚠ Note, you should validate this data before using it.
             */
            session?: any;
        }) {
            console.log("callback: jwt -- ", logObject(params, false));
            if (params.trigger === "update")
                params.token.name = params.session.user.name;
            if (params.account?.provider === "keycloak") {
                return {...params.token, accessToken: params.account.access_token};
            }
            return params.token;
        },
        async redirect(params: {
            /** URL provided as callback URL by the client */
            url: string;
            /** Default base URL of site (can be used as fallback) */
            baseUrl: string;
        }) {
            // See https://next-auth.js.org/configuration/callbacks#redirect-callback
            console.log("redirect: jwt -- ", logObject(params, false));
            return params.baseUrl;
        },
        async session(
            params: ({
                session: { user: AdapterUser } & AdapterSession;
                /** Available when {@link AuthConfig.session} is set to `strategy: "database"`. */
                user: AdapterUser;
            } & {
                session: Session;
                /** Available when {@link AuthConfig.session} is set to `strategy: "jwt"` */
                token: JWT;
            }) & {
                /**
                 * Available when using {@link AuthConfig.session} `strategy: "database"` and an update is triggered for the session.
                 *
                 * :::note
                 * You should validate this data before using it.
                 * :::
                 */
                newSession: any;
                trigger?: "update";
            }
        ) {
            console.log("callback: session -- ", logObject(params, false));
            if (params.token?.accessToken) {
                // params.session.sessionToken = params.token.accessToken;
                // session.user.id = token.id;
            }
            return params.session;
        },
    },
    // experimental: {
    //   enableWebAuthn: true,
    // },
    debug: process.env.NODE_ENV !== "production",
} satisfies NextAuthConfig;

export const {handlers, auth, signIn, signOut} = NextAuth(config);

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
